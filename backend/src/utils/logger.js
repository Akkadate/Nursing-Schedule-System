const winston = require('winston');
const path = require('path');

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom format for logs
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    
    if (stack) {
      log += `\nStack: ${stack}`;
    }
    
    if (Object.keys(meta).length > 0) {
      log += `\nMeta: ${JSON.stringify(meta, null, 2)}`;
    }
    
    return log;
  })
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, stack }) => {
    let log = `${timestamp} ${level}: ${message}`;
    if (stack) {
      log += `\n${stack}`;
    }
    return log;
  })
);

// Create logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: customFormat,
  defaultMeta: { service: 'nursing-schedule-backend' },
  transports: [
    // Error logs
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true
    }),
    
    // Combined logs
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true
    }),
    
    // Daily rotating logs
    new winston.transports.File({
      filename: path.join(logsDir, 'daily.log'),
      datePattern: 'YYYY-MM-DD',
      maxsize: 20971520, // 20MB
      maxFiles: '14d' // Keep logs for 14 days
    })
  ]
});

// Add console transport for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat
  }));
}

// Add request logging middleware
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  // Log request
  logger.info('Incoming request', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user ? req.user.userId : null
  });
  
  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logLevel = res.statusCode >= 400 ? 'warn' : 'info';
    
    logger.log(logLevel, 'Request completed', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userId: req.user ? req.user.userId : null
    });
  });
  
  next();
};

// Database query logger
const queryLogger = (query, params, duration) => {
  logger.debug('Database query', {
    query: query.replace(/\s+/g, ' ').trim(),
    params: params,
    duration: `${duration}ms`
  });
};

// Authentication logger
const authLogger = {
  loginSuccess: (userId, username, ip) => {
    logger.info('Login successful', {
      userId,
      username,
      ip,
      event: 'LOGIN_SUCCESS'
    });
  },
  
  loginFailed: (username, ip, reason) => {
    logger.warn('Login failed', {
      username,
      ip,
      reason,
      event: 'LOGIN_FAILED'
    });
  },
  
  logout: (userId, username, ip) => {
    logger.info('User logged out', {
      userId,
      username,
      ip,
      event: 'LOGOUT'
    });
  },
  
  tokenExpired: (userId, ip) => {
    logger.warn('Token expired', {
      userId,
      ip,
      event: 'TOKEN_EXPIRED'
    });
  }
};

// Schedule conflict logger
const scheduleLogger = {
  conflictDetected: (conflictType, details) => {
    logger.warn('Schedule conflict detected', {
      conflictType,
      details,
      event: 'SCHEDULE_CONFLICT'
    });
  },
  
  scheduleCreated: (scheduleId, userId, details) => {
    logger.info('Schedule created', {
      scheduleId,
      userId,
      details,
      event: 'SCHEDULE_CREATED'
    });
  },
  
  scheduleUpdated: (scheduleId, userId, changes) => {
    logger.info('Schedule updated', {
      scheduleId,
      userId,
      changes,
      event: 'SCHEDULE_UPDATED'
    });
  },
  
  scheduleDeleted: (scheduleId, userId) => {
    logger.info('Schedule deleted', {
      scheduleId,
      userId,
      event: 'SCHEDULE_DELETED'
    });
  }
};

// System health logger
const healthLogger = {
  databaseConnected: () => {
    logger.info('Database connection established', {
      event: 'DB_CONNECTED'
    });
  },
  
  databaseError: (error) => {
    logger.error('Database connection error', {
      error: error.message,
      event: 'DB_ERROR'
    });
  },
  
  serverStarted: (port) => {
    logger.info(`Server started on port ${port}`, {
      port,
      event: 'SERVER_START'
    });
  },
  
  serverError: (error) => {
    logger.error('Server error', {
      error: error.message,
      stack: error.stack,
      event: 'SERVER_ERROR'
    });
  }
};

// Performance logger
const performanceLogger = {
  slowQuery: (query, duration) => {
    logger.warn('Slow database query detected', {
      query: query.replace(/\s+/g, ' ').trim(),
      duration: `${duration}ms`,
      event: 'SLOW_QUERY'
    });
  },
  
  slowRequest: (method, url, duration) => {
    logger.warn('Slow request detected', {
      method,
      url,
      duration: `${duration}ms`,
      event: 'SLOW_REQUEST'
    });
  }
};

module.exports = {
  logger,
  requestLogger,
  queryLogger,
  authLogger,
  scheduleLogger,
  healthLogger,
  performanceLogger
};
