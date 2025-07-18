const express = require('express');
const router = express.Router();
const locationController = require('../controllers/locationController');
const { authMiddleware, requireAdmin, requireAdminOrInstructor } = require('../middleware/auth');
const { validationRules, handleValidationErrors } = require('../middleware/validation');

// ทุก route ต้องผ่าน authentication
router.use(authMiddleware);

// GET /api/locations - ดูสถานที่ทั้งหมด (admin และ instructor)
router.get('/', 
  requireAdminOrInstructor,
  validationRules.pagination,
  handleValidationErrors,
  locationController.getAll
);

// GET /api/locations/:id - ดูข้อมูลสถานที่ (admin และ instructor)
router.get('/:id', 
  requireAdminOrInstructor,
  validationRules.idParam,
  handleValidationErrors,
  locationController.getById
);

// POST /api/locations - เพิ่มสถานที่ใหม่ (admin only)
router.post('/', 
  requireAdmin,
  [
    require('express-validator').body('locationName')
      .notEmpty()
      .withMessage('กรุณากรอกชื่อสถานที่')
      .isLength({ max: 200 })
      .withMessage('ชื่อสถานที่ไม่เกิน 200 ตัวอักษร'),
    require('express-validator').body('roomNumber')
      .notEmpty()
      .withMessage('กรุณากรอกหมายเลขห้อง')
      .isLength({ max: 20 })
      .withMessage('หมายเลขห้องไม่เกิน 20 ตัวอักษร'),
    require('express-validator').body('building')
      .notEmpty()
      .withMessage('กรุณากรอกชื่ออาคาร')
      .isLength({ max: 100 })
      .withMessage('ชื่ออาคารไม่เกิน 100 ตัวอักษร'),
    require('express-validator').body('floor')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('ชั้นต้องเป็นตัวเลข 1-50'),
    require('express-validator').body('capacity')
      .optional()
      .isInt({ min: 1, max: 500 })
      .withMessage('ความจุต้องเป็น 1-500'),
    require('express-validator').body('equipmentAvailable')
      .optional()
      .isLength({ max: 1000 })
      .withMessage('รายการอุปกรณ์ไม่เกิน 1000 ตัวอักษร'),
    require('express-validator').body('description')
      .optional()
      .isLength({ max: 1000 })
      .withMessage('คำอธิบายไม่เกิน 1000 ตัวอักษร')
  ],
  handleValidationErrors,
  locationController.create
);

// PUT /api/locations/:id - แก้ไขสถานที่ (admin only)
router.put('/:id', 
  requireAdmin,
  validationRules.idParam,
  [
    require('express-validator').body('locationName')
      .optional()
      .notEmpty()
      .withMessage('ชื่อสถานที่ไม่สามารถเป็นค่าว่างได้')
      .isLength({ max: 200 })
      .withMessage('ชื่อสถานที่ไม่เกิน 200 ตัวอักษร'),
    require('express-validator').body('capacity')
      .optional()
      .isInt({ min: 1, max: 500 })
      .withMessage('ความจุต้องเป็น 1-500'),
    require('express-validator').body('equipmentAvailable')
      .optional()
      .isLength({ max: 1000 })
      .withMessage('รายการอุปกรณ์ไม่เกิน 1000 ตัวอักษร'),
    require('express-validator').body('description')
      .optional()
      .isLength({ max: 1000 })
      .withMessage('คำอธิบายไม่เกิน 1000 ตัวอักษร'),
    require('express-validator').body('status')
      .optional()
      .isIn(['active', 'inactive', 'maintenance'])
      .withMessage('สถานะต้องเป็น active, inactive หรือ maintenance')
  ],
  handleValidationErrors,
  locationController.update
);

// DELETE /api/locations/:id - ลบสถานที่ (admin only)
router.delete('/:id', 
  requireAdmin,
  validationRules.idParam,
  handleValidationErrors,
  locationController.delete
);

// GET /api/locations/:id/schedule - ดูตารางการใช้งานสถานที่ (admin และ instructor)
router.get('/:id/schedule', 
  requireAdminOrInstructor,
  validationRules.idParam,
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
  validationRules.pagination,
  handleValidationErrors,
  locationController.getSchedule
);

// GET /api/locations/availability - ตรวจสอบความพร้อมใช้งานของสถานที่ (admin และ instructor)
router.get('/availability', 
  requireAdminOrInstructor,
  [
    require('express-validator').query('date')
      .notEmpty()
      .withMessage('กรุณาระบุวันที่')
      .isISO8601()
      .withMessage('รูปแบบวันที่ไม่ถูกต้อง'),
    require('express-validator').query('startTime')
      .notEmpty()
      .withMessage('กรุณาระบุเวลาเริ่มต้น')
      .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage('รูปแบบเวลาเริ่มต้นไม่ถูกต้อง (HH:MM)'),
    require('express-validator').query('endTime')
      .notEmpty()
      .withMessage('กรุณาระบุเวลาสิ้นสุด')
      .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage('รูปแบบเวลาสิ้นสุดไม่ถูกต้อง (HH:MM)'),
    require('express-validator').query('excludeScheduleId')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Schedule ID ต้องเป็นตัวเลขที่มากกว่า 0')
  ],
  handleValidationErrors,
  locationController.checkAvailability
);

// GET /api/locations/buildings - ดูรายชื่ออาคารทั้งหมด (admin และ instructor)
router.get('/buildings', 
  requireAdminOrInstructor,
  locationController.getBuildings
);

module.exports = router;
