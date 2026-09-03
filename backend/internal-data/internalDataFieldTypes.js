// Shared value coercion for internal-data table fields — used by the manual row API,
// the Excel import, and the online sync ticker so validation logic isn't duplicated.

// Derive a stable slug key from a label (preserves Hebrew and Latin chars), same
// approach as contactFieldController.js's toSlugKey.
const HEBREW_RANGE = String.fromCharCode(0x0590) + '-' + String.fromCharCode(0x05FF);
const NON_WORD_NON_HEBREW = new RegExp(`[^\\w${HEBREW_RANGE}]`, 'g');

export const toSlugKey = (label) =>
  String(label).trim().replace(/\s+/g, '_').replace(NON_WORD_NON_HEBREW, '');

// Coerces a raw cell/input value to the field's declared type.
// Returns { value, error } — error is set (and value is null) when the raw value
// can't be coerced to the field's type.
export const coerceValue = (type, raw) => {
  if (raw === undefined || raw === null || raw === '') {
    return { value: null, error: null };
  }
  switch (type) {
    case 'number': {
      const n = Number(raw);
      if (!Number.isFinite(n)) return { value: null, error: 'ערך לא מספרי' };
      return { value: n, error: null };
    }
    case 'date': {
      const d = raw instanceof Date ? raw : new Date(raw);
      if (Number.isNaN(d.getTime())) return { value: null, error: 'תאריך לא תקין' };
      return { value: d.toISOString(), error: null };
    }
    case 'boolean': {
      if (typeof raw === 'boolean') return { value: raw, error: null };
      const s = String(raw).trim().toLowerCase();
      if (['true', '1', 'כן', 'yes'].includes(s)) return { value: true, error: null };
      if (['false', '0', 'לא', 'no'].includes(s)) return { value: false, error: null };
      return { value: null, error: 'ערך לא תקין (כן/לא)' };
    }
    case 'email': {
      const s = String(raw).trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return { value: null, error: 'כתובת מייל לא תקינה' };
      return { value: s, error: null };
    }
    case 'phone': {
      const digits = String(raw).trim().replace(/[\s-]/g, '');
      if (!/^\+?\d{7,15}$/.test(digits)) return { value: null, error: 'מספר טלפון לא תקין' };
      return { value: digits, error: null };
    }
    case 'json': {
      if (typeof raw === 'object') return { value: raw, error: null };
      try {
        return { value: JSON.parse(String(raw)), error: null };
      } catch {
        return { value: null, error: 'JSON לא תקין' };
      }
    }
    case 'string':
    default:
      return { value: String(raw), error: null };
  }
};

// Infers a field's type from a set of sample values collected across a few rows —
// used when a table is created from a Google Sheet / uploaded file so the user
// doesn't have to hand-declare every column's type.
export const inferFieldType = (label, samples) => {
  const values = samples.filter((v) => v !== undefined && v !== null && String(v).trim() !== '');
  if (values.length === 0) return 'string';

  const lowerLabel = label.toLowerCase();
  if (lowerLabel.includes('phone') || label.includes('טלפון')) return 'phone';
  if (lowerLabel.includes('email') || label.includes('מייל') || label.includes('דוא"ל')) return 'email';

  const allMatch = (test) => values.every(test);
  if (allMatch((v) => /^\+?\d{7,15}$/.test(String(v).trim().replace(/[\s-]/g, '')))) return 'phone';
  if (allMatch((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim()))) return 'email';
  if (allMatch((v) => Number.isFinite(Number(v)) && String(v).trim() !== '')) return 'number';
  if (allMatch((v) => ['true', 'false', '1', '0', 'כן', 'לא', 'yes', 'no'].includes(String(v).trim().toLowerCase()))) return 'boolean';
  if (allMatch((v) => !Number.isNaN(new Date(v).getTime()) && /\d{4}|\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}/.test(String(v)))) return 'date';
  return 'string';
};

// Builds a FieldDefinition[] from parsed header/row data — shared by the Google
// Sheets preview endpoint and by table creation from an uploaded file.
export const inferFieldsFromRows = (headers, rows) => {
  const usedKeys = new Set();
  return headers.map((label, i) => {
    const trimmedLabel = String(label).trim();
    let key = toSlugKey(trimmedLabel);
    let suffix = 2;
    while (!key || usedKeys.has(key)) {
      key = `${toSlugKey(trimmedLabel) || 'field'}_${suffix++}`;
    }
    usedKeys.add(key);
    const samples = rows.slice(0, 20).map((r) => r[trimmedLabel] ?? r[label] ?? r[key]);
    return { key, label: trimmedLabel, type: inferFieldType(trimmedLabel, samples), required: false, order: i };
  }).filter((f) => f.label);
};

// Extracts a { key: rawValue } bag from one parsed spreadsheet row (as returned by
// XLSX.utils.sheet_to_json), matching columns by field label. Template headers are
// "label (type)" — this matches that or a bare label, trimmed, so a client-edited
// header still matches. Shared by the manual Excel import and the online sync ticker.
export const extractRawValues = (sheetRow, fields) => {
  const rawValues = {};
  for (const field of fields) {
    let cell = '';
    for (const key of Object.keys(sheetRow)) {
      const trimmed = key.trim();
      if (trimmed === field.label || trimmed.startsWith(`${field.label} (`)) { cell = sheetRow[key]; break; }
    }
    rawValues[field.key] = cell;
  }
  return rawValues;
};

// Coerces a full { key: rawValue } bag against a table's field definitions.
// Returns { values, errors } — errors is a { key: message } map of any fields that
// failed to coerce (those keys are omitted from `values`).
export const coerceRow = (fields, rawValues) => {
  const values = {};
  const errors = {};
  for (const field of fields) {
    const raw = rawValues ? rawValues[field.key] : undefined;
    const { value, error } = coerceValue(field.type, raw);
    if (error) {
      errors[field.key] = error;
    } else if (value !== null) {
      values[field.key] = value;
    } else if (field.required) {
      errors[field.key] = 'שדה חובה';
    }
  }
  return { values, errors };
};

// Derives a short, stable identifier for a user (email local-part, or name, or the
// raw id as a last resort) — appended to table slugs so anyone looking at raw
// InternalDataTable documents (or a downloaded template's filename) can immediately
// tell which client a table belongs to without cross-referencing user_id.
export const userIdentifierSuffix = (user, fallbackId) => {
  const source = (user?.email ? String(user.email).split('@')[0] : '') || user?.name || fallbackId || '';
  return toSlugKey(source).toLowerCase() || 'user';
};
