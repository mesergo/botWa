// One-time migration: existing InternalDataTable documents created before the
// api/source_type/sync.mode fields were added don't have them stored at all.
// Mongoose fills in schema defaults only in memory when such a document is read —
// it does NOT persist them — so api.key (a randomly-generated default) would come
// back as a *different* value every time an old table is fetched until it's saved
// once. This script saves every table once so the defaults (especially api.key)
// become stable, real, persisted values.
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import InternalDataTable from './internal-data/InternalDataTable.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/flowbot';

async function migrate() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const tables = await InternalDataTable.find({});
    console.log(`Found ${tables.length} internal-data table(s)`);

    let updated = 0;
    for (const table of tables) {
      // Just calling .save() on a hydrated document persists any schema defaults
      // that were applied in memory but never written to the stored document.
      await table.save();
      updated++;
      console.log(`  ✓ ${table.name} (${table._id}) — api.key: ${table.api.key}`);
    }

    console.log(`✅ Done. Backfilled ${updated} table(s).`);
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

migrate();
