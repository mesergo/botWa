// One-off migration: drop the unique index on User.email so multiple accounts
// (companies) can share the same login email (multi-account-per-email feature).
//
// Run once against the production DB after deploy:
//   node drop-email-unique-index.js
import mongoose from 'mongoose';
import connectDB from './config/db.js';

async function dropEmailUniqueIndex() {
  try {
    await connectDB();

    const collection = mongoose.connection.collection('User');
    const indexes = await collection.indexes();
    console.log('📊 Current indexes on User collection:');
    indexes.forEach(idx => console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)} unique=${!!idx.unique}`));

    try {
      await collection.dropIndex('email_1');
      console.log('✅ Dropped unique index "email_1" on User.email');
    } catch (err) {
      if (err.codeName === 'IndexNotFound' || err.code === 27) {
        console.log('ℹ️ Index "email_1" not found (already dropped or never existed) — skipping');
      } else {
        throw err;
      }
    } 

    // Re-create a plain (non-unique) index so lookups by email stay fast.
    await collection.createIndex({ email: 1 }, { unique: false });
    console.log('✅ Ensured non-unique index on User.email');

    console.log('🎉 Migration complete');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

dropEmailUniqueIndex();
