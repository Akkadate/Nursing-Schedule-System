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

// เพิ่มโค้ดนี้ใน server.js หลังจาก health check endpoint --------------------

// Database test endpoint
app.get('/test-db', async (req, res) => {
  try {
    const { query } = require('./src/config/database');
    
    // Test 1: Basic connection
    const timeResult = await query('SELECT NOW() as current_time');
    
    // Test 2: Check if nursing_schedule_db database exists
    const dbResult = await query('SELECT current_database() as database_name');
    
    // Test 3: List all tables in public schema
    const tablesResult = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    // Test 4: Check specific nursing schedule tables
    const nursingTables = [
      'users', 'students', 'instructors', 'sections', 'groups',
      'courses', 'activity_types', 'locations', 'schedules', 
      'schedule_groups', 'attendance', 'notifications', 
      'system_settings', 'audit_logs'
    ];
    
    const existingTables = tablesResult.rows.map(row => row.table_name);
    const missingTables = nursingTables.filter(table => !existingTables.includes(table));
    const foundTables = nursingTables.filter(table => existingTables.includes(table));
    
    // Test 5: Check users table structure (if exists)
    let usersTableInfo = null;
    if (existingTables.includes('users')) {
      const usersInfo = await query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        ORDER BY ordinal_position
      `);
      usersTableInfo = usersInfo.rows;
    }
    
    res.json({
      success: true,
      message: 'Database connection test completed',
      tests: {
        connection: {
          status: 'SUCCESS',
          current_time: timeResult.rows[0].current_time,
          database_name: dbResult.rows[0].database_name
        },
        tables: {
          total_tables: existingTables.length,
          nursing_tables_found: foundTables.length,
          nursing_tables_missing: missingTables.length,
          found_tables: foundTables,
          missing_tables: missingTables,
          all_tables: existingTables
        },
        users_table: usersTableInfo ? {
          exists: true,
          columns: usersTableInfo
        } : {
          exists: false,
          message: 'Users table not found'
        }
      }
    });
    
  } catch (error) {
    console.error('Database test error:', error);
    res.status(500).json({
      success: false,
      message: 'Database connection test failed',
      error: {
        message: error.message,
        code: error.code,
        detail: error.detail
      }
    });
  }
});
// เพิ่มโค้ดนี้ใน server.js หลังจาก database test endpoint

// Import auth middleware
const { authMiddleware, requireAdmin, requireAdminOrInstructor } = require('./src/middleware/auth');

// Test endpoint สำหรับ public access (ไม่ต้อง authentication)
app.get('/test-public', (req, res) => {
  res.json({
    success: true,
    message: 'Public endpoint accessible',
    timestamp: new Date().toISOString(),
    user: req.user || null
  });
});

// Test endpoint สำหรับ protected access (ต้องใช้ authentication)
app.get('/test-protected', authMiddleware, (req, res) => {
  res.json({
    success: true,
    message: 'Protected endpoint accessible - Authentication working!',
    user: {
      userId: req.user.userId,
      username: req.user.username,
      email: req.user.email,
      role: req.user.role
    },
    timestamp: new Date().toISOString()
  });
});

// Test endpoint สำหรับ admin only
app.get('/test-admin', authMiddleware, requireAdmin, (req, res) => {
  res.json({
    success: true,
    message: 'Admin endpoint accessible - Admin role working!',
    user: req.user,
    timestamp: new Date().toISOString()
  });
});

// Test endpoint สำหรับ admin หรือ instructor
app.get('/test-admin-instructor', authMiddleware, requireAdminOrInstructor, (req, res) => {
  res.json({
    success: true,
    message: 'Admin/Instructor endpoint accessible - Role checking working!',
    user: req.user,
    timestamp: new Date().toISOString()
  });
});

// Test endpoint สำหรับสร้าง JWT token (temporary - เพื่อทดสอบ)
app.post('/test-create-token', async (req, res) => {
  try {
    const jwt = require('jsonwebtoken');
    const { jwtSecret } = require('./src/config/auth');
    const { username, role = 'admin' } = req.body;
    
    if (!username) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุ username'
      });
    }
    
    // สร้าง mock user data
    const mockUser = {
      userId: 1,
      username: username,
      email: `${username}@test.com`,
      role: role
    };
    
    // สร้าง JWT token
    const token = jwt.sign(
      { 
        userId: mockUser.userId,
        username: mockUser.username,
        role: mockUser.role 
      },
      jwtSecret,
      { expiresIn: '24h' }
    );
    
    res.json({
      success: true,
      message: 'Test token created successfully',
      token: token,
      user: mockUser,
      instructions: {
        how_to_use: 'Add this header to your requests:',
        header: `Authorization: Bearer ${token}`,
        test_endpoints: [
          'GET /test-protected',
          'GET /test-admin',
          'GET /test-admin-instructor'
        ]
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating test token',
      error: error.message
    });
  }
});
// เพิ่มโค้ดนี้ใน server.js หลังจาก authentication test endpoints

// Test endpoint สำหรับ CORS headers
app.get('/test-cors', (req, res) => {
  res.json({
    success: true,
    message: 'CORS test endpoint',
    headers_received: {
      origin: req.get('Origin'),
      user_agent: req.get('User-Agent'),
      authorization: req.get('Authorization') ? 'Present' : 'Not present'
    },
    cors_headers_sent: {
      'Access-Control-Allow-Origin': res.get('Access-Control-Allow-Origin'),
      'Access-Control-Allow-Credentials': res.get('Access-Control-Allow-Credentials'),
      'Access-Control-Allow-Methods': res.get('Access-Control-Allow-Methods'),
      'Access-Control-Allow-Headers': res.get('Access-Control-Allow-Headers')
    }
  });
});

// Test endpoint สำหรับ security headers (Helmet)
app.get('/test-security', (req, res) => {
  res.json({
    success: true,
    message: 'Security headers test endpoint',
    security_headers: {
      'X-Content-Type-Options': res.get('X-Content-Type-Options'),
      'X-Frame-Options': res.get('X-Frame-Options'),
      'X-XSS-Protection': res.get('X-XSS-Protection'),
      'Strict-Transport-Security': res.get('Strict-Transport-Security'),
      'Content-Security-Policy': res.get('Content-Security-Policy') || 'Not set (development mode)',
      'Referrer-Policy': res.get('Referrer-Policy'),
      'X-Download-Options': res.get('X-Download-Options'),
      'X-DNS-Prefetch-Control': res.get('X-DNS-Prefetch-Control')
    },
    request_info: {
      ip: req.ip,
      ips: req.ips,
      protocol: req.protocol,
      secure: req.secure,
      user_agent: req.get('User-Agent')
    }
  });
});

// Test endpoint สำหรับ rate limiting
app.get('/test-rate-limit', (req, res) => {
  res.json({
    success: true,
    message: 'Rate limit test endpoint',
    rate_limit_info: {
      'RateLimit-Limit': res.get('RateLimit-Limit'),
      'RateLimit-Remaining': res.get('RateLimit-Remaining'),
      'RateLimit-Reset': res.get('RateLimit-Reset')
    },
    instructions: 'Call this endpoint repeatedly to test rate limiting',
    client_info: {
      ip: req.ip,
      timestamp: new Date().toISOString()
    }
  });
});

// Test endpoint สำหรับ JSON parsing และ validation
app.post('/test-validation', (req, res) => {
  res.json({
    success: true,
    message: 'JSON parsing and validation test',
    received_data: req.body,
    content_type: req.get('Content-Type'),
    content_length: req.get('Content-Length'),
    test_results: {
      json_parsing: req.body ? 'SUCCESS' : 'FAILED',
      body_size_limit: req.get('Content-Length') ? `${req.get('Content-Length')} bytes` : 'Unknown'
    }
  });
});

// Test summary endpoint
app.get('/test-summary', (req, res) => {
  res.json({
    success: true,
    message: 'Test Summary - All available test endpoints',
    test_endpoints: {
      authentication: {
        public: '/test-public - No authentication required',
        protected: '/test-protected - Requires valid JWT token',
        admin_only: '/test-admin - Requires admin role',
        admin_instructor: '/test-admin-instructor - Requires admin or instructor role',
        create_token: 'POST /test-create-token - Create test JWT token'
      },
      security: {
        cors: '/test-cors - Test CORS headers',
        security_headers: '/test-security - Test Helmet security headers',
        rate_limit: '/test-rate-limit - Test rate limiting',
        validation: 'POST /test-validation - Test JSON validation'
      },
      database: {
        connection: '/test-db - Test database connection and tables'
      },
      system: {
        health: '/health - System health check',
        api_info: '/api - API information'
      }
    },
    how_to_test: {
      step1: 'Test public endpoints first',
      step2: 'Create a test token using POST /test-create-token',
      step3: 'Use the token to test protected endpoints',
      step4: 'Test CORS by making requests from different origins',
      step5: 'Test rate limiting by making many requests quickly'
    }
  });
});
//--------------------------------------------------------------------------------------------------------------------------------------------
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
