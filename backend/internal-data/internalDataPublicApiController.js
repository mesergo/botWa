// External read/query API for internal-data tables (the "API generator" tab).
// These endpoints are NOT behind authenticateToken — they're meant to be called
// by third-party tools (Make.com, Zapier, bots, CRMs) with no dashboard login.
// Access is instead gated per-table: either the table owner marked it fully
// public (table.api.enabled === true), or the caller must present the table's
// secret key. Every filter is passed through buildSafeFilter so a caller can
// never reach another table's rows or use a dangerous Mongo operator.
import mongoose from 'mongoose';
import InternalDataTable from './InternalDataTable.js';
import InternalDataRow from './InternalDataRow.js';
import { extractRequestApiKey } from './internalDataApiKeys.js';
import { buildSafeFilter, flattenRow, formatBotActionsRow, formatNotFoundActions, formatRows, operatorParamToFilter, UnsafeQueryError } from './internalDataQueryEngine.js';

const loadAuthorizedTable = async (req) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return { error: 404, message: 'טבלה לא נמצאה' };
  const table = await InternalDataTable.findById(id);
  if (!table) return { error: 404, message: 'טבלה לא נמצאה' };

  if (!table.api.enabled) {
    const suppliedKey = extractRequestApiKey(req);
    if (!suppliedKey || suppliedKey !== table.api.key) {
      return { error: 401, message: 'מפתח API חסר או שגוי' };
    }
  }
  return { table };
};

// Fire-and-forget usage counter — never blocks/fails the actual response.
const recordApiCall = (table) => {
  InternalDataTable.updateOne({ _id: table._id }, { $inc: { 'api.total_calls': 1 }, $set: { 'api.last_called_at': new Date() } }).catch(() => {});
};

const respondFormatted = (res, rows, format, selectedFields) => {
  const { body, contentType } = formatRows(rows, format || 'json_array', selectedFields);
  res.type(contentType);
  if (contentType === 'application/json') return res.json({ success: true, count: Array.isArray(body) ? body.length : (body ? 1 : 0), data: body });
  return res.send(body ?? '');
};

// A caller-supplied _format always wins; otherwise the table's saved api.response_format
// applies, so a bare URL pasted into a bot/IVR engine still returns the envelope its
// owner configured in the API generator tab. `fallback` is the endpoint's historical
// default, kept so existing integrations that send no _format don't change shape.
const resolveFormat = (requested, table, fallback) => requested || table?.api?.response_format || fallback;

// 'bot_actions' bypasses the {success,count,data} envelope entirely — bot/IVR engines
// (e.g. message.co.il campaigns) expect the raw { actions: [...] } object at the top level,
// always with HTTP 200 (flow control happens via the trailing Return action's value, not the status code).
// Every knob can come either from the request (_successReturn, _notFoundMessage, ...) or,
// when absent, from the table's saved bot_* settings.
const respondBotActions = (res, params, row, selectedFields, table) => {
  const api = table?.api || {};
  const successReturn = params._successReturn !== undefined ? Number(params._successReturn) : (api.bot_success_return ?? -2);
  if (!row) {
    const notFoundReturn = params._notFoundReturn !== undefined ? Number(params._notFoundReturn) : (api.bot_not_found_return ?? 0);
    const message = params._notFoundMessage || api.bot_not_found_message || '❌ לא נמצאה רשומה תואמת';
    return res.status(200).json(formatNotFoundActions(message, notFoundReturn));
  }
  return res.status(200).json(formatBotActionsRow(row, selectedFields, successReturn, {
    fieldOrder: (table?.fields || []).map((f) => f.key),
    message: params._successMessage || params._message || api.bot_success_message,
  }));
};

// GET/POST /api/v1/collections/:id/lookup — { key, value } → single matching record
export const lookupRecord = async (req, res) => {
  const params = req.method === 'GET' ? req.query : req.body;
  const { key, value, fields, _format, _fields } = params;
  if (!key || value === undefined) {
    return res.status(400).json({ success: false, error: 'נדרשים הפרמטרים key ו-value' });
  }
  try {
    const { table, error, message } = await loadAuthorizedTable(req);
    if (error) return res.status(error).json({ success: false, error: message });

    const filter = buildSafeFilter(table._id, { [key]: value });
    const row = await InternalDataRow.findOne(filter);
    recordApiCall(table);

    const selectedFields = (fields || _fields) ? String(fields || _fields).split(',').map((s) => s.trim()) : undefined;
    const format = resolveFormat(_format, table, 'json_array');
    if (format === 'bot_actions') return respondBotActions(res, params, row ? flattenRow(row) : null, selectedFields, table);

    if (!row) return res.status(404).json({ success: false, error: 'לא נמצאה רשומה תואמת' });
    respondFormatted(res, [flattenRow(row)], format, selectedFields);
  } catch (err) {
    if (err instanceof UnsafeQueryError) return res.status(400).json({ success: false, error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
};

// GET/POST /api/v1/collections/:id/query — filter/sort/limit query returning multiple records.
// GET reads dynamic-builder-style params (field, field__operator=value, _fields, _format, _limit, _sort, _order);
// POST reads a structured body ({ filter, projection, sort, limit, format, single }).
export const queryRecords = async (req, res) => {
  try {
    const { table, error, message } = await loadAuthorizedTable(req);
    if (error) return res.status(error).json({ success: false, error: message });

    let rawFilter = {};
    let selectedFields;
    let sort;
    let limit = 50;
    let format = null;
    let single = false;
    let params = {};

    if (req.method === 'POST' && req.body && typeof req.body.filter === 'object') {
      rawFilter = req.body.filter || {};
      selectedFields = req.body.projection;
      sort = req.body.sort;
      limit = req.body.limit || limit;
      format = req.body.format || format;
      single = req.body.single === true;
      params = req.body;
    } else {
      params = req.method === 'GET' ? req.query : req.body;
      for (const [rawKey, val] of Object.entries(params || {})) {
        if (rawKey.startsWith('_') || rawKey === 'apiKey') continue;
        const [field, operator] = rawKey.split('__');
        Object.assign(rawFilter, operatorParamToFilter(field, operator || 'equals', val));
      }
      if (params?._fields) selectedFields = String(params._fields).split(',').map((s) => s.trim());
      if (params?._format) format = params._format;
      if (params?._limit) limit = params._limit;
      if (params?._sort) sort = { [params._sort]: params._order === 'asc' ? 1 : -1 };
    }

    format = resolveFormat(format, table, 'json_array');

    const safeFilter = buildSafeFilter(table._id, rawFilter);
    const safeLimit = Math.min(200, Math.max(1, Number(limit) || 50));

    let query = InternalDataRow.find(safeFilter).limit(safeLimit);
    if (sort) query = query.sort(Object.fromEntries(Object.entries(sort).map(([k, v]) => [`values.${k}`, v])));

    const docs = await query;
    recordApiCall(table);
    const rows = docs.map(flattenRow);

    if (format === 'bot_actions') return respondBotActions(res, params, rows[0] || null, selectedFields, table);

    if (single || format === 'single_object') {
      return respondFormatted(res, rows.slice(0, 1), 'single_object', selectedFields);
    }
    respondFormatted(res, rows, format, selectedFields);
  } catch (err) {
    if (err instanceof UnsafeQueryError) return res.status(400).json({ success: false, error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
};
