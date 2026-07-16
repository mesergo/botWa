import dotenv from 'dotenv';
import connectDB from './config/db.js';
import User from './models/User.js';

dotenv.config();

async function run() {
  await connectDB();
  const u = await User.findOne({ email: 'admin123@gmail.com' });
  if (!u) {
    console.log('User not found');
  } else {
    console.log('name:', u.name);
    console.log('email:', u.email);
    console.log('token:', u.token);
    console.log('id:', u._id);
  }
  process.exit();
}
run();
