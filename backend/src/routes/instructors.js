const express = require('express');
const router = express.Router();
const instructorController = require('../controllers/instructorController');
const { authMiddleware, requireAdmin, requireAdminOrInstructor } = require('../middleware/auth');
const { validationRules, handleValidationErrors } = require('../middleware/validation');

// ทุก route ต้องผ่าน authentication
router.use(authMiddleware);

// GET /api/instructors - ดูรายชื่ออาจารย์ทั้งหมด (admin และ instructor)
router.get('/', 
  requireAdminOrInstructor,
  validationRules.pagination,
  handleValidationErrors,
  instructorController.getAll
);

// GET /api/instructors/:id - ดูข้อมูลอาจารย์รายคน (admin และ instructor)
router.get('/:id', 
  requireAdminOrInstructor,
  validationRules.idParam,
  handleValidationErrors,
  instructorController.getById
);

// POST /api/instructors - เพิ่มอาจารย์ใหม่ (admin only)
router.post('/', 
  requireAdmin,
  [
    require('express-validator').body('userId')
      .isInt({ min: 1 })
      .withMessage('กรุณาเลือกผู้ใช้'),
    require('express-validator').body('instructorCode')
      .optional()
      .isLength({ max: 20 })
      .withMessage('รหัสอาจารย์ไม่เกิน 20 ตัวอักษร'),
    require('express-validator').body('title')
      .optional()
      .isLength({ max: 50 })
      .withMessage('คำนำหน้าไม่เกิน 50 ตัวอักษร'),
    require('express-validator').body('department')
      .optional()
      .isLength({ max: 100 })
      .withMessage('ภาควิชาไม่เกิน 100 ตัวอักษร'),
    require('express-validator').body('specialization')
      .optional()
      .isLength({ max: 200 })
      .withMessage('ความเชี่ยวชาญไม่เกิน 200 ตัวอักษร'),
    require('express-validator').body('maxStudentsPerSession')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('จำนวนนักศึกษาสูงสุดต่อรอบต้องเป็น 1-100')
  ],
  handleValidationErrors,
  instructorController.create
);

// PUT /api/instructors/:id - แก้ไขข้อมูลอาจารย์ (admin only)
router.put('/:id', 
  requireAdmin,
  validationRules.idParam,
  [
    require('express-validator').body('title')
      .optional()
      .isLength({ max: 50 })
      .withMessage('คำนำหน้าไม่เกิน 50 ตัวอักษร'),
    require('express-validator').body('department')
      .optional()
      .isLength({ max: 100 })
      .withMessage('ภาควิชาไม่เกิน 100 ตัวอักษร'),
    require('express-validator').body('specialization')
      .optional()
      .isLength({ max: 200 })
      .withMessage('ความเชี่ยวชาญไม่เกิน 200 ตัวอักษร'),
    require('express-validator').body('maxStudentsPerSession')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('จำนวนนักศึกษาสูงสุดต่อรอบต้องเป็น 1-100')
  ],
  handleValidationErrors,
  instructorController.update
);

// DELETE /api/instructors/:id - ลบอาจารย์ (admin only)
router.delete('/:id', 
  requireAdmin,
  validationRules.idParam,
  handleValidationErrors,
  instructorController.delete
);

// GET /api/instructors/:id/schedule - ดูตารางสอนของอาจารย์ (admin และ instructor ที่เป็นเจ้าของ)
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
  handleValidationErrors,
  instructorController.getSchedule
);

// GET /api/instructors/:id/students - ดูนักศึกษาที่อาจารย์ดูแล (admin และ instructor ที่เป็นเจ้าของ)
router.get('/:id/students', 
  requireAdminOrInstructor,
  validationRules.idParam,
  validationRules.pagination,
  handleValidationErrors,
  instructorController.getStudents
);

module.exports = router;
