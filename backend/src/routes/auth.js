const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authMiddleware } = require('../middleware/auth');
const { validationRules, handleValidationErrors } = require('../middleware/validation');

// POST /api/auth/login - เข้าสู่ระบบ
router.post('/login', 
  validationRules.login,
  handleValidationErrors,
  authController.login
);

// POST /api/auth/logout - ออกจากระบบ (ต้องมี token)
router.post('/logout', 
  authMiddleware,
  authController.logout
);

// GET /api/auth/profile - ดูข้อมูลโปรไฟล์ (ต้องมี token)
router.get('/profile', 
  authMiddleware,
  authController.getProfile
);

// PUT /api/auth/profile - แก้ไขโปรไฟล์ (ต้องมี token)
router.put('/profile', 
  authMiddleware,
  validationRules.userUpdate,
  handleValidationErrors,
  authController.updateProfile
);

// POST /api/auth/change-password - เปลี่ยนรหัสผ่าน (ต้องมี token)
router.post('/change-password', 
  authMiddleware,
  validationRules.changePassword,
  handleValidationErrors,
  authController.changePassword
);

// GET /api/auth/verify-token - ตรวจสอบ token (ต้องมี token)
router.get('/verify-token', 
  authMiddleware,
  authController.verifyToken
);

module.exports = router;
