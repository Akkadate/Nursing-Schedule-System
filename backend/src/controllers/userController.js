const bcrypt = require('bcryptjs');
const { query } = require('../config/database');

const userController = {
  // GET /api/users - ดูรายชื่อผู้ใช้ทั้งหมด
  async getAll(req, res) {
    try {
      const { page = 1, limit = 10, search = '', role = '' } = req.query;
      const offset = (page - 1) * limit;
      
      let whereClause = 'WHERE 1=1';
      let params = [];
      let paramCount = 0;
      
      if (search) {
        paramCount++;
        whereClause += ` AND (username ILIKE $${paramCount} OR email ILIKE $${paramCount} OR first_name ILIKE $${paramCount} OR last_name ILIKE $${paramCount})`;
        params.push(`%${search}%`);
      }
      
      if (role) {
        paramCount++;
        whereClause += ` AND role = $${paramCount}`;
        params.push(role);
      }
      
      const usersQuery = `
        SELECT user_id, username, email, first_name, last_name, role, status, created_at, updated_at
        FROM users 
        ${whereClause}
        ORDER BY created_at DESC 
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `;
      params.push(limit, offset);
      
      const result = await query(usersQuery, params);
      
      // Count total for pagination
      const countQuery = `SELECT COUNT(*) FROM users ${whereClause}`;
      const countResult = await query(countQuery, params.slice(0, paramCount));
      const total = parseInt(countResult.rows[0].count);
      
      res.json({
        success: true,
        message: 'ดึงข้อมูลผู้ใช้สำเร็จ',
        data: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: total,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('Error in getAllUsers:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการดึงข้อมูลผู้ใช้',
        error: error.message
      });
    }
  },

  // GET /api/users/:id - ดูข้อมูลผู้ใช้รายคน
  async getById(req, res) {
    try {
      const { id } = req.params;
      
      const result = await query(
        `SELECT user_id, username, email, first_name, last_name, role, status, created_at, updated_at
         FROM users WHERE user_id = $1`,
        [id]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'ไม่พบข้อมูลผู้ใช้ที่ต้องการ'
        });
      }
      
      res.json({
        success: true,
        message: 'ดึงข้อมูลผู้ใช้สำเร็จ',
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Error in getUserById:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการดึงข้อมูลผู้ใช้',
        error: error.message
      });
    }
  },

  // POST /api/users - เพิ่มผู้ใช้ใหม่
  async create(req, res) {
    try {
      const { username, email, password, firstName, lastName, role } = req.body;
      
      // ตรวจสอบว่า username หรือ email ซ้ำหรือไม่
      const existingUser = await query(
        'SELECT user_id FROM users WHERE username = $1 OR email = $2',
        [username, email]
      );
      
      if (existingUser.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'ชื่อผู้ใช้หรืออีเมลนี้มีการใช้งานแล้ว'
        });
      }
      
      // เข้ารหัสรหัสผ่าน
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      
      const result = await query(
        `INSERT INTO users (username, email, password_hash, first_name, last_name, role, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
         RETURNING user_id, username, email, first_name, last_name, role, status, created_at`,
        [username, email, hashedPassword, firstName, lastName, role]
      );
      
      res.status(201).json({
        success: true,
        message: 'สร้างผู้ใช้ใหม่สำเร็จ',
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Error in createUser:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการสร้างผู้ใช้ใหม่',
        error: error.message
      });
    }
  },

  // PUT /api/users/:id - แก้ไขข้อมูลผู้ใช้
  async update(req, res) {
    try {
      const { id } = req.params;
      const { email, firstName, lastName, role, status } = req.body;
      
      // ตรวจสอบว่าผู้ใช้มีอยู่หรือไม่
      const checkResult = await query(
        'SELECT user_id FROM users WHERE user_id = $1',
        [id]
      );
      
      if (checkResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'ไม่พบข้อมูลผู้ใช้ที่ต้องการแก้ไข'
        });
      }
      
      // ตรวจสอบอีเมลซ้ำ (ถ้ามีการเปลี่ยน)
      if (email) {
        const emailCheck = await query(
          'SELECT user_id FROM users WHERE email = $1 AND user_id != $2',
          [email, id]
        );
        
        if (emailCheck.rows.length > 0) {
          return res.status(409).json({
            success: false,
            message: 'อีเมลนี้มีการใช้งานแล้ว'
          });
        }
      }
      
      const result = await query(
        `UPDATE users 
         SET email = COALESCE($1, email),
             first_name = COALESCE($2, first_name),
             last_name = COALESCE($3, last_name),
             role = COALESCE($4, role),
             status = COALESCE($5, status),
             updated_at = NOW()
         WHERE user_id = $6
         RETURNING user_id, username, email, first_name, last_name, role, status, updated_at`,
        [email, firstName, lastName, role, status, id]
      );
      
      res.json({
        success: true,
        message: 'แก้ไขข้อมูลผู้ใช้สำเร็จ',
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Error in updateUser:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการแก้ไขข้อมูลผู้ใช้',
        error: error.message
      });
    }
  },

  // DELETE /api/users/:id - ลบผู้ใช้
  async delete(req, res) {
    try {
      const { id } = req.params;
      const { userId: currentUserId } = req.user;
      
      // ป้องกันการลบตัวเอง
      if (parseInt(id) === currentUserId) {
        return res.status(400).json({
          success: false,
          message: 'ไม่สามารถลบบัญชีของตนเองได้'
        });
      }
      
      // ตรวจสอบว่าผู้ใช้มีอยู่หรือไม่
      const checkResult = await query(
        'SELECT user_id, username FROM users WHERE user_id = $1',
        [id]
      );
      
      if (checkResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'ไม่พบข้อมูลผู้ใช้ที่ต้องการลบ'
        });
      }
      
      // ตรวจสอบว่าผู้ใช้มีข้อมูลที่เชื่อมโยงหรือไม่
      const instructorCheck = await query(
        'SELECT instructor_id FROM instructors WHERE user_id = $1',
        [id]
      );
      
      if (instructorCheck.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'ไม่สามารถลบผู้ใช้ได้ เนื่องจากมีข้อมูลอาจารย์ที่เชื่อมโยงอยู่'
        });
      }
      
      await query('DELETE FROM users WHERE user_id = $1', [id]);
      
      res.json({
        success: true,
        message: 'ลบผู้ใช้สำเร็จ'
      });
    } catch (error) {
      console.error('Error in deleteUser:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการลบผู้ใช้',
        error: error.message
      });
    }
  },

  // PUT /api/users/:id/status - เปลี่ยนสถานะผู้ใช้
  async updateStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const { userId: currentUserId } = req.user;
      
      // ป้องกันการเปลี่ยนสถานะตัวเอง
      if (parseInt(id) === currentUserId) {
        return res.status(400).json({
          success: false,
          message: 'ไม่สามารถเปลี่ยนสถานะบัญชีของตนเองได้'
        });
      }
      
      // ตรวจสอบว่าผู้ใช้มีอยู่หรือไม่
      const checkResult = await query(
        'SELECT user_id, username, status FROM users WHERE user_id = $1',
        [id]
      );
      
      if (checkResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'ไม่พบข้อมูลผู้ใช้ที่ต้องการเปลี่ยนสถานะ'
        });
      }
      
      const result = await query(
        `UPDATE users 
         SET status = $1, updated_at = NOW()
         WHERE user_id = $2
         RETURNING user_id, username, email, first_name, last_name, role, status, updated_at`,
        [status, id]
      );
      
      res.json({
        success: true,
        message: 'เปลี่ยนสถานะผู้ใช้สำเร็จ',
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Error in updateUserStatus:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการเปลี่ยนสถานะผู้ใช้',
        error: error.message
      });
    }
  }
};

module.exports = userController;
