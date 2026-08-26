// Usage: node scripts/set-user-password.js <email> <newPassword>
// Sets a bcrypt-hashed password on a user in the database named by MONGODB_URI.
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const [email, newPassword] = process.argv.slice(2);
if (!email || !newPassword) {
  console.error('Usage: node scripts/set-user-password.js <email> <newPassword>');
  process.exit(1);
}

await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
console.log('Connected to database:', mongoose.connection.name);

const users = mongoose.connection.db.collection('User');
const hash = await bcrypt.hash(newPassword, 10);
const result = await users.updateOne(
  { email: email.toLowerCase() },
  { $set: { password: hash, status: 'active' } }
);

if (result.matchedCount === 0) {
  console.error('No user found with email:', email);
} else {
  const user = await users.findOne({ email: email.toLowerCase() });
  console.log('Updated:', user.email, '| role:', user.role, '| status:', user.status);
  console.log('Password verifies:', await bcrypt.compare(newPassword, user.password));
}

await mongoose.disconnect();
