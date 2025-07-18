const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { jwtSecret, jwtExpire } = require('../config/auth');
const { authLogger } = require('../utils/logger');

const authController = {
  // POST /api/auth/login - เข้าสู่ระบบ
  async login(req, res) {
    try {
      const { username, password } = req.body;
      const clientIp = req.ip;

      // ตรวจสอบผู้ใช้ในฐานข้อมูล
      const userResult = await query(
        `SELECT u.user_id, u.username, u.password_hash, u.email, u.first_name, u.last_name, u.role, u.status
         FROM users u 
         WHERE u.username = $1`,
        [username]
      );

      if (userResult.rows.length === 0) {
        authLogger.loginFailed(username, clientIp, 'User not found');
        return res.status(401).json({
          success: false,
          message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'
        });
      }

      const user = userResult.rows[0];

      // ตรวจสอบสถานะผู้ใช้
      if (user.status !== 'active') {
        authLogger.loginFailed(username, clientIp, 'Account inactive');
        return res.status(401).json({
          success: false,
          message: 'บัญชีผู้ใช้ถูกระงับการใช้งาน'
        });
      }

      // ตรวจสอบรหัสผ่าน
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
        authLogger.loginFailed(username, clientIp, 'Invalid password');
        return res.status(401).json({
          success: false,
          message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'
        });
      }

      // สร้าง JWT token
      const tokenPayload = {
        userId: user.user_id,
        username: user.username,
        role: user.role
      };

      const token = jwt.sign(tokenPayload, jwtSecret, { expiresIn: jwtExpire });

      // บันทึกการเข้าสู่ระบบ
      authLogger.loginSuccess(user.user_id, user.username, clientIp);

      // ส่งผลลัพธ์
      res.json({
        success: true,
        message: 'เข้าสู่ระบบสำเร็จ',
        data: {
          token,
          user: {
            userId: user.user_id,
            username: user.username,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            role: user.role
          }
        }
      });

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ',
        error: error.message
      });
    }
  },

  // POST /api/auth/logout - ออกจากระบบ
  async logout(req, res) {
    try {
      const { userId, username } = req.user;
      const clientIp = req.ip;

      // บันทึกการออกจากระบบ
      authLogger.logout(userId, username, clientIp);

      res.json({
        success: true,
        message: 'ออกจากระบบสำเร็จ'
      });

    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการออกจากระบบ',
        error: error.message
      });
    }
  },

  // GET /api/auth/profile - ดูข้อมูลโปรไฟล์
  async getProfile(req, res) {
    try {
      const { userId } = req.user;

      const userResult = await query(
        `SELECT u.user_id, u.username, u.email, u.first_name, u.last_name, u.role, u.status,
                u.created_at, u.updated_at
         FROM users u 
         WHERE u.user_id = $1`,
        [userId]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'ไม่พบข้อมูลผู้ใช้'
        });
      }

      const user = userResult.rows[0];

      res.json({
        success: true,
        message: 'ดึงข้อมูลโปรไฟล์สำเร็จ',
        data: {
          userId: user.user_id,
          username: user.username,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
          status: user.status,
          createdAt: user.created_at,
          updatedAt: user.updated_at
        }
      });

    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการดึงข้อมูลโปรไฟล์',
        error: error.message
      });
    }
  },

  // PUT /api/auth/profile - แก้ไขโปรไฟล์
  async updateProfile(req, res) {
    try {
      const { userId } = req.user;
      const { email, firstName, lastName } = req.body;

      // ตรวจสอบว่าอีเมลซ้ำหรือไม่ (ถ้ามีการเปลี่ยน)
      if (email) {
        const emailCheck = await query(
          'SELECT user_id FROM users WHERE email = $1 AND user_id != $2',
          [email, userId]
        );

        if (emailCheck.rows.length > 0) {
          return res.status(409).json({
            success: false,
            message: 'อีเมลนี้มีการใช้งานแล้ว'
          });
        }
      }

      // อัปเดตข้อมูล
      const updateResult = await query(
        `UPDATE users 
         SET email = COALESCE($1, email),
             first_name = COALESCE($2, first_name),
             last_name = COALESCE($3, last_name),
             updated_at = NOW()
         WHERE user_id = $4
         RETURNING user_id, username, email, first_name, last_name, role`,
        [email, firstName, lastName, userId]
      );

      if (updateResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'ไม่พบข้อมูลผู้ใช้'
        });
      }

      const updatedUser = updateResult.rows[0];

      res.json({
        success: true,
        message: 'อัปเดตโปรไฟล์สำเร็จ',
        data: {
          userId: updatedUser.user_id,
          username: updatedUser.username,
          email: updatedUser.email,
          firstName: updatedUser.first_name,
          lastName: updatedUser.last_name,
          role: updatedUser.role
        }
      });

    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการอัปเดตโปรไฟล์',
        error: error.message
      });
    }
  },

  // POST /api/auth/change-password - เปลี่ยนรหัสผ่าน
  async changePassword(req, res) {
    try {
      const { userId } = req.user;
      const { currentPassword, newPassword } = req.body;

      // ดึงรหัสผ่านปัจจุบัน
      const userResult = await query(
        'SELECT password_hash FROM users WHERE user_id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'ไม่พบข้อมูลผู้ใช้'
        });
      }

      const user = userResult.rows[0];

      // ตรวจสอบรหัสผ่านปัจจุบัน
      const isValidCurrentPassword = await bcrypt.compare(currentPassword, user.password_hash);
      if (!isValidCurrentPassword) {
        return res.status(400).json({
          success: false,
          message: 'รหัสผ่านปัจจุบันไม่ถูกต้อง'
        });
      }

      // เข้ารหัสรหัสผ่านใหม่
      const saltRounds = 12;
      const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

      // อัปเดตรหัสผ่าน
      await query(
        'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE user_id = $2',
        [hashedNewPassword, userId]
      );

      res.json({
        success: true,
        message: 'เปลี่ยนรหัสผ่านสำเร็จ'
      });

    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน',
        error: error.message
      });
    }
  },

  // GET /api/auth/verify-token - ตรวจสอบ token
  async verifyToken(req, res) {
    try {
      // ถ้าผ่าน authMiddleware มาได้แสดงว่า token ถูกต้อง
      res.json({
        success: true,
        message: 'Token ถูกต้อง',
        data: {
          user: req.user,
          tokenValid: true
        }
      });

    } catch (error) {
      console.error('Verify token error:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการตรวจสอบ token',
        error: error.message
      });
    }
  }
};

module.exports = authController;
