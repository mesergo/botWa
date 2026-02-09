
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import botRoutes from './routes/botRoutes.js';
import flowRoutes from './routes/flowRoutes.js';
import processRoutes from './routes/processRoutes.js';
import proxyRoutes from './routes/proxyRoutes.js';
import sessionRoutes from './routes/sessionRoutes.js';
import versionRoutes from './routes/versionRoutes.js';
import templateRoutes from './routes/templateRoutes.js';
import { seedTemplates } from './controllers/templateController.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));

// Connect to MongoDB before starting the server
async function startServer() {
  try {
    // Connect to database FIRST
    await connectDB();
    console.log('✅ Database connected, registering routes...');
    
    // Seed templates AFTER database connection
    await seedTemplates();
    
    // Register routes AFTER database connection
    app.use('/api/auth', authRoutes);
    app.use('/api/bots', botRoutes);
    app.use('/api/flow', flowRoutes);
    app.use('/api/processes', processRoutes);
    app.use('/api/proxy', proxyRoutes);
    app.use('/api/sessions', sessionRoutes);
    app.use('/api/versions', versionRoutes);
    app.use('/api/templates', templateRoutes);

    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 Backend server running on http://localhost:${PORT}`);
      console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('❌ Failed to connect to database. Server will not start.');
    console.error('Error:', error.message);
    process.exit(1);
  }
}

startServer();
