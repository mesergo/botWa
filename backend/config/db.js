import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function connectDB() {
  try {
    const connectionString = process.env.MONGODB_URI || 'mongodb://localhost:27017/flowbot';
    // const connectionString = process.env.MONGODB_URI || 'mongodb://localhost:27017/bots';

    const isProduction = process.env.NODE_ENV === 'production';
    
    console.log('🔌 Connecting to MongoDB...');
    console.log('🌍 Environment:', process.env.NODE_ENV || 'development');
    
    // Only log connection string in development (with password masked)
    if (!isProduction) {
      console.log('📍 Connection String:', connectionString.replace(/:([^:@]{4})[^:@]*@/, ':$1***@'));
    }
    
    // Configure mongoose to handle connection better
    mongoose.set('strictQuery', false);
    
    // Environment-specific connection options
    const connectionOptions = {
      serverSelectionTimeoutMS: isProduction ? 30000 : 20000,
      socketTimeoutMS: 45000,
      bufferCommands: false,
      maxPoolSize: isProduction ? 50 : 10,
      minPoolSize: isProduction ? 5 : 1,
      retryWrites: true,
      w: 'majority'
    };
    
    await mongoose.connect(connectionString, connectionOptions);
    
    console.log('✅ MongoDB Connected successfully');
    console.log(`📊 Database: ${mongoose.connection.name}`);
    console.log(`🔗 Connection state: ${mongoose.connection.readyState === 1 ? 'Connected' : 'Not connected'}`);
    console.log(`🌐 Host: ${mongoose.connection.host}`);
  } catch (error) {
    console.error('❌ MongoDB connection error:');
    console.error(`   Message: ${error.message}`);
    console.error(`   Code: ${error.code || 'N/A'}`);
    
    if (error.message.includes('querySrv') || error.message.includes('ECONNREFUSED')) {
      console.error('');
      if ((process.env.MONGODB_URI || '').includes('mongodb+srv')) {
        console.error('💡 MongoDB Atlas unreachable (DNS/network blocked)');
        console.error('   - Check internet connection');
        console.error('   - Verify cluster is active in Atlas dashboard');
        console.error('   - For local dev, use: MONGODB_URI=mongodb://localhost:27017/flowbot');
      } else {
        console.error('💡 Connection Refused — MongoDB is not running locally');
        console.error('   1. Start MongoDB service:  net start MongoDB');
        console.error('   2. Or run: mongod --dbpath C:\\data\\db');
        console.error('   3. Check port 27017 is free');
      }
      console.error('');
    } else if (error.message.includes('authentication') || error.message.includes('password')) {
      console.error('');
      console.error('💡 Authentication Issue!');
      console.error('   Please check the username and password in connection string');
      console.error('   Current MONGODB_URI:', process.env.MONGODB_URI || 'Not set');
      console.error('');
    } else {
      console.error(''); 
      console.error('💡 General Connection Issue');
      console.error('   Full error details:');
      console.error(error);
      console.error('');
    }
    throw error;
  }
}

// Handle connection events
mongoose.connection.on('connected', () => {
  console.log('✅ MongoDB connection established');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB connection error:', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.warn('⚠️  MongoDB disconnected');
});

// Disable mongoose buffering - fail fast if not connected
mongoose.set('bufferCommands', false);

export default connectDB;
export { mongoose };