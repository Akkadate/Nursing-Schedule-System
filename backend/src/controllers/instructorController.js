const { query } = require('../config/database');

const instructorController = {
  // GET /api/instructors - ดูรายชื่ออาจารย์ทั้งหมด
  async getAll(req, res) {
    try {
      const { page = 1, limit = 10, search = '', department = '', status = '' } = req.query;
      const offset = (page - 1) * limit;
      
      let whereClause = 'WHERE 1=1';
      let params = [];
      let paramCount = 0;
      
      if (search) {
        paramCount++;
        whereClause += ` AND (i.instructor_code ILIKE $${paramCount} OR u.first_name ILIKE $${paramCount} OR u.last_name ILIKE $${paramCount} OR u.email ILIKE $${paramCount})`;
        params.push(`%${search}%`);
      }
      
      if (department) {
        paramCount++;
        whereClause += ` AND i.department ILIKE $${paramCount}`;
        params.push(`%${department}%`);
      }
      
      if (status) {
        paramCount++;
        whereClause += ` AND u.status = $${paramCount}`;
        params.push(status);
      }
      
      const instructorsQuery = `
        SELECT i.instructor_id, i.instructor_code, i.title, i.department, i.specialization,
               i.max_students_per_session, i.created_at, i.updated_at,
               u.user_id, u.username, u.email, u.first_name, u.last_name, u.status,
               COUNT(s.schedule_id) as total_schedules
        FROM instructors i
        JOIN users u ON i.user_id = u.user_id
        LEFT JOIN schedules s ON i.instructor_id = s.instructor_id
        ${whereClause}
        GROUP BY i.instructor_id, u.user_id
        ORDER BY u.first_name ASC, u.last_name ASC
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `;
      params.push(limit, offset);
      
      const result = await query(instructorsQuery, params);
      
      // Count total for pagination
      const countQuery = `
        SELECT COUNT(*) 
        FROM instructors i
        JOIN users u ON i.user_id = u.user_id
        ${whereClause}
      `;
      const countResult = await query(countQuery, params.slice(0, paramCount));
      const total = parseInt(countResult.rows[0].count);
      
      res.json({
        success: true,
        message: 'ดึงข้อมูลอาจารย์สำเร็จ',
        data: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: total,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('Error in getAllInstructors:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการดึงข้อมูลอาจารย์',
        error: error.message
      });
    }
  },

  // GET /api/instructors/:id - ดูข้อมูลอาจารย์รายคน
  async getById(req, res) {
    try {
      const { id } = req.params;
      
      const result = await query(
        `SELECT i.instructor_id, i.instructor_code, i.title, i.department, i.specialization,
                i.max_students_per_session, i.created_at, i.updated_at,
                u.user_id, u.username, u.email, u.first_name, u.last_name, u.status
         FROM instructors i
         JOIN users u ON i.user_id = u.user_id
         WHERE i.instructor_id = $1`,
        [id]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'ไม่พบข้อมูลอาจารย์ที่ต้องการ'
        });
      }
      
      // Get teaching statistics
      const statsResult = await query(
        `SELECT 
           COUNT(s.schedule_id) as total_schedules,
           COUNT(CASE WHEN s.schedule_date >= CURRENT_DATE THEN 1 END) as upcoming_schedules,
           COUNT(DISTINCT sg.group_id) as total_groups_taught
         FROM schedules s
         LEFT JOIN schedule_groups sg ON s.schedule_id = sg.schedule_id
         WHERE s.instructor_id = $1`,
        [id]
      );
      
      const instructor = result.rows[0];
      instructor.teaching_stats = statsResult.rows[0];
      
      res.json({
        success: true,
        message: 'ดึงข้อมูลอาจารย์สำเร็จ',
        data: instructor
      });
    } catch (error) {
      console.error('Error in getInstructorById:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการดึงข้อมูลอาจารย์',
        error: error.message
      });
    }
  },

  // POST /api/instructors - เพิ่มอาจารย์ใหม่
  async create(req, res) {
    try {
      const { userId, instructorCode, title, department, specialization, maxStudentsPerSession } = req.body;
      
      // ตรวจสอบว่า user มีอยู่และเป็น instructor role
      const userCheck = await query(
        'SELECT user_id, role FROM users WHERE user_id = $1',
        [userId]
      );
      
      if (userCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'ไม่พบข้อมูลผู้ใช้ที่ระบุ'
        });
      }
      
      if (userCheck.rows[0].role !== 'instructor') {
        return res.status(400).json({
          success: false,
          message: 'ผู้ใช้ต้องมี role เป็น instructor'
        });
      }
      
      // ตรวจสอบว่า user ยังไม่เป็นอาจารย์
      const existingInstructor = await query(
        'SELECT instructor_id FROM instructors WHERE user_id = $1',
        [userId]
      );
      
      if (existingInstructor.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'ผู้ใช้นี้เป็นอาจารย์อยู่แล้ว'
        });
      }
      
      // ตรวจสอบว่ารหัสอาจารย์ซ้ำหรือไม่
      if (instructorCode) {
        const codeCheck = await query(
          'SELECT instructor_id FROM instructors WHERE instructor_code = $1',
          [instructorCode]
        );
        
        if (codeCheck.rows.length > 0) {
          return res.status(409).json({
            success: false,
            message: 'รหัสอาจารย์นี้มีการใช้งานแล้ว'
          });
        }
      }
      
      const result = await query(
        `INSERT INTO instructors (user_id, instructor_code, title, department, specialization, max_students_per_session, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
         RETURNING instructor_id, user_id, instructor_code, title, department, specialization, max_students_per_session, created_at`,
        [userId, instructorCode, title, department, specialization, maxStudentsPerSession]
      );
      
      res.status(201).json({
        success: true,
        message: 'เพิ่มอาจารย์ใหม่สำเร็จ',
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Error in createInstructor:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการเพิ่มอาจารย์ใหม่',
        error: error.message
      });
    }
  },

  // PUT /api/instructors/:id - แก้ไขข้อมูลอาจารย์
  async update(req, res) {
    try {
      const { id } = req.params;
      const { title, department, specialization, maxStudentsPerSession } = req.body;
      
      // ตรวจสอบว่าอาจารย์มีอยู่หรือไม่
      const checkResult = await query(
        'SELECT instructor_id FROM instructors WHERE instructor_id = $1',
        [id]
      );
      
      if (checkResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'ไม่พบข้อมูลอาจารย์ที่ต้องการแก้ไข'
        });
      }
      
      const result = await query(
        `UPDATE instructors 
         SET title = COALESCE($1, title),
             department = COALESCE($2, department),
             specialization = COALESCE($3, specialization),
             max_students_per_session = COALESCE($4, max_students_per_session),
             updated_at = NOW()
         WHERE instructor_id = $5
         RETURNING instructor_id, user_id, instructor_code, title, department, specialization, max_students_per_session, updated_at`,
        [title, department, specialization, maxStudentsPerSession, id]
      );
      
      res.json({
        success: true,
        message: 'แก้ไขข้อมูลอาจารย์สำเร็จ',
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Error in updateInstructor:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการแก้ไขข้อมูลอาจารย์',
        error: error.message
      });
    }
  },

  // DELETE /api/instructors/:id - ลบอาจารย์
  async delete(req, res) {
    try {
      const { id } = req.params;
      
      // ตรวจสอบว่าอาจารย์มีอยู่หรือไม่
      const checkResult = await query(
        'SELECT instructor_id, instructor_code FROM instructors WHERE instructor_id = $1',
        [id]
      );
      
      if (checkResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'ไม่พบข้อมูลอาจารย์ที่ต้องการลบ'
        });
      }
      
      // ตรวจสอบว่าอาจารย์มีตารางสอนหรือไม่
      const scheduleCheck = await query(
        'SELECT schedule_id FROM schedules WHERE instructor_id = $1',
        [id]
      );
      
      if (scheduleCheck.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'ไม่สามารถลบอาจารย์ได้ เนื่องจากมีตารางสอนที่เชื่อมโยงอยู่'
        });
      }
      
      await query('DELETE FROM instructors WHERE instructor_id = $1', [id]);
      
      res.json({
        success: true,
        message: 'ลบอาจารย์สำเร็จ'
      });
    } catch (error) {
      console.error('Error in deleteInstructor:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการลบอาจารย์',
        error: error.message
      });
    }
  },

  // GET /api/instructors/:id/schedule - ดูตารางสอนของอาจารย์
  async getSchedule(req, res) {
    try {
      const { id } = req.params;
      const { startDate, endDate, page = 1, limit = 50 } = req.query;
      const offset = (page - 1) * limit;
      
      let whereClause = 'WHERE s.instructor_id = $1';
      let params = [id];
      let paramCount = 1;
      
      if (startDate) {
        paramCount++;
        whereClause += ` AND s.schedule_date >= $${paramCount}`;
        params.push(startDate);
      }
      
      if (endDate) {
        paramCount++;
        whereClause += ` AND s.schedule_date <= $${paramCount}`;
        params.push(endDate);
      }
      
      const result = await query(
        `SELECT s.schedule_id, s.schedule_date, s.start_time, s.end_time, s.status,
                c.course_name, c.course_code,
                at.type_name,
                l.location_name, l.building,
                string_agg(g.group_name, ', ') as groups
         FROM schedules s
         JOIN courses c ON s.course_id = c.course_id
         JOIN activity_types at ON s.activity_type_id = at.activity_type_id
         JOIN locations l ON s.location_id = l.location_id
         LEFT JOIN schedule_groups sg ON s.schedule_id = sg.schedule_id
         LEFT JOIN groups g ON sg.group_id = g.group_id
         ${whereClause}
         GROUP BY s.schedule_id, c.course_name, c.course_code, at.type_name, l.location_name, l.building
         ORDER BY s.schedule_date ASC, s.start_time ASC
         LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
        [...params, limit, offset]
      );
      
      res.json({
        success: true,
        message: 'ดึงตารางสอนของอาจารย์สำเร็จ',
        data: result.rows
      });
    } catch (error) {
      console.error('Error in getInstructorSchedule:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการดึงตารางสอนของอาจารย์',
        error: error.message
      });
    }
  },

  // GET /api/instructors/:id/students - ดูนักศึกษาที่อาจารย์ดูแล
  async getStudents(req, res) {
    try {
      const { id } = req.params;
      const { page = 1, limit = 50 } = req.query;
      const offset = (page - 1) * limit;
      
      const result = await query(
        `SELECT DISTINCT st.student_id, st.student_code, st.first_name, st.last_name, 
                st.email, st.year_level, st.status,
                sec.section_name, g.group_name
         FROM students st
         JOIN groups g ON st.group_id = g.group_id
         JOIN sections sec ON st.section_id = sec.section_id
         JOIN schedule_groups sg ON g.group_id = sg.group_id
         JOIN schedules s ON sg.schedule_id = s.schedule_id
         WHERE s.instructor_id = $1 AND st.status = 'active'
         ORDER BY st.student_code ASC
         LIMIT $2 OFFSET $3`,
        [id, limit, offset]
      );
      
      res.json({
        success: true,
        message: 'ดึงข้อมูลนักศึกษาที่อาจารย์ดูแลสำเร็จ',
        data: result.rows
      });
    } catch (error) {
      console.error('Error in getInstructorStudents:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการดึงข้อมูลนักศึกษาที่อาจารย์ดูแล',
        error: error.message
      });
    }
  }
};

module.exports = instructorController;
