// Safe MongoDB-style query builder shared by the authenticated Mongo console tab
// and the external lookup/query API. A caller-supplied filter is sanitized before
// ever reaching Mongoose: only a fixed whitelist of read-only comparison operators
// is allowed, and the table/user scope is always AND-merged in afterwards so a
// crafted filter can never escape its own table's rows.
const ALLOWED_OPERATORS = new Set(['$eq', '$ne', '$gt', '$gte', '$lt', '$lte', '$in', '$nin', '$regex', '$options', '$exists', '$or', '$and', '$not']);

class UnsafeQueryError extends Error {}

// Recursively rejects any operator key not on the whitelist (in particular
// $where/$function/$accumulator/$expr, which can execute arbitrary server-side JS).
const assertSafe = (node) => {
  if (Array.isArray(node)) {
    node.forEach(assertSafe);
    return;
  }
  if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      if (key.startsWith('$') && !ALLOWED_OPERATORS.has(key)) {
        throw new UnsafeQueryError(`אופרטור לא נתמך: ${key}`);
      }
      assertSafe(value);
    }
  }
};

// Prefixes every non-operator key in a user-supplied filter with `values.`,
// since row data lives under InternalDataRow.values rather than at the document root.
const namespaceFilterKeys = (filter) => {
  if (!filter || typeof filter !== 'object') return {};
  const out = {};
  for (const [key, value] of Object.entries(filter)) {
    if (key === '$or' || key === '$and') {
      out[key] = Array.isArray(value) ? value.map(namespaceFilterKeys) : value;
    } else if (key.startsWith('$')) {
      out[key] = value;
    } else if (key.startsWith('_')) {
      out[key] = value; // allow filtering on _id / timestamps directly
    } else {
      out[`values.${key}`] = value;
    }
  }
  return out;
};

// Builds a validated Mongoose filter for InternalDataRow, always scoped to one table.
export const buildSafeFilter = (tableId, rawFilter) => {
  assertSafe(rawFilter || {});
  return { table_id: tableId, ...namespaceFilterKeys(rawFilter) };
};

// Translates the dynamic query builder's suffix-style GET params
// (field__operator=value) into a Mongo filter fragment.
export const operatorParamToFilter = (field, operator, value) => {
  switch (operator) {
    case 'contains': return { [field]: { $regex: escapeRegex(value), $options: 'i' } };
    case 'startsWith': return { [field]: { $regex: `^${escapeRegex(value)}`, $options: 'i' } };
    case 'endsWith': return { [field]: { $regex: `${escapeRegex(value)}$`, $options: 'i' } };
    case 'gt': return { [field]: { $gt: isNaN(Number(value)) ? value : Number(value) } };
    case 'gte': return { [field]: { $gte: isNaN(Number(value)) ? value : Number(value) } };
    case 'lt': return { [field]: { $lt: isNaN(Number(value)) ? value : Number(value) } };
    case 'lte': return { [field]: { $lte: isNaN(Number(value)) ? value : Number(value) } };
    case 'ne': return { [field]: { $ne: value } };
    case 'regex': return { [field]: { $regex: value } };
    case 'in': return { [field]: { $in: String(value).split(',').map((s) => s.trim()) } };
    case 'equals':
    default:
      return { [field]: value };
  }
};

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Flattens an InternalDataRow document into a plain { ...values, _id, _createdAt }
// object, matching the shape the frontend and external API consumers expect.
export const flattenRow = (row) => ({
  _id: row._id.toString(),
  _createdAt: row.createdAt,
  _updatedAt: row.updatedAt,
  ...row.values,
});

const toCsv = (rows) => {
  if (rows.length === 0) return '';
  const headers = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const escapeCsv = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [headers.join(','), ...rows.map((r) => headers.map((h) => escapeCsv(r[h])).join(','))];
  return lines.join('\n');
};

const toXml = (rows) => {
  const escapeXml = (v) => String(v ?? '').replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
  const rowsXml = rows.map((r) => {
    const fields = Object.entries(r).map(([k, v]) => `<${k}>${escapeXml(v)}</${k}>`).join('');
    return `<record>${fields}</record>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><records>${rowsXml}</records>`;
};

// Builds the "actions" envelope some external bot/IVR engines (e.g. message.co.il
// campaigns) expect from a webhook: a flat array of SetParameter actions — one per
// returned field — followed by a single Return action carrying a flow-control code.
// Used both for a matched record and for the not-found case (see formatNotFoundActions).
export const formatBotActionsRow = (row, selectedFields, successReturn = -2) => {
  const projected = selectedFields && selectedFields.length > 0
    ? Object.fromEntries(selectedFields.filter((f) => f in row).map((f) => [f, row[f]]))
    : Object.fromEntries(Object.entries(row).filter(([k]) => !k.startsWith('_')));
  const actions = Object.entries(projected).map(([name, value]) => ({
    type: 'SetParameter',
    name,
    value: value === null || value === undefined ? '' : value,
  }));
  actions.push({ type: 'Return', value: successReturn });
  return { actions };
};

export const formatNotFoundActions = (message = '❌ לא נמצאה רשומה תואמת', notFoundReturn = 0) => ({
  actions: [
    { type: 'SetParameter', name: 'message', value: message },
    { type: 'Return', value: notFoundReturn },
  ],
});

// Formats flattened rows per the requested OutputFormat, returning { body, contentType }.
export const formatRows = (rows, format, selectedFields) => {
  let projected = rows;
  if (selectedFields && selectedFields.length > 0) {
    projected = rows.map((r) => Object.fromEntries(selectedFields.filter((f) => f in r).map((f) => [f, r[f]])));
  }

  switch (format) {
    case 'single_object':
      return { body: projected[0] || null, contentType: 'application/json' };
    case 'fields_only':
      return { body: projected.map((r) => selectedFields && selectedFields.length > 0 ? selectedFields.map((f) => r[f]) : Object.values(r)), contentType: 'application/json' };
    case 'key_value': {
      const uniqueKey = selectedFields?.[0] || 'id';
      const dict = {};
      projected.forEach((r) => { dict[r[uniqueKey] ?? r._id] = r; });
      return { body: dict, contentType: 'application/json' };
    }
    case 'csv':
      return { body: toCsv(projected), contentType: 'text/csv' };
    case 'xml':
      return { body: toXml(projected), contentType: 'application/xml' };
    case 'json_array':
    default:
      return { body: projected, contentType: 'application/json' };
  }
};

export { UnsafeQueryError };
