const logger = require('../utils/logger');

// Error types for consistent error handling
const ErrorTypes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  DATABASE_ERROR: 'DATABASE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  CONFLICT: 'CONFLICT',
  BAD_REQUEST: 'BAD_REQUEST'
};

// Custom error class
class AppError extends Error {
  constructor(message, statusCode, type = ErrorTypes.INTERNAL_ERROR) {
    super(message);
    this.statusCode = statusCode;
    this.type = type;
    this.isOperational = true;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

// Error response helper
const sendError = (res, type, message, statusCode = 500, details = null) => {
  const errorMap = {
    [ErrorTypes.VALIDATION_ERROR]: 400,
    [ErrorTypes.BAD_REQUEST]: 400,
    [ErrorTypes.UNAUTHORIZED]: 401,
    [ErrorTypes.FORBIDDEN]: 403,
    [ErrorTypes.NOT_FOUND]: 404,
    [ErrorTypes.CONFLICT]: 409,
    [ErrorTypes.DATABASE_ERROR]: 500,
    [ErrorTypes.INTERNAL_ERROR]: 500
  };
  
  const status = statusCode || errorMap[type] || 500;
  
  const response = {
    success: false,
    message: message,
    error: type
  };
  
  if (details && process.env.NODE_ENV === 'development') {
    response.details = details;
  }
  
  res.status(status).json(response);
};

// Development error response (includes stack trace)
const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    success: false,
    message: err.message,
    error: err.type || 'UNKNOWN_ERROR',
    stack: err.stack,
    details: err
  });
};

// Production error response (limited info)
const sendErrorProd = (err, res) => {
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      error: err.type
    });
  } else {
    // Programming or other unknown error: don't leak error details
    logger.error('Unexpected error:', err);
    
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง',
      error: 'INTERNAL_ERROR'
    });
  }
};

// Handle specific database errors
const handleDatabaseError = (err) => {
  let message = 'เกิดข้อผิดพลาดในฐานข้อมูล';
  let statusCode = 500;
  let type = ErrorTypes.DATABASE_ERROR;
  
  // PostgreSQL error codes
  if (err.code) {
    switch (err.code) {
      case '23505': // unique_violation
        message = 'ข้อมูลซ้ำกับที่มีอยู่แล้วในระบบ';
        statusCode = 409;
        type = ErrorTypes.CONFLICT;
        break;
      case '23503': // foreign_key_violation
        message = 'ไม่สามารถดำเนินการได้ เนื่องจากข้อมูลมีการเชื่อมโยงกับข้อมูลอื่น';
        statusCode = 400;
        type = ErrorTypes.BAD_REQUEST;
        break;
      case '23502': // not_null_violation
        message = 'ข้อมูลที่จำเป็นขาดหายไป';
        statusCode = 400;
        type = ErrorTypes.VALIDATION_ERROR;
        break;
      case '42P01': // undefined_table
        message = 'ตารางข้อมูลไม่พบ';
        break;
      case '42703': // undefined_column
        message = 'คอลัมน์ข้อมูลไม่พบ';
        break;
    }
  }
  
  return new AppError(message, statusCode, type);
};

// Handle JSON Web Token errors
const handleJWTError = () =>
  new AppError('Token ไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่', 401, ErrorTypes.UNAUTHORIZED);

const handleJWTExpiredError = () =>
  new AppError('Token หมดอายุแล้ว กรุณาเข้าสู่ระบบใหม่', 401, ErrorTypes.UNAUTHORIZED);

// Main error handling middleware
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;
  
  // Log error
  logger.error({
    error: err,
    request: {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      user: req.user ? req.user.userId : 'Anonymous'
    }
  });
  
  // Handle specific error types
  if (err.name === 'CastError') {
    const message = 'รูปแบบข้อมูลไม่ถูกต้อง';
    error = new AppError(message, 400, ErrorTypes.BAD_REQUEST);
  }
  
  if (err.code && err.code.startsWith('23')) {
    error = handleDatabaseError(err);
  }
  
  if (err.name === 'JsonWebTokenError') {
    error = handleJWTError();
  }
  
  if (err.name === 'TokenExpiredError') {
    error = handleJWTExpiredError();
  }
  
  if (err.name === 'ValidationError') {
    const message = 'ข้อมูลไม่ถูกต้อง';
    error = new AppError(message, 400, ErrorTypes.VALIDATION_ERROR);
  }
  
  // Handle multer errors (file upload)
  if (err.code === 'LIMIT_FILE_SIZE') {
    error = new AppError('ไฟล์มีขนาดใหญ่เกินไป', 400, ErrorTypes.BAD_REQUEST);
  }
  
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    error = new AppError('รูปแบบไฟล์ไม่ถูกต้อง', 400, ErrorTypes.BAD_REQUEST);
  }
  
  // Send appropriate error response
  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(error, res);
  } else {
    sendErrorProd(error, res);
  }
};

// 404 handler for undefined routes
const notFound = (req, res, next) => {
  const message = `ไม่พบเส้นทาง ${req.originalUrl}`;
  const error = new AppError(message, 404, ErrorTypes.NOT_FOUND);
  next(error);
};

// Async error handler wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
  AppError,
  ErrorTypes,
  sendError,
  errorHandler,
  notFound,
  asyncHandler
};
