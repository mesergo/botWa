import mongoose from 'mongoose';
import { generateApiKey } from './internalDataApiKeys.js';

const fieldSchema = new mongoose.Schema({
  key: { type: String, required: true },
  label: { type: String, required: true },
  type: { type: String, enum: ['string', 'number', 'date', 'boolean', 'email', 'phone', 'json'], default: 'string' },
  required: { type: Boolean, default: false },
  order: { type: Number, default: 0 },
}, { _id: false });

const internalDataTableSchema = new mongoose.Schema({
  user_id: { type: String, required: true, index: true },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  slug: { type: String, required: true },
  source_type: { type: String, enum: ['google_sheet', 'excel_url', 'manual'], default: 'manual' },
  fields: { type: [fieldSchema], default: [] },
  sync: {
    enabled: { type: Boolean, default: false },
    source_type: { type: String, enum: ['google_sheet', 'excel_url', null], default: null },
    source_url: { type: String, default: '' },
    interval_minutes: { type: Number, default: 60 },
    // Update strategy applied both by the manual "sync now" action and the background ticker:
    // replace = wipe & re-insert every row; upsert = match existing rows by unique_key_field
    // and update-or-insert; append = only ever insert new rows, never touch existing ones.
    mode: { type: String, enum: ['replace', 'upsert', 'append'], default: 'replace' },
    unique_key_field: { type: String, default: '' },
    last_synced_at: { type: Date, default: null },
    last_sync_status: { type: String, enum: ['success', 'error', null], default: null },
    last_sync_error: { type: String, default: '' },
    next_sync_at: { type: Date, default: null },
  },
  // External read-only API surface for this table (used by the API generator tab).
  // `enabled: true` makes the table's lookup/query endpoints callable without a key —
  // an explicit, per-table opt-in. Otherwise callers must present `key` as
  // an x-api-key header, apiKey query param, or apiKey body field.
  api: {
    enabled: { type: Boolean, default: false },
    key: { type: String, default: () => generateApiKey() },
    total_calls: { type: Number, default: 0 },
    last_called_at: { type: Date, default: null },
    // Response shape the endpoints fall back to when the caller sends no _format,
    // so a plain URL pasted into a bot/IVR engine returns the right envelope.
    // null = keep each endpoint's historical default (single_object for lookup,
    // json_array for query). bot_* settings apply only to the bot_actions format.
    response_format: { type: String, enum: ['json_array', 'single_object', 'fields_only', 'key_value', 'csv', 'xml', 'bot_actions', null], default: null },
    bot_success_return: { type: Number, default: -2 },
    bot_not_found_return: { type: Number, default: 0 },
    bot_not_found_message: { type: String, default: '❌ לא נמצאה רשומה תואמת' },
    bot_success_message: { type: String, default: '' },
  },
}, {
  timestamps: true,
  collection: 'InternalDataTable',
});

internalDataTableSchema.index({ user_id: 1, slug: 1 }, { unique: true });

export default mongoose.model('InternalDataTable', internalDataTableSchema);
