// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Import middleware
const { authMiddleware } = require('./src/middleware/auth');
const errorHandler = require('./src/middleware/errorHandler');
const logger = require('./src/utils/logger');

// Import routes
// Phase 2 Routes
const authRoutes = require('./src/routes/auth');
const userRoutes = require('./src/routes/users');
const studentRoutes = require('./src/routes/students');
const sectionRoutes = require('./src/routes/sections');
const groupRoutes = require('./src/routes/groups');

// Phase 3 Routes (New)
const instructorRoutes = require('./src/routes/instructors');
const courseRoutes = require('./src/routes/courses');
const locationRoutes = require('./src/routes/locations');
const scheduleRoutes = require('./src/routes/schedules');
const attendanceRoutes = require('./src/routes/attendance');
const notificationRoutes = require('./src/routes/notifications');

// Test database connection
const pool = require('./src/config/database');

const app = express();
const PORT = process.env.PORT || 7110;

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'ส่งคำขอมากเกินไป กรุณารอสักครู่'
  }
});
app.use('/api/', limiter);

// CORS configuration
const corsOptions = {
  origin: [
    'http://localhost:7210',  // Frontend development
    'http://127.0.0.1:7210',
    process.env.FRONTEND_URL || 'http://localhost:7210'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};
app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} - ${req.ip}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Database health check
app.get('/health/db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({
      success: true,
      message: 'Database connection is healthy',
      timestamp: result.rows[0].now
    });
  } catch (error) {
    logger.error('Database health check failed:', error);
    res.status(500).json({
      success: false,
      message: 'Database connection failed',
      error: error.message
    });
  }
});

// API Routes
app.use('/api/auth', authRoutes);

// Protected routes - Phase 2
app.use('/api/users', authMiddleware, userRoutes);
app.use('/api/students', authMiddleware, studentRoutes);
app.use('/api/sections', authMiddleware, sectionRoutes);
app.use('/api/groups', authMiddleware, groupRoutes);

// Protected routes - Phase 3 (New)
app.use('/api/instructors', authMiddleware, instructorRoutes);
app.use('/api/courses', authMiddleware, courseRoutes);
app.use('/api/locations', authMiddleware, locationRoutes);
app.use('/api/schedules', authMiddleware, scheduleRoutes);
app.use('/api/attendance', authMiddleware, attendanceRoutes);
app.use('/api/notifications', authMiddleware, notificationRoutes);

// Activity Types route (might be used with courses)
app.use('/api/activity-types', authMiddleware, require('./src/routes/activityTypes'));

// Report routes (for future use)
app.use('/api/reports', authMiddleware, require('./src/routes/reports'));

// System settings routes (for future use)
app.use('/api/settings', authMiddleware, require('./src/routes/settings'));

// Serve static files from frontend (if needed)
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
  });
}

// Handle 404
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found',
    path: req.originalUrl
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  // Close database connections
  await pool.end();
  
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  
  // Close database connections
  await pool.end();
  
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  logger.info(`🚀 Nursing Schedule System API Server`);
  logger.info(`📍 Server running on port ${PORT}`);
  logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`🔗 Health check: http://localhost:${PORT}/health`);
  logger.info(`📊 Database health: http://localhost:${PORT}/health/db`);
  
  if (process.env.NODE_ENV === 'development') {
    logger.info(`📝 API Documentation will be available at: http://localhost:${PORT}/api-docs`);
  }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Promise Rejection:', err);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

module.exports = app;
