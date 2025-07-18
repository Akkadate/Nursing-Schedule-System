const express = require('express');
const router = express.Router();
const scheduleController = require('../controllers/scheduleController');
const { authMiddleware, requireAdmin, requireAdminOrInstructor } = require('../middleware/auth');
const { validationRules, handleValidationErrors } = require('../middleware/validation');

// ทุก route ต้องผ่าน authentication
router.use(authMiddleware);

// GET /api/schedules - ดูตารางทั้งหมด (admin และ instructor)
router.get('/', 
  requireAdminOrInstructor,
  [
    require('express-validator').query('startDate')
      .optional()
      .isISO8601()
      .withMessage('รูปแบบวันที่เริ่มต้นไม่ถูกต้อง'),
    require('express-validator').query('endDate')
      .optional()
      .isISO8601()
      .withMessage('รูปแบบวันที่สิ้นสุดไม่ถูกต้อง'),
    require('express-validator').query('instructorId')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Instructor ID ต้องเป็นตัวเลขที่มากกว่า 0'),
    require('express-validator').query('courseId')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Course ID ต้องเป็นตัวเลขที่มากกว่า 0'),
    require('express-validator').query('locationId')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Location ID ต้องเป็นตัวเลขที่มากกว่า 0'),
    require('express-validator').query('groupId')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Group ID ต้องเป็นตัวเลขที่มากกว่า 0'),
    require('express-validator').query('status')
      .optional()
      .isIn(['scheduled', 'completed', 'cancelled'])
      .withMessage('สถานะต้องเป็น scheduled, completed หรือ cancelled')
  ],
  validationRules.pagination,
  handleValidationErrors,
  scheduleController.getAll
);

// GET /api/schedules/:id - ดูข้อมูลตาราง (admin และ instructor)
router.get('/:id', 
  requireAdminOrInstructor,
  validationRules.idParam,
  handleValidationErrors,
  scheduleController.getById
);

// POST /api/schedules - สร้างตารางใหม่ (admin only)
router.post('/', 
  requireAdmin,
  [
    require('express-validator').body('courseId')
      .isInt({ min: 1 })
      .withMessage('กรุณาเลือกรายวิชา'),
    require('express-validator').body('activityTypeId')
      .isInt({ min: 1 })
      .withMessage('กรุณาเลือกประเภทกิจกรรม'),
    require('express-validator').body('instructorId')
      .isInt({ min: 1 })
      .withMessage('กรุณาเลือกอาจารย์'),
    require('express-validator').body('locationId')
      .isInt({ min: 1 })
      .withMessage('กรุณาเลือกสถานที่'),
    require('express-validator').body('scheduleDate')
      .isISO8601()
      .withMessage('รูปแบบวันที่ไม่ถูกต้อง'),
    require('express-validator').body('startTime')
      .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage('รูปแบบเวลาเริ่มต้นไม่ถูกต้อง (HH:MM)'),
    require('express-validator').body('endTime')
      .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage('รูปแบบเวลาสิ้นสุดไม่ถูกต้อง (HH:MM)')
      .custom((value, { req }) => {
        const startTime = req.body.startTime;
        if (startTime && value) {
          const start = new Date(`2000-01-01 ${startTime}`);
          const end = new Date(`2000-01-01 ${value}`);
          
          if (end <= start) {
            throw new Error('เวลาสิ้นสุดต้องมากกว่าเวลาเริ่มต้น');
          }
        }
        return true;
      }),
    require('express-validator').body('maxStudents')
      .optional()
      .isInt({ min: 1, max: 200 })
      .withMessage('จำนวนนักศึกษาสูงสุดต้องเป็น 1-200'),
    require('express-validator').body('notes')
      .optional()
      .isLength({ max: 1000 })
      .withMessage('หมายเหตุไม่เกิน 1000 ตัวอักษร'),
    require('express-validator').body('groupIds')
      .optional()
      .isArray()
      .withMessage('กลุ่มที่เข้าร่วมต้องเป็น array')
      .custom((value) => {
        if (value && value.some(id => !Number.isInteger(id) || id <= 0)) {
          throw new Error('Group ID ทั้งหมดต้องเป็นตัวเลขที่มากกว่า 0');
        }
        return true;
      })
  ],
  handleValidationErrors,
  scheduleController.create
);

// PUT /api/schedules/:id - แก้ไขตาราง (admin only)
router.put('/:id', 
  requireAdmin,
  validationRules.idParam,
  [
    require('express-validator').body('activityTypeId')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Activity Type ID ต้องเป็นตัวเลขที่มากกว่า 0'),
    require('express-validator').body('instructorId')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Instructor ID ต้องเป็นตัวเลขที่มากกว่า 0'),
    require('express-validator').body('locationId')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Location ID ต้องเป็นตัวเลขที่มากกว่า 0'),
    require('express-validator').body('scheduleDate')
      .optional()
      .isISO8601()
      .withMessage('รูปแบบวันที่ไม่ถูกต้อง'),
    require('express-validator').body('startTime')
      .optional()
      .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage('รูปแบบเวลาเริ่มต้นไม่ถูกต้อง (HH:MM)'),
    require('express-validator').body('endTime')
      .optional()
      .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage('รูปแบบเวลาสิ้นสุดไม่ถูกต้อง (HH:MM)'),
    require('express-validator').body('maxStudents')
      .optional()
      .isInt({ min: 1, max: 200 })
      .withMessage('จำนวนนักศึกษาสูงสุดต้องเป็น 1-200'),
    require('express-validator').body('status')
      .optional()
      .isIn(['scheduled', 'completed', 'cancelled'])
      .withMessage('สถานะต้องเป็น scheduled, completed หรือ cancelled'),
    require('express-validator').body('notes')
      .optional()
      .isLength({ max: 1000 })
      .withMessage('หมายเหตุไม่เกิน 1000 ตัวอักษร'),
    require('express-validator').body('groupIds')
      .optional()
      .isArray()
      .withMessage('กลุ่มที่เข้าร่วมต้องเป็น array')
  ],
  handleValidationErrors,
  scheduleController.update
);

// DELETE /api/schedules/:id - ลบตาราง (admin only)
router.delete('/:id', 
  requireAdmin,
  validationRules.idParam,
  handleValidationErrors,
  scheduleController.delete
);

// GET /api/schedules/conflicts - ตรวจสอบความขัดแย้งในตาราง (admin และ instructor)
router.get('/conflicts', 
  requireAdminOrInstructor,
  [
    require('express-validator').query('startDate')
      .optional()
      .isISO8601()
      .withMessage('รูปแบบวันที่เริ่มต้นไม่ถูกต้อง'),
    require('express-validator').query('endDate')
      .optional()
      .isISO8601()
      .withMessage('รูปแบบวันที่สิ้นสุดไม่ถูกต้อง')
  ],
  handleValidationErrors,
  scheduleController.checkConflicts
);

module.exports = router;
