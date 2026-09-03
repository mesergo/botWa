// Periodic auto-sync for internal-data tables pointed at an online source
// (a "publish to web" Google Sheet CSV link, or a direct URL to a web-hosted Excel
// file). Follows the same "tick often, act only when due" idiom as
// activeContactsTicker.js: a frequent ticker only processes tables whose
// sync.next_sync_at is due, then reschedules each one `interval_minutes` out.
import mongoose from 'mongoose';
import InternalDataTable from './InternalDataTable.js';
import InternalDataRow from './InternalDataRow.js';
import InternalDataSyncLog from './InternalDataSyncLog.js';
import { coerceRow, extractRawValues } from './internalDataFieldTypes.js';
import { fetchSourceRows } from './internalDataSheetSource.js';

const TICK_MS = 5 * 60 * 1000; // check for due tables every 5 min
const BATCH_LIMIT = 50; // cap per tick so a large backlog doesn't block the event loop
const INITIAL_RUN_DELAY_MS = 60 * 1000; // let the DB connection settle on startup

// Fetches a table's configured source, parses it, and applies it to the table's rows
// according to table.sync.mode. Used by the periodic ticker, the manual "הרץ עכשיו"
// endpoint, and (with trigger: 'initial_upload') right after creating a table.
export const syncTable = async (table, trigger = 'scheduled') => {
  const now = new Date();
  const start = Date.now();
  try {
    const { rows: sheetRows } = await fetchSourceRows(table.sync.source_type, table.sync.source_url);

    const parsedRows = [];
    let skipped = 0;
    for (const rawRow of sheetRows) {
      const isEmptyRow = Object.values(rawRow).every((v) => String(v).trim() === '');
      if (isEmptyRow) { skipped++; continue; }
      const rawValues = extractRawValues(rawRow, table.fields);
      const { values, errors } = coerceRow(table.fields, rawValues);
      if (Object.keys(errors).length > 0) { skipped++; continue; }
      parsedRows.push(values);
    }

    let added = 0;
    let updated = 0;
    let deleted = 0;
    const mode = table.sync.mode || 'replace';

    if (mode === 'replace') {
      const del = await InternalDataRow.deleteMany({ table_id: table._id });
      deleted = del.deletedCount || 0;
      if (parsedRows.length > 0) {
        await InternalDataRow.insertMany(parsedRows.map((values) => ({ table_id: table._id, user_id: table.user_id, values })));
      }
      added = parsedRows.length;
    } else if (mode === 'upsert' && table.sync.unique_key_field) {
      const keyField = table.sync.unique_key_field;
      for (const values of parsedRows) {
        const keyValue = values[keyField];
        if (keyValue === undefined || keyValue === null || keyValue === '') {
          const created = await InternalDataRow.create({ table_id: table._id, user_id: table.user_id, values });
          if (created) added++;
          continue;
        }
        const filter = { table_id: table._id, [`values.${keyField}`]: keyValue };
        const existing = await InternalDataRow.findOne(filter);
        if (existing) {
          existing.values = values;
          await existing.save();
          updated++;
        } else {
          await InternalDataRow.create({ table_id: table._id, user_id: table.user_id, values });
          added++;
        }
      }
    } else {
      // append (or upsert without a configured key field, which degrades to append)
      if (parsedRows.length > 0) {
        await InternalDataRow.insertMany(parsedRows.map((values) => ({ table_id: table._id, user_id: table.user_id, values })));
      }
      added = parsedRows.length;
    }

    const durationMs = Date.now() - start;
    table.sync.last_synced_at = now;
    table.sync.last_sync_status = 'success';
    table.sync.last_sync_error = '';
    table.sync.next_sync_at = table.sync.interval_minutes > 0 ? new Date(now.getTime() + table.sync.interval_minutes * 60 * 1000) : null;
    await table.save();

    const message = `סונכרנו ${added + updated} רשומות (${added} נוספו, ${updated} עודכנו, ${deleted} הוחלפו)`;
    await InternalDataSyncLog.create({
      table_id: table._id, user_id: table.user_id, trigger, status: 'success',
      records_processed: parsedRows.length + skipped, records_added: added, records_updated: updated,
      records_deleted: deleted, duration_ms: durationMs, message,
    });

    return { success: true, imported: added + updated, added, updated, deleted, skipped, message, durationMs };
  } catch (err) {
    const durationMs = Date.now() - start;
    table.sync.last_synced_at = now;
    table.sync.last_sync_status = 'error';
    table.sync.last_sync_error = err.message;
    table.sync.next_sync_at = table.sync.interval_minutes > 0 ? new Date(now.getTime() + table.sync.interval_minutes * 60 * 1000) : null;
    await table.save();

    await InternalDataSyncLog.create({
      table_id: table._id, user_id: table.user_id, trigger, status: 'failed',
      duration_ms: durationMs, message: 'הסנכרון נכשל', error_details: err.message,
    });

    return { success: false, error: err.message, durationMs };
  }
};

export const runInternalDataSyncTick = async () => {
  if (!mongoose.connection || mongoose.connection.readyState !== 1) return;

  const now = new Date();
  const candidates = await InternalDataTable.find({
    'sync.enabled': true,
    'sync.next_sync_at': { $lte: now },
  })
    .sort({ 'sync.next_sync_at': 1 })
    .limit(BATCH_LIMIT);

  for (const table of candidates) {
    try {
      // Sequential by design to keep DB/network contention low, same as the other tickers.
      // eslint-disable-next-line no-await-in-loop
      await syncTable(table, 'scheduled');
    } catch (err) {
      console.error('[internalDataSyncTicker] candidate error:', err.message);
    }
  }
};

setTimeout(() => {
  runInternalDataSyncTick().catch((err) => {
    console.error('[internalDataSyncTicker] initial run error:', err.message);
  });
}, INITIAL_RUN_DELAY_MS);

setInterval(() => {
  runInternalDataSyncTick().catch((err) => {
    console.error('[internalDataSyncTicker] ticker error:', err.message);
  });
}, TICK_MS);
