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
  },
}, {
  timestamps: true,
  collection: 'InternalDataTable',
});

internalDataTableSchema.index({ user_id: 1, slug: 1 }, { unique: true });

export default mongoose.model('InternalDataTable', internalDataTableSchema);
