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
// POST /api/auth/register - สร้างผู้ใช้ใหม่ (Admin only for first user)
router.post('/register', async (req, res) => {
  try {
    const {
      username,
      password,
      email,
      first_name,
      last_name,
      role = 'instructor'
    } = req.body;
    
    // Validation
    if (!username || !password || !email || !first_name || !last_name) {
      return res.status(400).json({
        success: false,
        message: 'กรุณากรอกข้อมูลให้ครบถ้วน'
      });
    }
    
    // ตรวจสอบว่ามี admin ในระบบแล้วหรือไม่
    const adminCheck = await pool.query(
      'SELECT COUNT(*) FROM users WHERE role = $1',
      ['admin']
    );
    
    const adminCount = parseInt(adminCheck.rows[0].count);
    
    // ถ้ายังไม่มี admin ให้สร้าง admin ได้
    // ถ้ามี admin แล้ว ต้องมี authorization
    if (adminCount > 0 && role === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'ไม่สามารถสร้าง admin เพิ่มได้ กรุณาติดต่อผู้ดูแลระบบ'
      });
    }
    
    // ตรวจสอบ username ซ้ำ
    const existingUser = await pool.query(
      'SELECT user_id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );
    
    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'ชื่อผู้ใช้หรืออีเมลนี้มีอยู่แล้ว'
      });
    }
    
    // Hash password
    const bcrypt = require('bcrypt');
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);
    
    // สร้างผู้ใช้ใหม่
    const result = await pool.query(`
      INSERT INTO users (
        username, password_hash, email, first_name, last_name, role,
        status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, 'active', NOW(), NOW())
      RETURNING user_id, username, email, first_name, last_name, role, status, created_at
    `, [username, password_hash, email, first_name, last_name, role]);
    
    res.status(201).json({
      success: true,
      message: 'สร้างผู้ใช้สำเร็จ',
      data: result.rows[0]
    });
    
  } catch (error) {
    console.error('Error in register:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการสร้างผู้ใช้',
      error: error.message
    });
  }
});
module.exports = router;
