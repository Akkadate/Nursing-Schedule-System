const express = require('express');
const router = express.Router();
const sectionController = require('../controllers/sectionController');
const { authMiddleware, requireAdmin, requireAdminOrInstructor } = require('../middleware/auth');
const { validationRules, handleValidationErrors } = require('../middleware/validation');

// ทุก route ต้องผ่าน authentication
router.use(authMiddleware);

// GET /api/sections - ดูหมู่เรียนทั้งหมด (admin และ instructor)
router.get('/', 
  requireAdminOrInstructor,
  validationRules.pagination,
  handleValidationErrors,
  sectionController.getAll
);

// GET /api/sections/:id - ดูข้อมูลหมู่เรียน (admin และ instructor)
router.get('/:id', 
  requireAdminOrInstructor,
  validationRules.idParam,
  handleValidationErrors,
  sectionController.getById
);

// POST /api/sections - เพิ่มหมู่เรียนใหม่ (admin only)
router.post('/', 
  requireAdmin,
  [
    require('express-validator').body('sectionName')
      .notEmpty()
      .withMessage('กรุณากรอกชื่อหมู่เรียน')
      .isLength({ max: 100 })
      .withMessage('ชื่อหมู่เรียนไม่เกิน 100 ตัวอักษร'),
    require('express-validator').body('sectionCode')
      .notEmpty()
      .withMessage('กรุณากรอกรหัสหมู่เรียน')
      .isLength({ max: 20 })
      .withMessage('รหัสหมู่เรียนไม่เกิน 20 ตัวอักษร'),
    require('express-validator').body('yearLevel')
      .isInt({ min: 1, max: 4 })
      .withMessage('ชั้นปีต้องเป็น 1-4'),
    require('express-validator').body('academicYear')
      .notEmpty()
      .withMessage('กรุณากรอกปีการศึกษา')
      .matches(/^\d{4}\/\d{4}$/)
      .withMessage('รูปแบบปีการศึกษาต้องเป็น YYYY/YYYY เช่น 2568/2569'),
    require('express-validator').body('semester')
      .isInt({ min: 1, max: 3 })
      .withMessage('ภาคเรียนต้องเป็น 1, 2 หรือ 3'),
    require('express-validator').body('capacity')
      .optional()
      .isInt({ min: 1, max: 200 })
      .withMessage('จำนวนนักศึกษาสูงสุดต้องเป็น 1-200')
  ],
  handleValidationErrors,
  sectionController.create
);

// PUT /api/sections/:id - แก้ไขหมู่เรียน (admin only)
router.put('/:id', 
  requireAdmin,
  validationRules.idParam,
  [
    require('express-validator').body('sectionName')
      .optional()
      .notEmpty()
      .withMessage('ชื่อหมู่เรียนไม่สามารถเป็นค่าว่างได้')
      .isLength({ max: 100 })
      .withMessage('ชื่อหมู่เรียนไม่เกิน 100 ตัวอักษร'),
    require('express-validator').body('yearLevel')
      .optional()
      .isInt({ min: 1, max: 4 })
      .withMessage('ชั้นปีต้องเป็น 1-4'),
    require('express-validator').body('academicYear')
      .optional()
      .matches(/^\d{4}\/\d{4}$/)
      .withMessage('รูปแบบปีการศึกษาต้องเป็น YYYY/YYYY เช่น 2568/2569'),
    require('express-validator').body('semester')
      .optional()
      .isInt({ min: 1, max: 3 })
      .withMessage('ภาคเรียนต้องเป็น 1, 2 หรือ 3'),
    require('express-validator').body('capacity')
      .optional()
      .isInt({ min: 1, max: 200 })
      .withMessage('จำนวนนักศึกษาสูงสุดต้องเป็น 1-200'),
    require('express-validator').body('status')
      .optional()
      .isIn(['active', 'inactive'])
      .withMessage('สถานะต้องเป็น active หรือ inactive')
  ],
  handleValidationErrors,
  sectionController.update
);

// DELETE /api/sections/:id - ลบหมู่เรียน (admin only)
router.delete('/:id', 
  requireAdmin,
  validationRules.idParam,
  handleValidationErrors,
  sectionController.delete
);

module.exports = router;
