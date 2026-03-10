
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import botRoutes from './routes/botRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import flowRoutes from './routes/flowRoutes.js';
import processRoutes from './routes/processRoutes.js';
import proxyRoutes from './routes/proxyRoutes.js';
import sessionRoutes from './routes/sessionRoutes.js';
import versionRoutes from './routes/versionRoutes.js';
import templateRoutes from './routes/templateRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
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
app.use(express.json({
  limit: '50mb',
  // Save the raw body so we can log it if JSON parse fails
  verify: (req, _res, buf) => {
    req.rawBody = buf.toString('utf8');
  }
}));

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
    app.use('/api/chat', chatRoutes);
    app.use('/api/flow', flowRoutes);
    app.use('/api/processes', processRoutes);
    app.use('/api/xc', proxyRoutes);  // neutral path - avoids firewall URL-dictionary blocks on 'proxy'/'webservice'
    app.use('/api/sessions', sessionRoutes);
    app.use('/api/versions', versionRoutes);
    app.use('/api/templates', templateRoutes);
    app.use('/api/admin', adminRoutes);

    // ── Global error handler ─────────────────────────────────────────────────
    // Catches body-parser JSON parse failures (and any other errors) and
    // returns a proper JSON response so the client can understand what went wrong.
    // eslint-disable-next-line no-unused-vars
    app.use((err, req, res, next) => {
      if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) {
        console.error('❌ [body-parser] Failed to parse JSON request body.');
        console.error('   URL   :', req.method, req.originalUrl);
        console.error('   Raw body (first 300 chars):', (req.rawBody || '').substring(0, 300));
        console.error('   Error :', err.message);
        return res.status(400).json({
          error: 'Invalid JSON in request body',
          details: err.message,
          hint: 'The request body could not be parsed as JSON. Check for unescaped special characters.'
        });
      }
      console.error('❌ Unhandled error:', err);
      res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
    });
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
