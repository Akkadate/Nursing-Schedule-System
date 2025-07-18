const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const { authMiddleware, requireAdmin, requireAdminOrInstructor } = require('../middleware/auth');
const { validationRules, handleValidationErrors } = require('../middleware/validation');

// ทุก route ต้องผ่าน authentication
router.use(authMiddleware);

// GET /api/attendance/schedule/:scheduleId - ดูการเข้าร่วมของตาราง (admin และ instructor)
router.get('/schedule/:scheduleId', 
  requireAdminOrInstructor,
  [
    require('express-validator').param('scheduleId')
      .isInt({ min: 1 })
      .withMessage('Schedule ID ต้องเป็นตัวเลขที่มากกว่า 0')
  ],
  handleValidationErrors,
  attendanceController.getBySchedule
);

// GET /api/attendance/student/:studentId - ดูประวัติการเข้าร่วมของนักศึกษา (admin และ instructor)
router.get('/student/:studentId', 
  requireAdminOrInstructor,
  [
    require('express-validator').param('studentId')
      .isInt({ min: 1 })
      .withMessage('Student ID ต้องเป็นตัวเลขที่มากกว่า 0'),
    require('express-validator').query('startDate')
      .optional()
      .isISO8601()
      .withMessage('รูปแบบวันที่เริ่มต้นไม่ถูกต้อง'),
    require('express-validator').query('endDate')
      .optional()
      .isISO8601()
      .withMessage('รูปแบบวันที่สิ้นสุดไม่ถูกต้อง')
  ],
  validationRules.pagination,
  handleValidationErrors,
  attendanceController.getByStudent
);

// POST /api/attendance/schedule/:scheduleId/initialize - สร้างรายการเช็คชื่อเริ่มต้น (admin และ instructor)
router.post('/schedule/:scheduleId/initialize', 
  requireAdminOrInstructor,
  [
    require('express-validator').param('scheduleId')
      .isInt({ min: 1 })
      .withMessage('Schedule ID ต้องเป็นตัวเลขที่มากกว่า 0')
  ],
  handleValidationErrors,
  attendanceController.initializeAttendance
);

// PUT /api/attendance/:attendanceId - อัปเดตการเข้าร่วม (admin และ instructor)
router.put('/:attendanceId', 
  requireAdminOrInstructor,
  [
    require('express-validator').param('attendanceId')
      .isInt({ min: 1 })
      .withMessage('Attendance ID ต้องเป็นตัวเลขที่มากกว่า 0'),
    require('express-validator').body('status')
      .optional()
      .isIn(['present', 'absent', 'late', 'excused'])
      .withMessage('สถานะต้องเป็น present, absent, late หรือ excused'),
    require('express-validator').body('checkInTime')
      .optional()
      .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage('รูปแบบเวลาเช็คอินไม่ถูกต้อง (HH:MM)'),
    require('express-validator').body('checkOutTime')
      .optional()
      .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage('รูปแบบเวลาเช็คเอาท์ไม่ถูกต้อง (HH:MM)'),
    require('express-validator').body('score')
      .optional()
      .isFloat({ min: 0, max: 100 })
      .withMessage('คะแนนต้องเป็น 0-100'),
    require('express-validator').body('notes')
      .optional()
      .isLength({ max: 500 })
      .withMessage('หมายเหตุไม่เกิน 500 ตัวอักษร')
  ],
  handleValidationErrors,
  attendanceController.updateAttendance
);

// POST /api/attendance/bulk-update - อัปเดตการเข้าร่วมหลายคน (admin และ instructor)
router.post('/bulk-update', 
  requireAdminOrInstructor,
  [
    require('express-validator').body('attendanceUpdates')
      .isArray({ min: 1 })
      .withMessage('ข้อมูลการอัปเดตต้องเป็น array และมีอย่างน้อย 1 รายการ'),
    require('express-validator').body('attendanceUpdates.*.attendanceId')
      .isInt({ min: 1 })
      .withMessage('Attendance ID ต้องเป็นตัวเลขที่มากกว่า 0'),
    require('express-validator').body('attendanceUpdates.*.status')
      .optional()
      .isIn(['present', 'absent', 'late', 'excused'])
      .withMessage('สถานะต้องเป็น present, absent, late หรือ excused'),
    require('express-validator').body('attendanceUpdates.*.score')
      .optional()
      .isFloat({ min: 0, max: 100 })
      .withMessage('คะแนนต้องเป็น 0-100')
  ],
  handleValidationErrors,
  attendanceController.bulkUpdateAttendance
);

// GET /api/attendance/reports/summary - รายงานสรุปการเข้าร่วม (admin และ instructor)
router.get('/reports/summary', 
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
    require('express-validator').query('groupId')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Group ID ต้องเป็นตัวเลขที่มากกว่า 0'),
    require('express-validator').query('courseId')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Course ID ต้องเป็นตัวเลขที่มากกว่า 0')
  ],
  handleValidationErrors,
  attendanceController.getAttendanceSummary
);

// GET /api/attendance/reports/student-performance - รายงานผลการเรียนของนักศึกษา (admin และ instructor)
router.get('/reports/student-performance', 
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
    require('express-validator').query('groupId')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Group ID ต้องเป็นตัวเลขที่มากกว่า 0'),
    require('express-validator').query('courseId')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Course ID ต้องเป็นตัวเลขที่มากกว่า 0')
  ],
  validationRules.pagination,
  handleValidationErrors,
  attendanceController.getStudentPerformanceReport
);

module.exports = router;
