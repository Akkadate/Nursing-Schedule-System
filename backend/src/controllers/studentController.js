const { query } = require('../config/database');

const studentController = {
  // GET /api/students - ดูรายชื่อนักศึกษาทั้งหมด
  async getAll(req, res) {
    try {
      const { page = 1, limit = 10, search = '', sectionId = '', groupId = '', yearLevel = '' } = req.query;
      const offset = (page - 1) * limit;
      
      let whereClause = 'WHERE 1=1';
      let params = [];
      let paramCount = 0;
      
      if (search) {
        paramCount++;
        whereClause += ` AND (s.student_code ILIKE $${paramCount} OR s.first_name ILIKE $${paramCount} OR s.last_name ILIKE $${paramCount} OR s.email ILIKE $${paramCount})`;
        params.push(`%${search}%`);
      }
      
      if (sectionId) {
        paramCount++;
        whereClause += ` AND s.section_id = $${paramCount}`;
        params.push(sectionId);
      }
      
      if (groupId) {
        paramCount++;
        whereClause += ` AND s.group_id = $${paramCount}`;
        params.push(groupId);
      }
      
      if (yearLevel) {
        paramCount++;
        whereClause += ` AND s.year_level = $${paramCount}`;
        params.push(yearLevel);
      }
      
      const studentsQuery = `
        SELECT s.student_id, s.student_code, s.first_name, s.last_name, s.email, s.phone,
               s.year_level, s.status, s.created_at, s.updated_at,
               sec.section_name, sec.section_code,
               g.group_name, g.group_code
        FROM students s
        LEFT JOIN sections sec ON s.section_id = sec.section_id
        LEFT JOIN groups g ON s.group_id = g.group_id
        ${whereClause}
        ORDER BY s.student_code ASC
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `;
      params.push(limit, offset);
      
      const result = await query(studentsQuery, params);
      
      // Count total for pagination
      const countQuery = `
        SELECT COUNT(*) 
        FROM students s
        LEFT JOIN sections sec ON s.section_id = sec.section_id
        LEFT JOIN groups g ON s.group_id = g.group_id
        ${whereClause}
      `;
      const countResult = await query(countQuery, params.slice(0, paramCount));
      const total = parseInt(countResult.rows[0].count);
      
      res.json({
        success: true,
        message: 'ดึงข้อมูลนักศึกษาสำเร็จ',
        data: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: total,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('Error in getAllStudents:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการดึงข้อมูลนักศึกษา',
        error: error.message
      });
    }
  },

  // GET /api/students/:id - ดูข้อมูลนักศึกษารายคน
  async getById(req, res) {
    try {
      const { id } = req.params;
      
      const result = await query(
        `SELECT s.student_id, s.student_code, s.first_name, s.last_name, s.email, s.phone,
                s.year_level, s.status, s.created_at, s.updated_at,
                sec.section_id, sec.section_name, sec.section_code,
                g.group_id, g.group_name, g.group_code
         FROM students s
         LEFT JOIN sections sec ON s.section_id = sec.section_id
         LEFT JOIN groups g ON s.group_id = g.group_id
         WHERE s.student_id = $1`,
        [id]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'ไม่พบข้อมูลนักศึกษาที่ต้องการ'
        });
      }
      
      res.json({
        success: true,
        message: 'ดึงข้อมูลนักศึกษาสำเร็จ',
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Error in getStudentById:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการดึงข้อมูลนักศึกษา',
        error: error.message
      });
    }
  },

  // POST /api/students - เพิ่มนักศึกษาใหม่
  async create(req, res) {
    try {
      const { studentCode, firstName, lastName, email, phone, sectionId, groupId, yearLevel } = req.body;
      
      // ตรวจสอบว่ารหัสนักศึกษาซ้ำหรือไม่
      const existingStudent = await query(
        'SELECT student_id FROM students WHERE student_code = $1',
        [studentCode]
      );
      
      if (existingStudent.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'รหัสนักศึกษานี้มีการใช้งานแล้ว'
        });
      }
      
      // ตรวจสอบว่าอีเมลซ้ำหรือไม่ (ถ้ามี)
      if (email) {
        const emailCheck = await query(
          'SELECT student_id FROM students WHERE email = $1',
          [email]
        );
        
        if (emailCheck.rows.length > 0) {
          return res.status(409).json({
            success: false,
            message: 'อีเมลนี้มีการใช้งานแล้ว'
          });
        }
      }
      
      // ตรวจสอบว่า section และ group มีอยู่หรือไม่
      if (sectionId) {
        const sectionCheck = await query('SELECT section_id FROM sections WHERE section_id = $1', [sectionId]);
        if (sectionCheck.rows.length === 0) {
          return res.status(404).json({
            success: false,
            message: 'ไม่พบข้อมูลหมู่เรียนที่ระบุ'
          });
        }
      }
      
      if (groupId) {
        const groupCheck = await query('SELECT group_id FROM groups WHERE group_id = $1', [groupId]);
        if (groupCheck.rows.length === 0) {
          return res.status(404).json({
            success: false,
            message: 'ไม่พบข้อมูลกลุ่มที่ระบุ'
          });
        }
      }
      
      const result = await query(
        `INSERT INTO students (student_code, first_name, last_name, email, phone, section_id, group_id, year_level, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
         RETURNING student_id, student_code, first_name, last_name, email, phone, section_id, group_id, year_level, status, created_at`,
        [studentCode, firstName, lastName, email, phone, sectionId, groupId, yearLevel]
      );
      
      res.status(201).json({
        success: true,
        message: 'เพิ่มนักศึกษาใหม่สำเร็จ',
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Error in createStudent:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการเพิ่มนักศึกษาใหม่',
        error: error.message
      });
    }
  },

  // PUT /api/students/:id - แก้ไขข้อมูลนักศึกษา
  async update(req, res) {
    try {
      const { id } = req.params;
      const { firstName, lastName, email, phone, sectionId, groupId, yearLevel, status } = req.body;
      
      // ตรวจสอบว่านักศึกษามีอยู่หรือไม่
      const checkResult = await query(
        'SELECT student_id FROM students WHERE student_id = $1',
        [id]
      );
      
      if (checkResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'ไม่พบข้อมูลนักศึกษาที่ต้องการแก้ไข'
        });
      }
      
      // ตรวจสอบอีเมลซ้ำ (ถ้ามีการเปลี่ยน)
      if (email) {
        const emailCheck = await query(
          'SELECT student_id FROM students WHERE email = $1 AND student_id != $2',
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
        `UPDATE students 
         SET first_name = COALESCE($1, first_name),
             last_name = COALESCE($2, last_name),
             email = COALESCE($3, email),
             phone = COALESCE($4, phone),
             section_id = COALESCE($5, section_id),
             group_id = COALESCE($6, group_id),
             year_level = COALESCE($7, year_level),
             status = COALESCE($8, status),
             updated_at = NOW()
         WHERE student_id = $9
         RETURNING student_id, student_code, first_name, last_name, email, phone, section_id, group_id, year_level, status, updated_at`,
        [firstName, lastName, email, phone, sectionId, groupId, yearLevel, status, id]
      );
      
      res.json({
        success: true,
        message: 'แก้ไขข้อมูลนักศึกษาสำเร็จ',
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Error in updateStudent:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการแก้ไขข้อมูลนักศึกษา',
        error: error.message
      });
    }
  },

  // DELETE /api/students/:id - ลบนักศึกษา
  async delete(req, res) {
    try {
      const { id } = req.params;
      
      // ตรวจสอบว่านักศึกษามีอยู่หรือไม่
      const checkResult = await query(
        'SELECT student_id, student_code FROM students WHERE student_id = $1',
        [id]
      );
      
      if (checkResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'ไม่พบข้อมูลนักศึกษาที่ต้องการลบ'
        });
      }
      
      // ตรวจสอบว่านักศึกษามีการเข้าร่วมกิจกรรมหรือไม่
      const attendanceCheck = await query(
        'SELECT attendance_id FROM attendance WHERE student_id = $1',
        [id]
      );
      
      if (attendanceCheck.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'ไม่สามารถลบนักศึกษาได้ เนื่องจากมีข้อมูลการเข้าร่วมกิจกรรมที่เชื่อมโยงอยู่'
        });
      }
      
      await query('DELETE FROM students WHERE student_id = $1', [id]);
      
      res.json({
        success: true,
        message: 'ลบนักศึกษาสำเร็จ'
      });
    } catch (error) {
      console.error('Error in deleteStudent:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการลบนักศึกษา',
        error: error.message
      });
    }
  },

  // GET /api/students/section/:sectionId - ดูนักศึกษาตาม Section
  async getBySection(req, res) {
    try {
      const { sectionId } = req.params;
      const { page = 1, limit = 50 } = req.query;
      const offset = (page - 1) * limit;
      
      const result = await query(
        `SELECT s.student_id, s.student_code, s.first_name, s.last_name, s.email, s.phone,
                s.year_level, s.status, g.group_name, g.group_code
         FROM students s
         LEFT JOIN groups g ON s.group_id = g.group_id
         WHERE s.section_id = $1
         ORDER BY s.student_code ASC
         LIMIT $2 OFFSET $3`,
        [sectionId, limit, offset]
      );
      
      res.json({
        success: true,
        message: 'ดึงข้อมูลนักศึกษาตามหมู่เรียนสำเร็จ',
        data: result.rows
      });
    } catch (error) {
      console.error('Error in getStudentsBySection:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการดึงข้อมูลนักศึกษาตามหมู่เรียน',
        error: error.message
      });
    }
  },

  // GET /api/students/group/:groupId - ดูนักศึกษาตาม Group
  async getByGroup(req, res) {
    try {
      const { groupId } = req.params;
      
      const result = await query(
        `SELECT s.student_id, s.student_code, s.first_name, s.last_name, s.email, s.phone,
                s.year_level, s.status, sec.section_name, sec.section_code
         FROM students s
         LEFT JOIN sections sec ON s.section_id = sec.section_id
         WHERE s.group_id = $1
         ORDER BY s.student_code ASC`,
        [groupId]
      );
      
      res.json({
        success: true,
        message: 'ดึงข้อมูลนักศึกษาตามกลุ่มสำเร็จ',
        data: result.rows
      });
    } catch (error) {
      console.error('Error in getStudentsByGroup:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการดึงข้อมูลนักศึกษาตามกลุ่ม',
        error: error.message
      });
    }
  },

  // POST /api/students/import - นำเข้าข้อมูลจาก CSV
  async importFromCSV(req, res) {
    try {
      // TODO: Implement CSV import functionality
      // This would typically involve:
      // 1. Parse uploaded CSV file
      // 2. Validate data
      // 3. Check for duplicates
      // 4. Bulk insert
      
      res.status(501).json({
        success: false,
        message: 'ฟีเจอร์นำเข้าข้อมูลจาก CSV ยังไม่ได้ImplementationError อุปกรณ์ในเฟส์นี้'
      });
    } catch (error) {
      console.error('Error in importStudentsFromCSV:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการนำเข้าข้อมูลนักศึกษา',
        error: error.message
      });
    }
  }
};

module.exports = studentController;
