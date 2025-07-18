const { query } = require('../config/database');

const groupController = {
  // GET /api/groups - ดูกลุ่มทั้งหมด
  async getAll(req, res) {
    try {
      const { page = 1, limit = 10, search = '', sectionId = '' } = req.query;
      const offset = (page - 1) * limit;
      
      let whereClause = 'WHERE 1=1';
      let params = [];
      let paramCount = 0;
      
      if (search) {
        paramCount++;
        whereClause += ` AND (g.group_name ILIKE $${paramCount} OR g.group_code ILIKE $${paramCount})`;
        params.push(`%${search}%`);
      }
      
      if (sectionId) {
        paramCount++;
        whereClause += ` AND g.section_id = $${paramCount}`;
        params.push(sectionId);
      }
      
      const groupsQuery = `
        SELECT g.group_id, g.group_name, g.group_code, g.capacity, g.description, g.status, 
               g.created_at, g.updated_at,
               s.section_name, s.section_code, s.year_level, s.academic_year,
               COUNT(st.student_id) as current_students
        FROM groups g
        LEFT JOIN sections s ON g.section_id = s.section_id
        LEFT JOIN students st ON g.group_id = st.group_id AND st.status = 'active'
        ${whereClause}
        GROUP BY g.group_id, g.group_name, g.group_code, g.capacity, g.description, g.status,
                 g.created_at, g.updated_at, s.section_name, s.section_code, s.year_level, s.academic_year
        ORDER BY s.academic_year DESC, s.section_code ASC, g.group_code ASC
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `;
      params.push(limit, offset);
      
      const result = await query(groupsQuery, params);
      
      // Count total for pagination
      const countQuery = `
        SELECT COUNT(*) 
        FROM groups g
        LEFT JOIN sections s ON g.section_id = s.section_id
        ${whereClause}
      `;
      const countResult = await query(countQuery, params.slice(0, paramCount));
      const total = parseInt(countResult.rows[0].count);
      
      res.json({
        success: true,
        message: 'ดึงข้อมูลกลุ่มสำเร็จ',
        data: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: total,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('Error in getAllGroups:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการดึงข้อมูลกลุ่ม',
        error: error.message
      });
    }
  },

  // GET /api/groups/:id - ดูข้อมูลกลุ่ม
  async getById(req, res) {
    try {
      const { id } = req.params;
      
      const result = await query(
        `SELECT g.group_id, g.group_name, g.group_code, g.capacity, g.description, g.status,
                g.created_at, g.updated_at,
                s.section_id, s.section_name, s.section_code, s.year_level, s.academic_year,
                COUNT(st.student_id) as current_students
         FROM groups g
         LEFT JOIN sections s ON g.section_id = s.section_id
         LEFT JOIN students st ON g.group_id = st.group_id AND st.status = 'active'
         WHERE g.group_id = $1
         GROUP BY g.group_id, g.group_name, g.group_code, g.capacity, g.description, g.status,
                  g.created_at, g.updated_at, s.section_id, s.section_name, s.section_code, 
                  s.year_level, s.academic_year`,
        [id]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'ไม่พบข้อมูลกลุ่มที่ต้องการ'
        });
      }
      
      // ดึงข้อมูลนักศึกษาในกลุ่มนี้
      const studentsResult = await query(
        `SELECT student_id, student_code, first_name, last_name, email, year_level, status
         FROM students
         WHERE group_id = $1
         ORDER BY student_code ASC`,
        [id]
      );
      
      const groupData = result.rows[0];
      groupData.students = studentsResult.rows;
      
      res.json({
        success: true,
        message: 'ดึงข้อมูลกลุ่มสำเร็จ',
        data: groupData
      });
    } catch (error) {
      console.error('Error in getGroupById:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการดึงข้อมูลกลุ่ม',
        error: error.message
      });
    }
  },

  // POST /api/groups - เพิ่มกลุ่มใหม่
  async create(req, res) {
    try {
      const { sectionId, groupName, groupCode, capacity, description } = req.body;
      
      // ตรวจสอบว่าหมู่เรียนมีอยู่หรือไม่
      const sectionCheck = await query(
        'SELECT section_id FROM sections WHERE section_id = $1',
        [sectionId]
      );
      
      if (sectionCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'ไม่พบข้อมูลหมู่เรียนที่ระบุ'
        });
      }
      
      // ตรวจสอบว่ารหัสกลุ่มซ้ำในหมู่เรียนเดียวกันหรือไม่
      const existingGroup = await query(
        'SELECT group_id FROM groups WHERE section_id = $1 AND group_code = $2',
        [sectionId, groupCode]
      );
      
      if (existingGroup.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'รหัสกลุ่มนี้มีการใช้งานแล้วในหมู่เรียนนี้'
        });
      }
      
      const result = await query(
        `INSERT INTO groups (section_id, group_name, group_code, capacity, description, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
         RETURNING group_id, section_id, group_name, group_code, capacity, description, status, created_at`,
        [sectionId, groupName, groupCode, capacity, description]
      );
      
      res.status(201).json({
        success: true,
        message: 'เพิ่มกลุ่มใหม่สำเร็จ',
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Error in createGroup:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการเพิ่มกลุ่มใหม่',
        error: error.message
      });
    }
  },

  // PUT /api/groups/:id - แก้ไขกลุ่ม
  async update(req, res) {
    try {
      const { id } = req.params;
      const { groupName, capacity, description, status } = req.body;
      
      // ตรวจสอบว่ากลุ่มมีอยู่หรือไม่
      const checkResult = await query(
        'SELECT group_id FROM groups WHERE group_id = $1',
        [id]
      );
      
      if (checkResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'ไม่พบข้อมูลกลุ่มที่ต้องการแก้ไข'
        });
      }
      
      const result = await query(
        `UPDATE groups 
         SET group_name = COALESCE($1, group_name),
             capacity = COALESCE($2, capacity),
             description = COALESCE($3, description),
             status = COALESCE($4, status),
             updated_at = NOW()
         WHERE group_id = $5
         RETURNING group_id, section_id, group_name, group_code, capacity, description, status, updated_at`,
        [groupName, capacity, description, status, id]
      );
      
      res.json({
        success: true,
        message: 'แก้ไขกลุ่มสำเร็จ',
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Error in updateGroup:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการแก้ไขกลุ่ม',
        error: error.message
      });
    }
  },

  // DELETE /api/groups/:id - ลบกลุ่ม
  async delete(req, res) {
    try {
      const { id } = req.params;
      
      // ตรวจสอบว่ากลุ่มมีอยู่หรือไม่
      const checkResult = await query(
        'SELECT group_id, group_name FROM groups WHERE group_id = $1',
        [id]
      );
      
      if (checkResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'ไม่พบข้อมูลกลุ่มที่ต้องการลบ'
        });
      }
      
      // ตรวจสอบว่ามีนักศึกษาในกลุ่มหรือไม่
      const studentsCheck = await query(
        'SELECT student_id FROM students WHERE group_id = $1',
        [id]
      );
      
      if (studentsCheck.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'ไม่สามารถลบกลุ่มได้ เนื่องจากมีนักศึกษาที่เชื่อมโยงอยู่'
        });
      }
      
      // ตรวจสอบว่ามีตารางการฝึกที่เชื่อมโยงหรือไม่
      const scheduleCheck = await query(
        'SELECT schedule_group_id FROM schedule_groups WHERE group_id = $1',
        [id]
      );
      
      if (scheduleCheck.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'ไม่สามารถลบกลุ่มได้ เนื่องจากมีตารางการฝึกที่เชื่อมโยงอยู่'
        });
      }
      
      await query('DELETE FROM groups WHERE group_id = $1', [id]);
      
      res.json({
        success: true,
        message: 'ลบกลุ่มสำเร็จ'
      });
    } catch (error) {
      console.error('Error in deleteGroup:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการลบกลุ่ม',
        error: error.message
      });
    }
  },

  // GET /api/groups/section/:sectionId - ดูกลุ่มตาม Section
  async getBySection(req, res) {
    try {
      const { sectionId } = req.params;
      
      const result = await query(
        `SELECT g.group_id, g.group_name, g.group_code, g.capacity, g.description, g.status,
                COUNT(st.student_id) as current_students
         FROM groups g
         LEFT JOIN students st ON g.group_id = st.group_id AND st.status = 'active'
         WHERE g.section_id = $1
         GROUP BY g.group_id, g.group_name, g.group_code, g.capacity, g.description, g.status
         ORDER BY g.group_code ASC`,
        [sectionId]
      );
      
      res.json({
        success: true,
        message: 'ดึงข้อมูลกลุ่มตามหมู่เรียนสำเร็จ',
        data: result.rows
      });
    } catch (error) {
      console.error('Error in getGroupsBySection:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการดึงข้อมูลกลุ่มตามหมู่เรียน',
        error: error.message
      });
    }
  }
};

module.exports = groupController;
