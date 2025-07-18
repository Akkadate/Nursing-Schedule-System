const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authMiddleware, requireAdmin } = require('../middleware/auth');
const { validationRules, handleValidationErrors } = require('../middleware/validation');

// ทุก route ต้องผ่าน authentication และเป็น admin
router.use(authMiddleware);
router.use(requireAdmin);

// GET /api/users - ดูรายชื่อผู้ใช้ทั้งหมด
router.get('/', 
  validationRules.pagination,
  handleValidationErrors,
  userController.getAll
);

// GET /api/users/:id - ดูข้อมูลผู้ใช้รายคน
router.get('/:id', 
  validationRules.idParam,
  handleValidationErrors,
  userController.getById
);

// POST /api/users - เพิ่มผู้ใช้ใหม่
router.post('/', 
  validationRules.userCreate,
  handleValidationErrors,
  userController.create
);

// PUT /api/users/:id - แก้ไขข้อมูลผู้ใช้
router.put('/:id', 
  validationRules.idParam,
  validationRules.userUpdate,
  handleValidationErrors,
  userController.update
);

// DELETE /api/users/:id - ลบผู้ใช้
router.delete('/:id', 
  validationRules.idParam,
  handleValidationErrors,
  userController.delete
);

// PUT /api/users/:id/status - เปลี่ยนสถานะผู้ใช้
router.put('/:id/status', 
  validationRules.idParam,
  [
    require('express-validator').body('status')
      .isIn(['active', 'inactive'])
      .withMessage('สถานะต้องเป็น active หรือ inactive')
  ],
  handleValidationErrors,
  userController.updateStatus
);

module.exports = router;
