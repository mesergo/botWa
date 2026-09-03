import mongoose from 'mongoose';
import XLSX from 'xlsx';
import fs from 'fs';
import InternalDataTable from './InternalDataTable.js';
import InternalDataRow from './InternalDataRow.js';
import InternalDataSyncLog from './InternalDataSyncLog.js';
import User from '../models/User.js';
import { getEffectiveUserId } from '../middleware/auth.js';
import { toSlugKey, coerceRow, extractRawValues, userIdentifierSuffix, inferFieldsFromRows } from './internalDataFieldTypes.js';
import { syncTable } from './internalDataSyncTicker.js';
import { fetchSourceRows } from './internalDataSheetSource.js';
import { generateApiKey } from './internalDataApiKeys.js';
import { buildSafeFilter, flattenRow, UnsafeQueryError } from './internalDataQueryEngine.js';

const FIELD_TYPES = ['string', 'number', 'date', 'boolean', 'email', 'phone', 'json'];
const TYPE_LABELS = { string: 'טקסט', number: 'מספר', date: 'תאריך', boolean: 'כן/לא', email: 'מייל', phone: 'טלפון', json: 'JSON' };

// Assigns stable, unique-within-table keys to a submitted fields array. Existing
// fields (identified by an already-present `key`) keep their key so row values
// stay linked; new fields get one derived from their label.
const normalizeFields = (rawFields) => {
  const fields = Array.isArray(rawFields) ? rawFields : [];
  const usedKeys = new Set();
  return fields.map((f, i) => {
    const label = String(f?.label || '').trim();
    const type = FIELD_TYPES.includes(f?.type) ? f.type : 'string';
    let key = f?.key ? String(f.key) : toSlugKey(label);
    let suffix = 2;
    while (!key || usedKeys.has(key)) {
      key = `${toSlugKey(label) || 'field'}_${suffix++}`;
    }
    usedKeys.add(key);
    return { key, label, type, required: f?.required === true, order: f?.order ?? i };
  }).filter(f => f.label);
};

const findOwnedTable = (tableId, userId) => {
  if (!mongoose.Types.ObjectId.isValid(tableId)) return null;
  return InternalDataTable.findOne({ _id: tableId, user_id: userId });
};

// Attaches a live recordCount to each table doc (not stored on the table itself,
// so it can't drift out of sync with the actual InternalDataRow collection).
const withRecordCounts = async (tables) => {
  const counts = await InternalDataRow.aggregate([
    { $match: { table_id: { $in: tables.map((t) => t._id) } } },
    { $group: { _id: '$table_id', count: { $sum: 1 } } },
  ]);
  const countByTableId = new Map(counts.map((c) => [c._id.toString(), c.count]));
  return tables.map((t) => {
    const obj = t.toObject ? t.toObject() : t;
    return { ...obj, recordCount: countByTableId.get(t._id.toString()) || 0 };
  });
};

// GET /api/internal-data/tables
export const listTables = async (req, res) => {
  const userId = getEffectiveUserId(req);
  try {
    const tables = await InternalDataTable.find({ user_id: userId }).sort({ createdAt: -1 });
    res.json(await withRecordCounts(tables));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/internal-data/stats — aggregate totals for the header strip
export const getStats = async (req, res) => {
  const userId = getEffectiveUserId(req);
  try {
    const tables = await InternalDataTable.find({ user_id: userId });
    const totalRecords = await InternalDataRow.countDocuments({ user_id: userId });
    res.json({
      success: true,
      data: {
        totalCollections: tables.length,
        totalRecords,
        totalEndpoints: tables.filter((t) => t.api?.enabled).length,
        totalApiCalls: tables.reduce((acc, t) => acc + (t.api?.total_calls || 0), 0),
        activeSchedules: tables.filter((t) => t.sync?.enabled).length,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/internal-data/tables
// Accepts either a fully-specified `fields` array (structure-editor flow), or a
// `source_type: 'google_sheet'` + `source_config.google_sheets_url` describing a
// sheet to connect — fields are then auto-detected from its header row and an
// initial sync runs immediately so records show up without waiting for the ticker.
export const createTable = async (req, res) => {
  const userId = getEffectiveUserId(req);
  const { name, description, fields, source_type, source_config, sync, api } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'שם טבלה הוא שדה חובה' });
  }
  try {
    // The slug always carries the owning client's identity at the end (email
    // local-part, falling back to name/id) so anyone browsing raw
    // InternalDataTable documents — or a downloaded template's filename — can
    // immediately tell which client a table belongs to.
    const owner = await User.findById(userId).select('email name');
    const identitySuffix = userIdentifierSuffix(owner, userId);
    const baseSlug = `${toSlugKey(name) || 'table'}_${identitySuffix}`;
    let slug = baseSlug;
    let suffix = 2;
    while (await InternalDataTable.exists({ user_id: userId, slug })) {
      slug = `${baseSlug}_${suffix++}`;
    }

    let resolvedFields = normalizeFields(fields);
    const googleSheetUrl = source_config?.google_sheets_url;
    const resolvedSourceType = ['google_sheet', 'excel_url'].includes(source_type) ? source_type : 'manual';
    if (resolvedFields.length === 0 && resolvedSourceType === 'google_sheet' && googleSheetUrl) {
      const { headers, rows } = await fetchSourceRows('google_sheet', googleSheetUrl);
      resolvedFields = inferFieldsFromRows(headers, rows);
    }

    const table = await InternalDataTable.create({
      user_id: userId,
      name: name.trim(),
      description: (description || '').trim(),
      slug,
      source_type: resolvedSourceType,
      fields: resolvedFields,
      sync: resolvedSourceType === 'google_sheet' && googleSheetUrl ? {
        enabled: sync?.enabled === true,
        source_type: 'google_sheet',
        source_url: googleSheetUrl,
        interval_minutes: sync?.interval_minutes || 60,
        mode: sync?.mode || 'replace',
        unique_key_field: sync?.unique_key_field || '',
        next_sync_at: sync?.enabled === true ? new Date() : null,
      } : undefined,
      api: { enabled: api?.enabled === true, key: generateApiKey() },
    });

    // A Google Sheets table gets its first batch of rows immediately, rather than
    // waiting for the next ticker tick.
    if (table.source_type === 'google_sheet' && table.sync.source_url) {
      await syncTable(table, 'initial_upload');
    }

    const [withCount] = await withRecordCounts([table]);
    res.status(201).json(withCount);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// PUT /api/internal-data/tables/:id
export const updateTable = async (req, res) => {
  const userId = getEffectiveUserId(req);
  const { name, description, fields } = req.body;
  try {
    const update = {};
    if (name !== undefined) update.name = name.trim();
    if (description !== undefined) update.description = description.trim();
    if (fields !== undefined) update.fields = normalizeFields(fields);
    const table = await InternalDataTable.findOneAndUpdate(
      { _id: req.params.id, user_id: userId },
      { $set: update },
      { new: true, runValidators: true }
    );
    if (!table) return res.status(404).json({ error: 'טבלה לא נמצאה' });
    const [withCount] = await withRecordCounts([table]);
    res.json(withCount);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/internal-data/tables/:id
export const deleteTable = async (req, res) => {
  const userId = getEffectiveUserId(req);
  try {
    const table = await InternalDataTable.findOneAndDelete({ _id: req.params.id, user_id: userId });
    if (!table) return res.status(404).json({ error: 'טבלה לא נמצאה' });
    await InternalDataRow.deleteMany({ table_id: table._id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/internal-data/tables/:id/rows
export const listRows = async (req, res) => {
  const userId = getEffectiveUserId(req);
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
  try {
    const table = await findOwnedTable(req.params.id, userId);
    if (!table) return res.status(404).json({ error: 'טבלה לא נמצאה' });

    const filter = { table_id: table._id, user_id: userId };
    const [rows, total] = await Promise.all([
      InternalDataRow.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      InternalDataRow.countDocuments(filter),
    ]);
    res.json({ rows, total, page, totalPages: Math.ceil(total / limit) || 1 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/internal-data/tables/:id/rows
export const createRow = async (req, res) => {
  const userId = getEffectiveUserId(req);
  try {
    const table = await findOwnedTable(req.params.id, userId);
    if (!table) return res.status(404).json({ error: 'טבלה לא נמצאה' });

    const { values, errors } = coerceRow(table.fields, req.body.values);
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ error: 'שגיאת אימות שדות', fieldErrors: errors });
    }
    const row = await InternalDataRow.create({ table_id: table._id, user_id: userId, values });
    res.status(201).json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// PUT /api/internal-data/rows/:id
export const updateRow = async (req, res) => {
  const userId = getEffectiveUserId(req);
  try {
    const row = await InternalDataRow.findOne({ _id: req.params.id, user_id: userId });
    if (!row) return res.status(404).json({ error: 'שורה לא נמצאה' });
    const table = await InternalDataTable.findOne({ _id: row.table_id, user_id: userId });
    if (!table) return res.status(404).json({ error: 'טבלה לא נמצאה' });

    const { values, errors } = coerceRow(table.fields, req.body.values);
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ error: 'שגיאת אימות שדות', fieldErrors: errors });
    }
    row.values = values;
    await row.save();
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/internal-data/rows/:id
export const deleteRow = async (req, res) => {
  const userId = getEffectiveUserId(req);
  try {
    const row = await InternalDataRow.findOneAndDelete({ _id: req.params.id, user_id: userId });
    if (!row) return res.status(404).json({ error: 'שורה לא נמצאה' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/internal-data/tables/:id/template — downloadable Excel with the table's field labels as headers
export const downloadTemplate = async (req, res) => {
  const userId = getEffectiveUserId(req);
  try {
    const table = await findOwnedTable(req.params.id, userId);
    if (!table) return res.status(404).json({ error: 'טבלה לא נמצאה' });

    const headers = table.fields.map(f => `${f.label} (${TYPE_LABELS[f.type] || f.type})`);
    const sheet = XLSX.utils.aoa_to_sheet([headers]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'תבנית');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${table.slug}-template.xlsx"`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/internal-data/tables/:id/import — bulk-add rows from an uploaded Excel/CSV file
export const importRows = async (req, res) => {
  const userId = getEffectiveUserId(req);
  if (!req.file) return res.status(400).json({ error: 'לא הועלה קובץ' });

  const filePath = req.file.path;
  try {
    const table = await findOwnedTable(req.params.id, userId);
    if (!table) return res.status(404).json({ error: 'טבלה לא נמצאה' });

    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheetRows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });

    if (table.fields.length === 0 && sheetRows.length > 0) {
      table.fields = inferFieldsFromRows(Object.keys(sheetRows[0]), sheetRows);
      await table.save();
    }

    let created = 0;
    const skipped = []; // { row, reason }
    const errors = []; // { row, error }
    const rowsToInsert = [];

    for (let i = 0; i < sheetRows.length; i++) {
      const rawRow = sheetRows[i];
      const rowNumber = i + 2;
      const isEmptyRow = Object.values(rawRow).every(v => String(v).trim() === '');
      if (isEmptyRow) { skipped.push({ row: rowNumber, reason: 'שורה ריקה' }); continue; }

      const rawValues = extractRawValues(rawRow, table.fields);
      const { values, errors: fieldErrors } = coerceRow(table.fields, rawValues);
      if (Object.keys(fieldErrors).length > 0) {
        errors.push({ row: rowNumber, error: Object.entries(fieldErrors).map(([k, v]) => `${k}: ${v}`).join(', ') });
        continue;
      }
      rowsToInsert.push({ table_id: table._id, user_id: userId, values });
      created++;
    }

    if (rowsToInsert.length > 0) {
      await InternalDataRow.insertMany(rowsToInsert);
    }

    res.json({ imported: created, created, skipped, errors });
  } catch (err) {
    res.status(400).json({ error: 'שגיאה בקריאת הקובץ: ' + err.message });
  } finally {
    fs.unlink(filePath, () => {});
  }
};

// PUT /api/internal-data/tables/:id/sync
export const updateSyncSettings = async (req, res) => {
  const userId = getEffectiveUserId(req);
  const { enabled, source_type, source_url, interval_minutes, mode, unique_key_field } = req.body;
  try {
    const table = await findOwnedTable(req.params.id, userId);
    if (!table) return res.status(404).json({ error: 'טבלה לא נמצאה' });

    if (enabled !== undefined) table.sync.enabled = enabled === true;
    if (source_type !== undefined) table.sync.source_type = source_type;
    if (source_url !== undefined) table.sync.source_url = String(source_url).trim();
    if (interval_minutes !== undefined) {
      const n = Number(interval_minutes);
      table.sync.interval_minutes = Number.isFinite(n) && n >= 0 ? n : table.sync.interval_minutes;
    }
    if (mode !== undefined && ['replace', 'upsert', 'append'].includes(mode)) {
      table.sync.mode = mode;
    }
    if (unique_key_field !== undefined) table.sync.unique_key_field = String(unique_key_field).trim();

    // Enabling (or re-saving while enabled) schedules an immediate first sync —
    // the ticker will pick it up on its next tick.
    table.sync.next_sync_at = table.sync.enabled ? new Date() : null;

    await table.save();
    const [withCount] = await withRecordCounts([table]);
    res.json(withCount);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/internal-data/tables/:id/sync/run-now
export const triggerSyncNow = async (req, res) => {
  const userId = getEffectiveUserId(req);
  try {
    const table = await findOwnedTable(req.params.id, userId);
    if (!table) return res.status(404).json({ error: 'טבלה לא נמצאה' });
    if (!table.sync.source_url || !table.sync.source_type) {
      return res.status(400).json({ error: 'לא הוגדר מקור סנכרון עבור טבלה זו' });
    }
    const result = await syncTable(table, 'manual');
    if (result.success) {
      const [withCount] = await withRecordCounts([table]);
      result.collection = withCount;
    }
    res.json({ success: result.success, error: result.error, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/internal-data/tables/:id/logs
export const listSyncLogs = async (req, res) => {
  const userId = getEffectiveUserId(req);
  try {
    const table = await findOwnedTable(req.params.id, userId);
    if (!table) return res.status(404).json({ error: 'טבלה לא נמצאה' });
    const logs = await InternalDataSyncLog.find({ table_id: table._id }).sort({ createdAt: -1 }).limit(50);
    res.json({ success: true, data: logs.map((l) => ({
      id: l._id.toString(),
      collectionId: l.table_id.toString(),
      timestamp: l.createdAt,
      trigger: l.trigger,
      status: l.status,
      recordsProcessed: l.records_processed,
      recordsAdded: l.records_added,
      recordsUpdated: l.records_updated,
      recordsDeleted: l.records_deleted,
      durationMs: l.duration_ms,
      message: l.message,
      errorDetails: l.error_details,
    })) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/internal-data/sheets/preview — fetch+parse a Google Sheet without creating anything,
// so the create-table modal can show a live preview of headers/rows before committing.
export const previewSheet = async (req, res) => {
  const { url } = req.body;
  if (!url || !String(url).trim()) {
    return res.status(400).json({ success: false, error: 'נא להזין קישור ל-Google Sheets' });
  }
  try {
    const { headers, rows } = await fetchSourceRows('google_sheet', url);
    res.json({
      success: true,
      headers,
      totalRows: rows.length,
      previewRows: rows.slice(0, 5),
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message || 'שגיאה בטעינת הגיליון' });
  }
};

// POST /api/internal-data/tables/:id/import-data — bulk-add rows already parsed
// client-side (from an uploaded CSV/Excel/JSON file), rather than a raw multipart
// upload. Auto-extends the table's fields to cover any new columns in the data.
export const importJsonRows = async (req, res) => {
  const userId = getEffectiveUserId(req);
  const { jsonRows, syncMode, uniqueKeyField } = req.body;
  if (!Array.isArray(jsonRows) || jsonRows.length === 0) {
    return res.status(400).json({ error: 'לא נשלחו שורות לייבוא' });
  }
  try {
    const table = await findOwnedTable(req.params.id, userId);
    if (!table) return res.status(404).json({ error: 'טבלה לא נמצאה' });

    if (table.fields.length === 0) {
      const headers = Array.from(new Set(jsonRows.flatMap((r) => Object.keys(r))));
      table.fields = inferFieldsFromRows(headers, jsonRows);
      await table.save();
    }

    let created = 0;
    const skipped = [];
    const errors = [];
    const mode = syncMode || 'replace';
    if (mode === 'replace') await InternalDataRow.deleteMany({ table_id: table._id });

    for (let i = 0; i < jsonRows.length; i++) {
      const rowNumber = i + 2;
      const rawValues = extractRawValues(jsonRows[i], table.fields);
      const { values, errors: fieldErrors } = coerceRow(table.fields, rawValues);
      if (Object.keys(fieldErrors).length > 0) {
        errors.push({ row: rowNumber, error: Object.entries(fieldErrors).map(([k, v]) => `${k}: ${v}`).join(', ') });
        continue;
      }
      if (mode === 'upsert' && uniqueKeyField && values[uniqueKeyField] !== undefined) {
        await InternalDataRow.findOneAndUpdate(
          { table_id: table._id, [`values.${uniqueKeyField}`]: values[uniqueKeyField] },
          { $set: { values, user_id: userId } },
          { upsert: true }
        );
      } else {
        await InternalDataRow.create({ table_id: table._id, user_id: userId, values });
      }
      created++;
    }

    const [withCount] = await withRecordCounts([table]);
    res.json({ success: true, data: { imported: created, created, skipped, errors, collection: withCount } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// PUT /api/internal-data/tables/:id/api — toggle public access and/or rotate the key
export const updateApiSettings = async (req, res) => {
  const userId = getEffectiveUserId(req);
  const { enabled, regenerate } = req.body;
  try {
    const table = await findOwnedTable(req.params.id, userId);
    if (!table) return res.status(404).json({ error: 'טבלה לא נמצאה' });
    if (enabled !== undefined) table.api.enabled = enabled === true;
    if (regenerate === true) table.api.key = generateApiKey();
    await table.save();
    const [withCount] = await withRecordCounts([table]);
    res.json(withCount);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/internal-data/tables/:id/query — authenticated MQL-style console:
// { filter, projection, sort, limit, skip, single, format }, scoped to the caller's own table.
export const runMongoQuery = async (req, res) => {
  const userId = getEffectiveUserId(req);
  const start = Date.now();
  try {
    const table = await findOwnedTable(req.params.id, userId);
    if (!table) return res.status(404).json({ success: false, error: 'טבלה לא נמצאה' });

    const { filter, projection, sort, limit, skip, single } = req.body || {};
    const safeFilter = buildSafeFilter(table._id, filter);
    const safeLimit = Math.min(200, Math.max(1, Number(limit) || 50));

    let query = InternalDataRow.find(safeFilter).skip(Number(skip) || 0).limit(safeLimit);
    if (sort && typeof sort === 'object') {
      query = query.sort(Object.fromEntries(Object.entries(sort).map(([k, v]) => [`values.${k}`, v])));
    }
    const docs = await query;
    let data = docs.map(flattenRow);
    if (Array.isArray(projection) && projection.length > 0) {
      data = data.map((r) => Object.fromEntries(projection.filter((f) => f in r).map((f) => [f, r[f]])));
    }
    if (single) data = data[0] || null;

    res.json({ success: true, count: Array.isArray(data) ? data.length : (data ? 1 : 0), data, executionTimeMs: Date.now() - start });
  } catch (err) {
    if (err instanceof UnsafeQueryError) {
      return res.status(400).json({ success: false, error: err.message });
    }
    res.status(500).json({ success: false, error: err.message });
  }
};
