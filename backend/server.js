require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Import configurations
const { testConnection } = require('./src/config/database');
const { validateAuthConfig } = require('./src/config/auth');

// Import middleware
const { requestLogger, logger, healthLogger } = require('./src/utils/logger');
const { errorHandler, notFound } = require('./src/middleware/errorHandler');

// Create Express app
const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production',
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      process.env.FRONTEND_URL,
      'http://localhost:7210',
      'http://127.0.0.1:7210'
    ];
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'คำขอเกินจำนวนที่อนุญาต กรุณาลองใหม่ภายหลัง'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(requestLogger);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API version info
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'Nursing Schedule System API',
    version: '1.0.0',
    description: 'ระบบจัดตารางฝึกปฏิบัติ - นักศึกษาพยาบาล',
    endpoints: {
      health: '/health',
      auth: '/api/auth/*',
      users: '/api/users/*',
      students: '/api/students/*',
      instructors: '/api/instructors/*',
      schedules: '/api/schedules/*',
      courses: '/api/courses/*',
      locations: '/api/locations/*'
    }
  });
});

// เพิ่มโค้ดนี้ใน server.js หลังจาก health check endpoint

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

// API Routes (จะเพิ่มเมื่อสร้าง routes)
// app.use('/api/auth', require('./src/routes/auth'));
// app.use('/api/users', require('./src/routes/users'));
// app.use('/api/students', require('./src/routes/students'));
// app.use('/api/instructors', require('./src/routes/instructors'));
// app.use('/api/schedules', require('./src/routes/schedules'));
// app.use('/api/courses', require('./src/routes/courses'));
// app.use('/api/locations', require('./src/routes/locations'));

// 404 handler for undefined routes
app.use(notFound);

// Global error handler
app.use(errorHandler);

// Initialize server
const PORT = process.env.PORT || 7110;

const startServer = async () => {
  try {
    // Validate configuration
    console.log('🔧 Validating configuration...');
    validateAuthConfig();
    
    // Test database connection
    console.log('🔌 Testing database connection...');
    const dbConnected = await testConnection();
    
    if (!dbConnected) {
      throw new Error('Database connection failed');
    }
    
    // Start server
    const server = app.listen(PORT, () => {
      console.log('🚀 ========================================');
      console.log(`🏥 Nursing Schedule System Backend`);
      console.log(`🌟 Server running on port ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`📊 Database: Connected to ${process.env.DB_HOST}`);
      console.log(`🔐 JWT Authentication: Enabled`);
      console.log(`🛡️  Security: Helmet, CORS, Rate Limiting`);
      console.log(`📝 Logging: Winston (Level: ${process.env.LOG_LEVEL || 'info'})`);
      console.log('🚀 ========================================');
      
      healthLogger.serverStarted(PORT);
    });

    // Graceful shutdown
    const gracefulShutdown = (signal) => {
      console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
      
      server.close((err) => {
        if (err) {
          console.error('❌ Error during server shutdown:', err);
          process.exit(1);
        }
        
        console.log('✅ Server closed successfully');
        console.log('👋 Goodbye!');
        process.exit(0);
      });
    };

    // Handle process termination
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (err) => {
      console.error('❌ Uncaught Exception:', err);
      healthLogger.serverError(err);
      process.exit(1);
    });
    
    // Handle unhandled promise rejections
    process.on('unhandledRejection', (err) => {
      console.error('❌ Unhandled Rejection:', err);
      healthLogger.serverError(err);
      process.exit(1);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    healthLogger.serverError(error);
    process.exit(1);
  }
};

// Start the server
startServer();
