const { body, query, param, validationResult } = require('express-validator');

// Handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.path,
      message: error.msg,
      value: error.value
    }));
    
    return res.status(400).json({
      success: false,
      message: 'ข้อมูลที่ส่งมาไม่ถูกต้อง',
      errors: errorMessages
    });
  }
  
  next();
};

// Common validation rules
const validationRules = {
  // User validation
  userCreate: [
    body('username')
      .isLength({ min: 3, max: 50 })
      .withMessage('ชื่อผู้ใช้ต้องมีความยาว 3-50 ตัวอักษร')
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('ชื่อผู้ใช้ใช้ได้เฉพาะ a-z, A-Z, 0-9 และ _'),
    body('email')
      .isEmail()
      .withMessage('รูปแบบอีเมลไม่ถูกต้อง'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร')
      .matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('รหัสผ่านต้องมีตัวพิมพ์เล็ก พิมพ์ใหญ่ และตัวเลข'),
    body('first_name')
      .notEmpty()
      .withMessage('กรุณากรอกชื่อ')
      .isLength({ max: 100 })
      .withMessage('ชื่อไม่เกิน 100 ตัวอักษร'),
    body('last_name')
      .notEmpty()
      .withMessage('กรุณากรอกนามสกุล')
      .isLength({ max: 100 })
      .withMessage('นามสกุลไม่เกิน 100 ตัวอักษร'),
    body('role')
      .isIn(['admin', 'instructor'])
      .withMessage('บทบาทต้องเป็น admin หรือ instructor')
  ],

  userUpdate: [
    body('email')
      .optional()
      .isEmail()
      .withMessage('รูปแบบอีเมลไม่ถูกต้อง'),
    body('first_name')
      .optional()
      .notEmpty()
      .withMessage('ชื่อไม่สามารถเป็นค่าว่างได้')
      .isLength({ max: 100 })
      .withMessage('ชื่อไม่เกิน 100 ตัวอักษร'),
    body('last_name')
      .optional()
      .notEmpty()
      .withMessage('นามสกุลไม่สามารถเป็นค่าว่างได้')
      .isLength({ max: 100 })
      .withMessage('นามสกุลไม่เกิน 100 ตัวอักษร'),
    body('role')
      .optional()
      .isIn(['admin', 'instructor'])
      .withMessage('บทบาทต้องเป็น admin หรือ instructor')
  ],

  // Student validation
  studentCreate: [
    body('student_code')
      .notEmpty()
      .withMessage('กรุณากรอกรหัสนักศึกษา')
      .isLength({ max: 20 })
      .withMessage('รหัสนักศึกษาไม่เกิน 20 ตัวอักษร'),
    body('first_name')
      .notEmpty()
      .withMessage('กรุณากรอกชื่อ')
      .isLength({ max: 100 })
      .withMessage('ชื่อไม่เกิน 100 ตัวอักษร'),
    body('last_name')
      .notEmpty()
      .withMessage('กรุณากรอกนามสกุล')
      .isLength({ max: 100 })
      .withMessage('นามสกุลไม่เกิน 100 ตัวอักษร'),
    body('email')
      .optional()
      .isEmail()
      .withMessage('รูปแบบอีเมลไม่ถูกต้อง'),
    body('year_level')
      .isInt({ min: 1, max: 4 })
      .withMessage('ชั้นปีต้องเป็น 1-4')
  ],

  // Schedule validation
  scheduleCreate: [
    body('course_id')
      .isInt({ min: 1 })
      .withMessage('กรุณาเลือกรายวิชา'),
    body('activity_type_id')
      .isInt({ min: 1 })
      .withMessage('กรุณาเลือกประเภทกิจกรรม'),
    body('instructor_id')
      .isInt({ min: 1 })
      .withMessage('กรุณาเลือกอาจารย์'),
    body('location_id')
      .isInt({ min: 1 })
      .withMessage('กรุณาเลือกสถานที่'),
    body('schedule_date')
      .isISO8601()
      .withMessage('รูปแบบวันที่ไม่ถูกต้อง'),
    body('start_time')
      .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage('รูปแบบเวลาเริ่มต้นไม่ถูกต้อง (HH:MM)'),
    body('end_time')
      .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage('รูปแบบเวลาสิ้นสุดไม่ถูกต้อง (HH:MM)'),
    body('max_students')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('จำนวนนักศึกษาสูงสุดต้องเป็น 1-100')
  ],

  // Login validation
  login: [
    body('username')
      .notEmpty()
      .withMessage('กรุณากรอกชื่อผู้ใช้'),
    body('password')
      .notEmpty()
      .withMessage('กรุณากรอกรหัสผ่าน')
  ],

  // Change password validation
  changePassword: [
    body('currentPassword')
      .notEmpty()
      .withMessage('กรุณากรอกรหัสผ่านปัจจุบัน'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร')
      .matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('รหัสผ่านใหม่ต้องมีตัวพิมพ์เล็ก พิมพ์ใหญ่ และตัวเลข'),
    body('confirmPassword')
      .custom((value, { req }) => {
        if (value !== req.body.newPassword) {
          throw new Error('การยืนยันรหัสผ่านไม่ตรงกัน');
        }
        return true;
      })
  ],

  // Pagination validation
  pagination: [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('หมายเลขหน้าต้องเป็นตัวเลขที่มากกว่า 0'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('จำนวนรายการต่อหน้าต้องเป็น 1-100')
  ],

  // ID parameter validation
  idParam: [
    param('id')
      .isInt({ min: 1 })
      .withMessage('ID ต้องเป็นตัวเลขที่มากกว่า 0')
  ]
};

// Custom validation functions
const customValidations = {
  // Check if email already exists (for registration)
  emailExists: async (email, { req }) => {
    const { query } = require('../config/database');
    const result = await query('SELECT user_id FROM users WHERE email = $1', [email]);
    
    if (result.rows.length > 0) {
      // If updating, allow same email for same user
      if (req.method === 'PUT' && req.params.id && 
          result.rows[0].user_id === parseInt(req.params.id)) {
        return true;
      }
      throw new Error('อีเมลนี้มีการใช้งานแล้ว');
    }
    return true;
  },

  // Check if username already exists
  usernameExists: async (username, { req }) => {
    const { query } = require('../config/database');
    const result = await query('SELECT user_id FROM users WHERE username = $1', [username]);
    
    if (result.rows.length > 0) {
      if (req.method === 'PUT' && req.params.id && 
          result.rows[0].user_id === parseInt(req.params.id)) {
        return true;
      }
      throw new Error('ชื่อผู้ใช้นี้มีการใช้งานแล้ว');
    }
    return true;
  },

  // Validate time range
  timeRange: (endTime, { req }) => {
    const startTime = req.body.start_time;
    if (startTime && endTime) {
      const start = new Date(`2000-01-01 ${startTime}`);
      const end = new Date(`2000-01-01 ${endTime}`);
      
      if (end <= start) {
        throw new Error('เวลาสิ้นสุดต้องมากกว่าเวลาเริ่มต้น');
      }
    }
    return true;
  }
};

module.exports = {
  validationRules,
  customValidations,
  handleValidationErrors
};
