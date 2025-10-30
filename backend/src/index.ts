import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config';

// Fix for BigInt serialization
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

import { errorHandler } from './middleware/errorHandler';
import { authRoutes } from './routes/auth';
import { dataRoomRoutes } from './routes/dataRooms';
import { folderRoutes } from './routes/folders';
import fileRoutes from './routes/files';
import googleDriveRoutes from './routes/googleDrive';
import { authenticateToken } from './middleware/auth';

const app = express();
const PORT = config.port;

// Trust proxy for Vercel deployment
// Trust only the first proxy (Vercel's proxy)
app.set('trust proxy', 1);

// CORS Configuration
const allowedOrigins = config.allowedOrigins
  .split(',')
  .map(origin => origin.trim());

// Middleware
app.use(helmet());

// CORS Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn('⚠️ CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/data-rooms', authenticateToken, dataRoomRoutes);
app.use('/api/folders', authenticateToken, folderRoutes);
app.use('/api/files', authenticateToken, fileRoutes);
// Google Drive routes - callback doesn't need auth, others do
app.use('/api/google-drive', googleDriveRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv || 'development'
  });
});

// Root health check
app.get('/', (req, res) => {
  res.send('Hello, world!');
});

// Simple test endpoint
app.get('/api/test', (req, res) => {
  res.status(200).json({ 
    message: 'Backend is working!',
    timestamp: new Date().toISOString()
  });
});

// Error handling
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    path: req.originalUrl 
  });
});

// Start the server only if not in a serverless environment
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Environment: ${config.nodeEnv}`);
  });
}

export default app;
