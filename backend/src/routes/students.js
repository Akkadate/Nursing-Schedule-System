const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const { authMiddleware, requireAdminOrInstructor } = require('../middleware/auth');
const { validationRules, handleValidationErrors } = require('../middleware/validation');

// ทุก route ต้องผ่าน authentication (admin หรือ instructor)
router.use(authMiddleware);
router.use(requireAdminOrInstructor);

// GET /api/students - ดูรายชื่อนักศึกษาทั้งหมด
router.get('/', 
  validationRules.pagination,
  handleValidationErrors,
  studentController.getAll
);

// GET /api/students/:id - ดูข้อมูลนักศึกษารายคน
router.get('/:id', 
  validationRules.idParam,
  handleValidationErrors,
  studentController.getById
);

// POST /api/students - เพิ่มนักศึกษาใหม่ (admin only)
router.post('/', 
  require('../middleware/auth').requireAdmin,
  validationRules.studentCreate,
  handleValidationErrors,
  studentController.create
);

// PUT /api/students/:id - แก้ไขข้อมูลนักศึกษา (admin only)
router.put('/:id', 
  require('../middleware/auth').requireAdmin,
  validationRules.idParam,
  [
    require('express-validator').body('firstName')
      .optional()
      .notEmpty()
      .withMessage('ชื่อไม่สามารถเป็นค่าว่างได้')
      .isLength({ max: 100 })
      .withMessage('ชื่อไม่เกิน 100 ตัวอักษร'),
    require('express-validator').body('lastName')
      .optional()
      .notEmpty()
      .withMessage('นามสกุลไม่สามารถเป็นค่าว่างได้')
      .isLength({ max: 100 })
      .withMessage('นามสกุลไม่เกิน 100 ตัวอักษร'),
    require('express-validator').body('email')
      .optional()
      .isEmail()
      .withMessage('รูปแบบอีเมลไม่ถูกต้อง'),
    require('express-validator').body('yearLevel')
      .optional()
      .isInt({ min: 1, max: 4 })
      .withMessage('ชั้นปีต้องเป็น 1-4'),
    require('express-validator').body('status')
      .optional()
      .isIn(['active', 'inactive', 'graduated', 'dropped'])
      .withMessage('สถานะต้องเป็น active, inactive, graduated หรือ dropped')
  ],
  handleValidationErrors,
  studentController.update
);

// DELETE /api/students/:id - ลบนักศึกษา (admin only)
router.delete('/:id', 
  require('../middleware/auth').requireAdmin,
  validationRules.idParam,
  handleValidationErrors,
  studentController.delete
);

// GET /api/students/section/:sectionId - ดูนักศึกษาตาม Section
router.get('/section/:sectionId', 
  [
    require('express-validator').param('sectionId')
      .isInt({ min: 1 })
      .withMessage('Section ID ต้องเป็นตัวเลขที่มากกว่า 0')
  ],
  validationRules.pagination,
  handleValidationErrors,
  studentController.getBySection
);

// GET /api/students/group/:groupId - ดูนักศึกษาตาม Group
router.get('/group/:groupId', 
  [
    require('express-validator').param('groupId')
      .isInt({ min: 1 })
      .withMessage('Group ID ต้องเป็นตัวเลขที่มากกว่า 0')
  ],
  handleValidationErrors,
  studentController.getByGroup
);

// POST /api/students/import - นำเข้าข้อมูลจาก CSV (admin only)
router.post('/import', 
  require('../middleware/auth').requireAdmin,
  studentController.importFromCSV
);

module.exports = router;
