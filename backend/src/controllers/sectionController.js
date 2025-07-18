const { query } = require('../config/database');

const sectionController = {
  // GET /api/sections - ดูหมู่เรียนทั้งหมด
  async getAll(req, res) {
    try {
      const { page = 1, limit = 10, search = '', yearLevel = '', academicYear = '', semester = '' } = req.query;
      const offset = (page - 1) * limit;
      
      let whereClause = 'WHERE 1=1';
      let params = [];
      let paramCount = 0;
      
      if (search) {
        paramCount++;
        whereClause += ` AND (s.section_name ILIKE $${paramCount} OR s.section_code ILIKE $${paramCount})`;
        params.push(`%${search}%`);
      }
      
      if (yearLevel) {
        paramCount++;
        whereClause += ` AND s.year_level = $${paramCount}`;
        params.push(yearLevel);
      }
      
      if (academicYear) {
        paramCount++;
        whereClause += ` AND s.academic_year = $${paramCount}`;
        params.push(academicYear);
      }
      
      if (semester) {
        paramCount++;
        whereClause += ` AND s.semester = $${paramCount}`;
        params.push(semester);
      }
      
      const sectionsQuery = `
        SELECT s.section_id, s.section_name, s.section_code, s.year_level, s.academic_year, 
               s.semester, s.capacity, s.description, s.status, s.created_at, s.updated_at,
               COUNT(st.student_id) as current_students,
               COUNT(g.group_id) as total_groups
        FROM sections s
        LEFT JOIN students st ON s.section_id = st.section_id AND st.status = 'active'
        LEFT JOIN groups g ON s.section_id = g.section_id AND g.status = 'active'
        ${whereClause}
        GROUP BY s.section_id, s.section_name, s.section_code, s.year_level, s.academic_year, 
                 s.semester, s.capacity, s.description, s.status, s.created_at, s.updated_at
        ORDER BY s.academic_year DESC, s.year_level ASC, s.section_code ASC
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `;
      params.push(limit, offset);
      
      const result = await query(sectionsQuery, params);
      
      // Count total for pagination
      const countQuery = `SELECT COUNT(*) FROM sections s ${whereClause}`;
      const countResult = await query(countQuery, params.slice(0, paramCount));
      const total = parseInt(countResult.rows[0].count);
      
      res.json({
        success: true,
        message: 'ดึงข้อมูลหมู่เรียนสำเร็จ',
        data: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: total,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('Error in getAllSections:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการดึงข้อมูลหมู่เรียน',
        error: error.message
      });
    }
  },

  // GET /api/sections/:id - ดูข้อมูลหมู่เรียน
  async getById(req, res) {
    try {
      const { id } = req.params;
      
      const result = await query(
        `SELECT s.section_id, s.section_name, s.section_code, s.year_level, s.academic_year,
                s.semester, s.capacity, s.description, s.status, s.created_at, s.updated_at,
                COUNT(st.student_id) as current_students,
                COUNT(g.group_id) as total_groups
         FROM sections s
         LEFT JOIN students st ON s.section_id = st.section_id AND st.status = 'active'
         LEFT JOIN groups g ON s.section_id = g.section_id AND g.status = 'active'
         WHERE s.section_id = $1
         GROUP BY s.section_id, s.section_name, s.section_code, s.year_level, s.academic_year,
                  s.semester, s.capacity, s.description, s.status, s.created_at, s.updated_at`,
        [id]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'ไม่พบข้อมูลหมู่เรียนที่ต้องการ'
        });
      }
      
      // ดึงข้อมูลกลุ่มในหมู่เรียนนี้
      const groupsResult = await query(
        `SELECT group_id, group_name, group_code, capacity,
                COUNT(st.student_id) as current_students
         FROM groups g
         LEFT JOIN students st ON g.group_id = st.group_id AND st.status = 'active'
         WHERE g.section_id = $1 AND g.status = 'active'
         GROUP BY g.group_id, g.group_name, g.group_code, g.capacity
         ORDER BY g.group_code ASC`,
        [id]
      );
      
      const sectionData = result.rows[0];
      sectionData.groups = groupsResult.rows;
      
      res.json({
        success: true,
        message: 'ดึงข้อมูลหมู่เรียนสำเร็จ',
        data: sectionData
      });
    } catch (error) {
      console.error('Error in getSectionById:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการดึงข้อมูลหมู่เรียน',
        error: error.message
      });
    }
  },

  // POST /api/sections - เพิ่มหมู่เรียนใหม่
  async create(req, res) {
    try {
      const { sectionName, sectionCode, yearLevel, academicYear, semester, capacity, description } = req.body;
      
      // ตรวจสอบว่ารหัสหมู่เรียนซ้ำหรือไม่
      const existingSection = await query(
        'SELECT section_id FROM sections WHERE section_code = $1 AND academic_year = $2',
        [sectionCode, academicYear]
      );
      
      if (existingSection.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'รหัสหมู่เรียนนี้มีการใช้งานแล้วในปีการศึกษานี้'
        });
      }
      
      const result = await query(
        `INSERT INTO sections (section_name, section_code, year_level, academic_year, semester, capacity, description, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
         RETURNING section_id, section_name, section_code, year_level, academic_year, semester, capacity, description, status, created_at`,
        [sectionName, sectionCode, yearLevel, academicYear, semester, capacity, description]
      );
      
      res.status(201).json({
        success: true,
        message: 'เพิ่มหมู่เรียนใหม่สำเร็จ',
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Error in createSection:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการเพิ่มหมู่เรียนใหม่',
        error: error.message
      });
    }
  },

  // PUT /api/sections/:id - แก้ไขหมู่เรียน
  async update(req, res) {
    try {
      const { id } = req.params;
      const { sectionName, yearLevel, academicYear, semester, capacity, description, status } = req.body;
      
      // ตรวจสอบว่าหมู่เรียนมีอยู่หรือไม่
      const checkResult = await query(
        'SELECT section_id FROM sections WHERE section_id = $1',
        [id]
      );
      
      if (checkResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'ไม่พบข้อมูลหมู่เรียนที่ต้องการแก้ไข'
        });
      }
      
      const result = await query(
        `UPDATE sections 
         SET section_name = COALESCE($1, section_name),
             year_level = COALESCE($2, year_level),
             academic_year = COALESCE($3, academic_year),
             semester = COALESCE($4, semester),
             capacity = COALESCE($5, capacity),
             description = COALESCE($6, description),
             status = COALESCE($7, status),
             updated_at = NOW()
         WHERE section_id = $8
         RETURNING section_id, section_name, section_code, year_level, academic_year, semester, capacity, description, status, updated_at`,
        [sectionName, yearLevel, academicYear, semester, capacity, description, status, id]
      );
      
      res.json({
        success: true,
        message: 'แก้ไขหมู่เรียนสำเร็จ',
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Error in updateSection:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการแก้ไขหมู่เรียน',
        error: error.message
      });
    }
  },

  // DELETE /api/sections/:id - ลบหมู่เรียน
  async delete(req, res) {
    try {
      const { id } = req.params;
      
      // ตรวจสอบว่าหมู่เรียนมีอยู่หรือไม่
      const checkResult = await query(
        'SELECT section_id, section_name FROM sections WHERE section_id = $1',
        [id]
      );
      
      if (checkResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'ไม่พบข้อมูลหมู่เรียนที่ต้องการลบ'
        });
      }
      
      // ตรวจสอบว่ามีนักศึกษาในหมู่เรียนหรือไม่
      const studentsCheck = await query(
        'SELECT student_id FROM students WHERE section_id = $1',
        [id]
      );
      
      if (studentsCheck.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'ไม่สามารถลบหมู่เรียนได้ เนื่องจากมีนักศึกษาที่เชื่อมโยงอยู่'
        });
      }
      
      // ตรวจสอบว่ามีกลุ่มในหมู่เรียนหรือไม่
      const groupsCheck = await query(
        'SELECT group_id FROM groups WHERE section_id = $1',
        [id]
      );
      
      if (groupsCheck.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'ไม่สามารถลบหมู่เรียนได้ เนื่องจากมีกลุ่มที่เชื่อมโยงอยู่'
        });
      }
      
      await query('DELETE FROM sections WHERE section_id = $1', [id]);
      
      res.json({
        success: true,
        message: 'ลบหมู่เรียนสำเร็จ'
      });
    } catch (error) {
      console.error('Error in deleteSection:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการลบหมู่เรียน',
        error: error.message
      });
    }
  }
};

module.exports = sectionController;
