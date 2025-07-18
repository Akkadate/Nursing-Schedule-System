const express = require('express');
const router = express.Router();
const groupController = require('../controllers/groupController');
const { authMiddleware, requireAdmin, requireAdminOrInstructor } = require('../middleware/auth');
const { validationRules, handleValidationErrors } = require('../middleware/validation');

// ทุก route ต้องผ่าน authentication
router.use(authMiddleware);

// GET /api/groups - ดูกลุ่มทั้งหมด (admin และ instructor)
router.get('/', 
  requireAdminOrInstructor,
  validationRules.pagination,
  handleValidationErrors,
  groupController.getAll
);

// GET /api/groups/:id - ดูข้อมูลกลุ่ม (admin และ instructor)
router.get('/:id', 
  requireAdminOrInstructor,
  validationRules.idParam,
  handleValidationErrors,
  groupController.getById
);

// POST /api/groups - เพิ่มกลุ่มใหม่ (admin only)
router.post('/', 
  requireAdmin,
  [
    require('express-validator').body('sectionId')
      .isInt({ min: 1 })
      .withMessage('กรุณาเลือกหมู่เรียน'),
    require('express-validator').body('groupName')
      .notEmpty()
      .withMessage('กรุณากรอกชื่อกลุ่ม')
      .isLength({ max: 100 })
      .withMessage('ชื่อกลุ่มไม่เกิน 100 ตัวอักษร'),
    require('express-validator').body('groupCode')
      .notEmpty()
      .withMessage('กรุณากรอกรหัสกลุ่ม')
      .isLength({ max: 20 })
      .withMessage('รหัสกลุ่มไม่เกิน 20 ตัวอักษร'),
    require('express-validator').body('capacity')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('จำนวนนักศึกษาสูงสุดต้องเป็น 1-50')
  ],
  handleValidationErrors,
  groupController.create
);

// PUT /api/groups/:id - แก้ไขกลุ่ม (admin only)
router.put('/:id', 
  requireAdmin,
  validationRules.idParam,
  [
    require('express-validator').body('groupName')
      .optional()
      .notEmpty()
      .withMessage('ชื่อกลุ่มไม่สามารถเป็นค่าว่างได้')
      .isLength({ max: 100 })
      .withMessage('ชื่อกลุ่มไม่เกิน 100 ตัวอักษร'),
    require('express-validator').body('capacity')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('จำนวนนักศึกษาสูงสุดต้องเป็น 1-50'),
    require('express-validator').body('status')
      .optional()
      .isIn(['active', 'inactive'])
      .withMessage('สถานะต้องเป็น active หรือ inactive')
  ],
  handleValidationErrors,
  groupController.update
);

// DELETE /api/groups/:id - ลบกลุ่ม (admin only)
router.delete('/:id', 
  requireAdmin,
  validationRules.idParam,
  handleValidationErrors,
  groupController.delete
);

// GET /api/groups/section/:sectionId - ดูกลุ่มตาม Section (admin และ instructor)
router.get('/section/:sectionId', 
  requireAdminOrInstructor,
  [
    require('express-validator').param('sectionId')
      .isInt({ min: 1 })
      .withMessage('Section ID ต้องเป็นตัวเลขที่มากกว่า 0')
  ],
  handleValidationErrors,
  groupController.getBySection
);

module.exports = router;
