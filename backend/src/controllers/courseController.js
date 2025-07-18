const { query } = require('../config/database');

const courseController = {
  // GET /api/courses - ดูรายวิชาทั้งหมด
  async getAll(req, res) {
    try {
      const { page = 1, limit = 10, search = '', yearLevel = '', status = '' } = req.query;
      const offset = (page - 1) * limit;
      
      let whereClause = 'WHERE 1=1';
      let params = [];
      let paramCount = 0;
      
      if (search) {
        paramCount++;
        whereClause += ` AND (course_name ILIKE $${paramCount} OR course_code ILIKE $${paramCount})`;
        params.push(`%${search}%`);
      }
      
      if (yearLevel) {
        paramCount++;
        whereClause += ` AND year_level = $${paramCount}`;
        params.push(yearLevel);
      }
      
      if (status) {
        paramCount++;
        whereClause += ` AND status = $${paramCount}`;
        params.push(status);
      }
      
      const coursesQuery = `
        SELECT course_id, course_name, course_code, description, credits, year_level, semester, status, created_at, updated_at
        FROM courses 
        ${whereClause}
        ORDER BY year_level ASC, semester ASC, course_code ASC
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `;
      params.push(limit, offset);
      
      const result = await query(coursesQuery, params);
      
      // Count total for pagination
      const countQuery = `SELECT COUNT(*) FROM courses ${whereClause}`;
      const countResult = await query(countQuery, params.slice(0, paramCount));
      const total = parseInt(countResult.rows[0].count);
      
      res.json({
        success: true,
        message: 'ดึงข้อมูลรายวิชาสำเร็จ',
        data: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: total,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('Error in getAllCourses:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการดึงข้อมูลรายวิชา',
        error: error.message
      });
    }
  },

  // GET /api/courses/:id - ดูข้อมูลรายวิชา
  async getById(req, res) {
    try {
      const { id } = req.params;
      
      const result = await query(
        'SELECT * FROM courses WHERE course_id = $1',
        [id]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'ไม่พบข้อมูลรายวิชาที่ต้องการ'
        });
      }
      
      res.json({
        success: true,
        message: 'ดึงข้อมูลรายวิชาสำเร็จ',
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Error in getCourseById:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการดึงข้อมูลรายวิชา',
        error: error.message
      });
    }
  },

  // POST /api/courses - เพิ่มรายวิชาใหม่
  async create(req, res) {
    try {
      const { courseName, courseCode, description, credits, yearLevel, semester } = req.body;
      
      // ตรวจสอบว่ารหัสวิชาซ้ำหรือไม่
      const existingCourse = await query(
        'SELECT course_id FROM courses WHERE course_code = $1',
        [courseCode]
      );
      
      if (existingCourse.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'รหัสวิชานี้มีการใช้งานแล้ว'
        });
      }
      
      const result = await query(
        `INSERT INTO courses (course_name, course_code, description, credits, year_level, semester, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
         RETURNING course_id, course_name, course_code, description, credits, year_level, semester, status, created_at`,
        [courseName, courseCode, description, credits, yearLevel, semester]
      );
      
      res.status(201).json({
        success: true,
        message: 'เพิ่มรายวิชาใหม่สำเร็จ',
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Error in createCourse:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการเพิ่มรายวิชาใหม่',
        error: error.message
      });
    }
  },

  // PUT /api/courses/:id - แก้ไขรายวิชา
  async update(req, res) {
    try {
      const { id } = req.params;
      const { courseName, description, credits, yearLevel, semester, status } = req.body;
      
      // ตรวจสอบว่ารายวิชามีอยู่หรือไม่
      const checkResult = await query(
        'SELECT course_id FROM courses WHERE course_id = $1',
        [id]
      );
      
      if (checkResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'ไม่พบข้อมูลรายวิชาที่ต้องการแก้ไข'
        });
      }
      
      const result = await query(
        `UPDATE courses 
         SET course_name = COALESCE($1, course_name),
             description = COALESCE($2, description),
             credits = COALESCE($3, credits),
             year_level = COALESCE($4, year_level),
             semester = COALESCE($5, semester),
             status = COALESCE($6, status),
             updated_at = NOW()
         WHERE course_id = $7
         RETURNING course_id, course_name, course_code, description, credits, year_level, semester, status, updated_at`,
        [courseName, description, credits, yearLevel, semester, status, id]
      );
      
      res.json({
        success: true,
        message: 'แก้ไขรายวิชาสำเร็จ',
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Error in updateCourse:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการแก้ไขรายวิชา',
        error: error.message
      });
    }
  },

  // DELETE /api/courses/:id - ลบรายวิชา
  async delete(req, res) {
    try {
      const { id } = req.params;
      
      // ตรวจสอบว่ารายวิชามีอยู่หรือไม่
      const checkResult = await query(
        'SELECT course_id, course_name FROM courses WHERE course_id = $1',
        [id]
      );
      
      if (checkResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'ไม่พบข้อมูลรายวิชาที่ต้องการลบ'
        });
      }
      
      // ตรวจสอบว่ามีตารางเรียนที่ใช้รายวิชานี้หรือไม่
      const scheduleCheck = await query(
        'SELECT schedule_id FROM schedules WHERE course_id = $1',
        [id]
      );
      
      if (scheduleCheck.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'ไม่สามารถลบรายวิชาได้ เนื่องจากมีตารางเรียนที่เชื่อมโยงอยู่'
        });
      }
      
      await query('DELETE FROM courses WHERE course_id = $1', [id]);
      
      res.json({
        success: true,
        message: 'ลบรายวิชาสำเร็จ'
      });
    } catch (error) {
      console.error('Error in deleteCourse:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการลบรายวิชา',
        error: error.message
      });
    }
  },

  // GET /api/courses/activity-types - ดูประเภทกิจกรรมทั้งหมด
  async getAllActivityTypes(req, res) {
    try {
      const result = await query(
        'SELECT * FROM activity_types ORDER BY type_name ASC'
      );
      
      res.json({
        success: true,
        message: 'ดึงข้อมูลประเภทกิจกรรมสำเร็จ',
        data: result.rows
      });
    } catch (error) {
      console.error('Error in getAllActivityTypes:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการดึงข้อมูลประเภทกิจกรรม',
        error: error.message
      });
    }
  },

  // POST /api/courses/activity-types - เพิ่มประเภทกิจกรรมใหม่
  async createActivityType(req, res) {
    try {
      const { typeName, description, requiresAttendance, allowsScoring } = req.body;
      
      // ตรวจสอบว่าชื่อประเภทกิจกรรมซ้ำหรือไม่
      const existingType = await query(
        'SELECT activity_type_id FROM activity_types WHERE type_name = $1',
        [typeName]
      );
      
      if (existingType.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'ชื่อประเภทกิจกรรมนี้มีการใช้งานแล้ว'
        });
      }
      
      const result = await query(
        `INSERT INTO activity_types (type_name, description, requires_attendance, allows_scoring, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         RETURNING activity_type_id, type_name, description, requires_attendance, allows_scoring, created_at`,
        [typeName, description, requiresAttendance || false, allowsScoring || false]
      );
      
      res.status(201).json({
        success: true,
        message: 'เพิ่มประเภทกิจกรรมใหม่สำเร็จ',
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Error in createActivityType:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการเพิ่มประเภทกิจกรรมใหม่',
        error: error.message
      });
    }
  },

  // PUT /api/courses/activity-types/:id - แก้ไขประเภทกิจกรรม
  async updateActivityType(req, res) {
    try {
      const { id } = req.params;
      const { typeName, description, requiresAttendance, allowsScoring } = req.body;
      
      // ตรวจสอบว่าประเภทกิจกรรมมีอยู่หรือไม่
      const checkResult = await query(
        'SELECT activity_type_id FROM activity_types WHERE activity_type_id = $1',
        [id]
      );
      
      if (checkResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'ไม่พบข้อมูลประเภทกิจกรรมที่ต้องการแก้ไข'
        });
      }
      
      const result = await query(
        `UPDATE activity_types 
         SET type_name = COALESCE($1, type_name),
             description = COALESCE($2, description),
             requires_attendance = COALESCE($3, requires_attendance),
             allows_scoring = COALESCE($4, allows_scoring),
             updated_at = NOW()
         WHERE activity_type_id = $5
         RETURNING activity_type_id, type_name, description, requires_attendance, allows_scoring, updated_at`,
        [typeName, description, requiresAttendance, allowsScoring, id]
      );
      
      res.json({
        success: true,
        message: 'แก้ไขประเภทกิจกรรมสำเร็จ',
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Error in updateActivityType:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการแก้ไขประเภทกิจกรรม',
        error: error.message
      });
    }
  },

  // DELETE /api/courses/activity-types/:id - ลบประเภทกิจกรรม
  async deleteActivityType(req, res) {
    try {
      const { id } = req.params;
      
      // ตรวจสอบว่าประเภทกิจกรรมมีอยู่หรือไม่
      const checkResult = await query(
        'SELECT activity_type_id, type_name FROM activity_types WHERE activity_type_id = $1',
        [id]
      );
      
      if (checkResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'ไม่พบข้อมูลประเภทกิจกรรมที่ต้องการลบ'
        });
      }
      
      // ตรวจสอบว่ามีตารางเรียนที่ใช้ประเภทกิจกรรมนี้หรือไม่
      const scheduleCheck = await query(
        'SELECT schedule_id FROM schedules WHERE activity_type_id = $1',
        [id]
      );
      
      if (scheduleCheck.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'ไม่สามารถลบประเภทกิจกรรมได้ เนื่องจากมีตารางเรียนที่เชื่อมโยงอยู่'
        });
      }
      
      await query('DELETE FROM activity_types WHERE activity_type_id = $1', [id]);
      
      res.json({
        success: true,
        message: 'ลบประเภทกิจกรรมสำเร็จ'
      });
    } catch (error) {
      console.error('Error in deleteActivityType:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการลบประเภทกิจกรรม',
        error: error.message
      });
    }
  }
};

module.exports = courseController;
