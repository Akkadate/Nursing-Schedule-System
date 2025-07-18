const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/auth');
const { query } = require('../config/database');

// Main authentication middleware
const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'ไม่พบ token การยืนยันตัวตน'
      });
    }
    
    // Verify JWT token
    const decoded = jwt.verify(token, jwtSecret);
    
    // Check if user still exists and is active
    const userResult = await query(
      'SELECT user_id, username, email, role, status FROM users WHERE user_id = $1',
      [decoded.userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'ผู้ใช้งานไม่พบในระบบ'
      });
    }
    
    const user = userResult.rows[0];
    
    if (user.status !== 'active') {
      return res.status(401).json({
        success: false,
        message: 'บัญชีผู้ใช้ถูกระงับการใช้งาน'
      });
    }
    
    // Add user info to request
    req.user = {
      userId: user.user_id,
      username: user.username,
      email: user.email,
      role: user.role
    };
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Token ไม่ถูกต้อง'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token หมดอายุแล้ว'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์'
    });
  }
};

// Middleware for role-based access control
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'กรุณาเข้าสู่ระบบก่อน'
      });
    }
    
    // Convert single role to array
    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'ไม่มีสิทธิ์เข้าถึงข้อมูลนี้'
      });
    }
    
    next();
  };
};

// Middleware to require admin role
const requireAdmin = requireRole('admin');

// Middleware to allow admin or instructor roles
const requireAdminOrInstructor = requireRole(['admin', 'instructor']);

// Optional authentication (for public endpoints that enhance with user info)
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      req.user = null;
      return next();
    }
    
    const decoded = jwt.verify(token, jwtSecret);
    
    const userResult = await query(
      'SELECT user_id, username, email, role, status FROM users WHERE user_id = $1',
      [decoded.userId]
    );
    
    if (userResult.rows.length > 0 && userResult.rows[0].status === 'active') {
      const user = userResult.rows[0];
      req.user = {
        userId: user.user_id,
        username: user.username,
        email: user.email,
        role: user.role
      };
    } else {
      req.user = null;
    }
    
    next();
  } catch (error) {
    req.user = null;
    next();
  }
};

module.exports = {
  authMiddleware,
  requireRole,
  requireAdmin,
  requireAdminOrInstructor,
  optionalAuth
};
