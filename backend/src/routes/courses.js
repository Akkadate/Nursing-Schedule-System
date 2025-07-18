const express = require('express');
const router = express.Router();
const courseController = require('../controllers/courseController');
const { authMiddleware, requireAdmin, requireAdminOrInstructor } = require('../middleware/auth');
const { validationRules, handleValidationErrors } = require('../middleware/validation');

// ทุก route ต้องผ่าน authentication
router.use(authMiddleware);

// GET /api/courses - ดูรายวิชาทั้งหมด (admin และ instructor)
router.get('/', 
  requireAdminOrInstructor,
  validationRules.pagination,
  handleValidationErrors,
  courseController.getAll
);

// GET /api/courses/:id - ดูข้อมูลรายวิชา (admin และ instructor)
router.get('/:id', 
  requireAdminOrInstructor,
  validationRules.idParam,
  handleValidationErrors,
  courseController.getById
);

// POST /api/courses - เพิ่มรายวิชาใหม่ (admin only)
router.post('/', 
  requireAdmin,
  [
    require('express-validator').body('courseName')
      .notEmpty()
      .withMessage('กรุณากรอกชื่อรายวิชา')
      .isLength({ max: 200 })
      .withMessage('ชื่อรายวิชาไม่เกิน 200 ตัวอักษร'),
    require('express-validator').body('courseCode')
      .notEmpty()
      .withMessage('กรุณากรอกรหัสวิชา')
      .isLength({ max: 20 })
      .withMessage('รหัสวิชาไม่เกิน 20 ตัวอักษร'),
    require('express-validator').body('credits')
      .isInt({ min: 1, max: 10 })
      .withMessage('หน่วยกิตต้องเป็น 1-10'),
    require('express-validator').body('yearLevel')
      .isInt({ min: 1, max: 4 })
      .withMessage('ชั้นปีต้องเป็น 1-4'),
    require('express-validator').body('semester')
      .isInt({ min: 1, max: 3 })
      .withMessage('ภาคเรียนต้องเป็น 1, 2 หรือ 3'),
    require('express-validator').body('description')
      .optional()
      .isLength({ max: 1000 })
      .withMessage('คำอธิบายไม่เกิน 1000 ตัวอักษร')
  ],
  handleValidationErrors,
  courseController.create
);

// PUT /api/courses/:id - แก้ไขรายวิชา (admin only)
router.put('/:id', 
  requireAdmin,
  validationRules.idParam,
  [
    require('express-validator').body('courseName')
      .optional()
      .notEmpty()
      .withMessage('ชื่อรายวิชาไม่สามารถเป็นค่าว่างได้')
      .isLength({ max: 200 })
      .withMessage('ชื่อรายวิชาไม่เกิน 200 ตัวอักษร'),
    require('express-validator').body('credits')
      .optional()
      .isInt({ min: 1, max: 10 })
      .withMessage('หน่วยกิตต้องเป็น 1-10'),
    require('express-validator').body('yearLevel')
      .optional()
      .isInt({ min: 1, max: 4 })
      .withMessage('ชั้นปีต้องเป็น 1-4'),
    require('express-validator').body('semester')
      .optional()
      .isInt({ min: 1, max: 3 })
      .withMessage('ภาคเรียนต้องเป็น 1, 2 หรือ 3'),
    require('express-validator').body('status')
      .optional()
      .isIn(['active', 'inactive'])
      .withMessage('สถานะต้องเป็น active หรือ inactive'),
    require('express-validator').body('description')
      .optional()
      .isLength({ max: 1000 })
      .withMessage('คำอธิบายไม่เกิน 1000 ตัวอักษร')
  ],
  handleValidationErrors,
  courseController.update
);

// DELETE /api/courses/:id - ลบรายวิชา (admin only)
router.delete('/:id', 
  requireAdmin,
  validationRules.idParam,
  handleValidationErrors,
  courseController.delete
);

// GET /api/courses/activity-types - ดูประเภทกิจกรรมทั้งหมด (admin และ instructor)
router.get('/activity-types', 
  requireAdminOrInstructor,
  courseController.getAllActivityTypes
);

// POST /api/courses/activity-types - เพิ่มประเภทกิจกรรมใหม่ (admin only)
router.post('/activity-types', 
  requireAdmin,
  [
    require('express-validator').body('typeName')
      .notEmpty()
      .withMessage('กรุณากรอกชื่อประเภทกิจกรรม')
      .isLength({ max: 100 })
      .withMessage('ชื่อประเภทกิจกรรมไม่เกิน 100 ตัวอักษร'),
    require('express-validator').body('description')
      .optional()
      .isLength({ max: 500 })
      .withMessage('คำอธิบายไม่เกิน 500 ตัวอักษร'),
    require('express-validator').body('requiresAttendance')
      .optional()
      .isBoolean()
      .withMessage('ต้องการการเข้าร่วมต้องเป็น true หรือ false'),
    require('express-validator').body('allowsScoring')
      .optional()
      .isBoolean()
      .withMessage('อนุญาตให้ให้คะแนนต้องเป็น true หรือ false')
  ],
  handleValidationErrors,
  courseController.createActivityType
);

// PUT /api/courses/activity-types/:id - แก้ไขประเภทกิจกรรม (admin only)
router.put('/activity-types/:id', 
  requireAdmin,
  validationRules.idParam,
  [
    require('express-validator').body('typeName')
      .optional()
      .notEmpty()
      .withMessage('ชื่อประเภทกิจกรรมไม่สามารถเป็นค่าว่างได้')
      .isLength({ max: 100 })
      .withMessage('ชื่อประเภทกิจกรรมไม่เกิน 100 ตัวอักษร'),
    require('express-validator').body('description')
      .optional()
      .isLength({ max: 500 })
      .withMessage('คำอธิบายไม่เกิน 500 ตัวอักษร'),
    require('express-validator').body('requiresAttendance')
      .optional()
      .isBoolean()
      .withMessage('ต้องการการเข้าร่วมต้องเป็น true หรือ false'),
    require('express-validator').body('allowsScoring')
      .optional()
      .isBoolean()
      .withMessage('อนุญาตให้ให้คะแนนต้องเป็น true หรือ false')
  ],
  handleValidationErrors,
  courseController.updateActivityType
);

// DELETE /api/courses/activity-types/:id - ลบประเภทกิจกรรม (admin only)
router.delete('/activity-types/:id', 
  requireAdmin,
  validationRules.idParam,
  handleValidationErrors,
  courseController.deleteActivityType
);

module.exports = router;
