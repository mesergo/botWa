import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';
import crypto from 'crypto';

dotenv.config();

const generateToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

async function addTokenToUser(email, customToken = null) {
  try {
    const connectionString = process.env.MONGODB_URI || 'mongodb://bots:b0t5bots@127.0.0.1/bots';
    await mongoose.connect(connectionString);
    
    console.log('🔌 Connected to MongoDB');

    const user = await User.findOne({ email });
    
    if (!user) {
      console.error(`❌ User with email "${email}" not found`);
      process.exit(1);
    }

    const token = customToken || generateToken();
    
    user.token = token;
    await user.save();

    console.log('✅ Token added successfully!');
    console.log('');
    console.log('📋 User Details:');
    console.log('   Email:', user.email);
    console.log('   Name:', user.name);
    console.log('   Token:', token);
    console.log('');
    console.log('🔑 You can now use this token for API calls:');
    console.log(`   Authorization: Bearer ${token}`);
    console.log('');
    console.log('📝 Example curl command:');
    console.log(`   curl -X POST http://localhost:3001/api/chat/respond \\`);
    console.log(`     -H "Authorization: Bearer ${token}" \\`);
    console.log(`     -H "Content-Type: application/json" \\`);
    console.log(`     -d '{"phone":"${user.phone || '972501234567'}","text":"שלום","sender":"972509876543"}'`);
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Get email from command line arguments
const email = process.argv[2];
const customToken = process.argv[3];

if (!email) {
  console.log('Usage: node add-token.js <email> [custom-token]');
  console.log('');
  console.log('Examples:');
  console.log('  node backend/add-token.js user@example.com');
  console.log('  node backend/add-token.js user@example.com my-custom-token-123');
  process.exit(1);
}

addTokenToUser(email, customToken);
