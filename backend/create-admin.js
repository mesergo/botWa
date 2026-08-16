import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/flowbot';

async function createAdmin() {
  const [name, email, password, phone] = process.argv.slice(2);

  
  if (!name || !email || !password) {
    console.log('Usage: node create-admin.js <name> <email> <password> [phone]');
    process.exit(1);
  } 

  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const existing = await User.findOne({ email });
    if (existing) {
      console.log(`❌ A user with email "${email}" already exists (id: ${existing._id})`);
      console.log('   Use make-admin.js to promote an existing user instead.');
      process.exit(1);
    }

    const publicId = Math.random().toString(36).substring(2, 15);

    const user = await User.create({
      name,
      email,
      phone: phone || '',
      password,
      role: 'admin',
      public_id: publicId,
      account_type: 'Basic',
      status: 'active'
    });

    console.log(`✅ Admin user "${user.name}" (${user.email}) created successfully!`);
    console.log(`   User ID: ${user._id}`);
    console.log(`   Role: ${user.role}`);
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

createAdmin();
