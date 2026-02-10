import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/bots';

mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('=== Users and Tokens ===\n');
    
    const users = await User.find({});
    
    users.forEach((user, i) => {
      console.log(`User ${i + 1}:`);
      console.log(`  Email: ${user.email}`);
      console.log(`  ID: ${user._id}`);
      console.log(`  Tokens: ${user.tokens?.length || 0}`);
      if (user.tokens && user.tokens.length > 0) {
        user.tokens.forEach((token, j) => {
          console.log(`    ${j + 1}. ${token}`);
        });
      }
      console.log('');
    });
    
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
