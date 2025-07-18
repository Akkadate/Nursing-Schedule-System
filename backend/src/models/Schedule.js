// models/Schedule.js
const pool = require('../config/database');

class Schedule {
  // ดึงข้อมูลตารางทั้งหมด
  static async findAll(options = {}) {
    try {
      const { 
        page = 1, 
        limit = 10, 
        search = '', 
        startDate = '', 
        endDate = '',
        instructorId = '',
        locationId = '',
        courseId = '',
        status = ''
      } = options;
      
      const offset = (page - 1) * limit;
      
      let query = `
        SELECT 
          s.schedule_id,
          s.schedule_date,
          s.start_time,
          s.end_time,
          s.max_students,
          s.current_students,
          s.description,
          s.notes,
          s.status,
          s.created_at,
          s.updated_at,
          c.course_name,
          c.course_code,
          at.type_name as activity_type_name,
          at.color_code,
          i.first_name as instructor_first_name,
          i.last_name as instructor_last_name,
          inst.instructor_code,
          l.location_name,
          l.location_code,
          u.first_name as created_by_first_name,
          u.last_name as created_by_last_name
        FROM schedules s
        LEFT JOIN courses c ON s.course_id = c.course_id
        LEFT JOIN activity_types at ON s.activity_type_id = at.activity_type_id
        LEFT JOIN instructors inst ON s.instructor_id = inst.instructor_id
        LEFT JOIN users i ON inst.user_id = i.user_id
        LEFT JOIN locations l ON s.location_id = l.location_id
        LEFT JOIN users u ON s.created_by = u.user_id
        WHERE 1=1
      `;
      
      let params = [];
      let paramCount = 0;
      
      if (search) {
        paramCount++;
        query += ` AND (c.course_name ILIKE $${paramCount} OR l.location_name ILIKE $${paramCount} OR s.description ILIKE $${paramCount})`;
        params.push(`%${search}%`);
      }
      
      if (startDate) {
        paramCount++;
        query += ` AND s.schedule_date >= $${paramCount}`;
        params.push(startDate);
      }
      
      if (endDate) {
        paramCount++;
        query += ` AND s.schedule_date <= $${paramCount}`;
        params.push(endDate);
      }
      
      if (instructorId) {
        paramCount++;
        query += ` AND s.instructor_id = $${paramCount}`;
        params.push(instructorId);
      }
      
      if (locationId) {
        paramCount++;
        query += ` AND s.location_id = $${paramCount}`;
        params.push(locationId);
      }
      
      if (courseId) {
        paramCount++;
        query += ` AND s.course_id = $${paramCount}`;
        params.push(courseId);
      }
      
      if (status) {
        paramCount++;
        query += ` AND s.status = $${paramCount}`;
        params.push(status);
      }
      
      query += ` ORDER BY s.schedule_date DESC, s.start_time ASC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
      params.push(limit, offset);
      
      const result = await pool.query(query, params);
      
      // Count total
      let countQuery = `
        SELECT COUNT(*) 
        FROM schedules s
        LEFT JOIN courses c ON s.course_id = c.course_id
        LEFT JOIN locations l ON s.location_id = l.location_id
        WHERE 1=1
      `;
      
      let countParams = [];
      let countParamCount = 0;
      
      if (search) {
        countParamCount++;
        countQuery += ` AND (c.course_name ILIKE $${countParamCount} OR l.location_name ILIKE $${countParamCount} OR s.description ILIKE $${countParamCount})`;
        countParams.push(`%${search}%`);
      }
      
      if (startDate) {
        countParamCount++;
        countQuery += ` AND s.schedule_date >= $${countParamCount}`;
        countParams.push(startDate);
      }
      
      if (endDate) {
        countParamCount++;
        countQuery += ` AND s.schedule_date <= $${countParamCount}`;
        countParams.push(endDate);
      }
      
      if (instructorId) {
        countParamCount++;
        countQuery += ` AND s.instructor_id = $${countParamCount}`;
        countParams.push(instructorId);
      }
      
      if (locationId) {
        countParamCount++;
        countQuery += ` AND s.location_id = $${countParamCount}`;
        countParams.push(locationId);
      }
      
      if (courseId) {
        countParamCount++;
        countQuery += ` AND s.course_id = $${countParamCount}`;
        countParams.push(courseId);
      }
      
      if (status) {
        countParamCount++;
        countQuery += ` AND s.status = $${countParamCount}`;
        countParams.push(status);
      }
      
      const countResult = await pool.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0].count);
      
      return {
        data: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: total,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      throw error;
    }
  }
  
  // ดึงข้อมูลตารางตาม ID
  static async findById(scheduleId) {
    try {
      const result = await pool.query(`
        SELECT 
          s.*,
          c.course_name,
          c.course_code,
          at.type_name as activity_type_name,
          at.color_code,
          i.first_name as instructor_first_name,
          i.last_name as instructor_last_name,
          inst.instructor_code,
          l.location_name,
          l.location_code,
          u.first_name as created_by_first_name,
          u.last_name as created_by_last_name
        FROM schedules s
        LEFT JOIN courses c ON s.course_id = c.course_id
        LEFT JOIN activity_types at ON s.activity_type_id = at.activity_type_id
        LEFT JOIN instructors inst ON s.instructor_id = inst.instructor_id
        LEFT JOIN users i ON inst.user_id = i.user_id
        LEFT JOIN locations l ON s.location_id = l.location_id
        LEFT JOIN users u ON s.created_by = u.user_id
        WHERE s.schedule_id = $1
      `, [scheduleId]);
      
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  }
  
  // สร้างตารางใหม่
  static async create(scheduleData) {
    try {
      const {
        course_id,
        activity_type_id,
        instructor_id,
        location_id,
        schedule_date,
        start_time,
        end_time,
        max_students,
        description,
        notes,
        status = 'scheduled',
        created_by
      } = scheduleData;
      
      const result = await pool.query(`
        INSERT INTO schedules (
          course_id, activity_type_id, instructor_id, location_id,
          schedule_date, start_time, end_time, max_students,
          current_students, description, notes, status, created_by,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, $9, $10, $11, $12, NOW(), NOW())
        RETURNING *
      `, [
        course_id, activity_type_id, instructor_id, location_id,
        schedule_date, start_time, end_time, max_students,
        description, notes, status, created_by
      ]);
      
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }
  
  // แก้ไขตาราง
  static async update(scheduleId, scheduleData) {
    try {
      const {
        course_id,
        activity_type_id,
        instructor_id,
        location_id,
        schedule_date,
        start_time,
        end_time,
        max_students,
        description,
        notes,
        status
      } = scheduleData;
      
      const result = await pool.query(`
        UPDATE schedules SET
          course_id = $2,
          activity_type_id = $3,
          instructor_id = $4,
          location_id = $5,
          schedule_date = $6,
          start_time = $7,
          end_time = $8,
          max_students = $9,
          description = $10,
          notes = $11,
          status = $12,
          updated_at = NOW()
        WHERE schedule_id = $1
        RETURNING *
      `, [
        scheduleId, course_id, activity_type_id, instructor_id, location_id,
        schedule_date, start_time, end_time, max_students,
        description, notes, status
      ]);
      
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  }
  
  // ลบตาราง
  static async delete(scheduleId) {
    try {
      const result = await pool.query(
        'DELETE FROM schedules WHERE schedule_id = $1 RETURNING *',
        [scheduleId]
      );
      
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  }
  
  // ตรวจสอบความขัดแย้งของตาราง
  static async checkConflicts(scheduleData, excludeScheduleId = null) {
    try {
      const {
        instructor_id,
        location_id,
        schedule_date,
        start_time,
        end_time
      } = scheduleData;
      
      let query = `
        SELECT 
          s.schedule_id,
          s.schedule_date,
          s.start_time,
          s.end_time,
          'instructor' as conflict_type,
          CONCAT(u.first_name, ' ', u.last_name) as conflict_with
        FROM schedules s
        JOIN instructors inst ON s.instructor_id = inst.instructor_id
        JOIN users u ON inst.user_id = u.user_id
        WHERE s.instructor_id = $1
        AND s.schedule_date = $2
        AND s.status != 'cancelled'
        AND (
          (s.start_time <= $3 AND s.end_time > $3) OR
          (s.start_time < $4 AND s.end_time >= $4) OR
          (s.start_time >= $3 AND s.end_time <= $4)
        )
        
        UNION ALL
        
        SELECT 
          s.schedule_id,
          s.schedule_date,
          s.start_time,
          s.end_time,
          'location' as conflict_type,
          l.location_name as conflict_with
        FROM schedules s
        JOIN locations l ON s.location_id = l.location_id
        WHERE s.location_id = $5
        AND s.schedule_date = $2
        AND s.status != 'cancelled'
        AND (
          (s.start_time <= $3 AND s.end_time > $3) OR
          (s.start_time < $4 AND s.end_time >= $4) OR
          (s.start_time >= $3 AND s.end_time <= $4)
        )
      `;
      
      let params = [instructor_id, schedule_date, start_time, end_time, location_id];
      
      if (excludeScheduleId) {
        query += ` AND s.schedule_id != $6`;
        params.push(excludeScheduleId);
      }
      
      const result = await pool.query(query, params);
      return result.rows;
    } catch (error) {
      throw error;
    }
  }
  
  // ดึงตารางสำหรับ Calendar view
  static async getCalendarData(startDate, endDate, instructorId = null) {
    try {
      let query = `
        SELECT 
          s.schedule_id,
          s.schedule_date,
          s.start_time,
          s.end_time,
          s.status,
          c.course_name,
          c.course_code,
          at.type_name as activity_type_name,
          at.color_code,
          CONCAT(u.first_name, ' ', u.last_name) as instructor_name,
          l.location_name,
          s.current_students,
          s.max_students
        FROM schedules s
        LEFT JOIN courses c ON s.course_id = c.course_id
        LEFT JOIN activity_types at ON s.activity_type_id = at.activity_type_id
        LEFT JOIN instructors inst ON s.instructor_id = inst.instructor_id
        LEFT JOIN users u ON inst.user_id = u.user_id
        LEFT JOIN locations l ON s.location_id = l.location_id
        WHERE s.schedule_date BETWEEN $1 AND $2
        AND s.status != 'cancelled'
      `;
      
      let params = [startDate, endDate];
      
      if (instructorId) {
        query += ` AND s.instructor_id = $3`;
        params.push(instructorId);
      }
      
      query += ` ORDER BY s.schedule_date, s.start_time`;
      
      const result = await pool.query(query, params);
      return result.rows;
    } catch (error) {
      throw error;
    }
  }
  
  // ดึงตารางของอาจารย์
  static async findByInstructor(instructorId, options = {}) {
    try {
      const { startDate, endDate, status } = options;
      
      let query = `
        SELECT 
          s.*,
          c.course_name,
          c.course_code,
          at.type_name as activity_type_name,
          at.color_code,
          l.location_name,
          l.location_code
        FROM schedules s
        LEFT JOIN courses c ON s.course_id = c.course_id
        LEFT JOIN activity_types at ON s.activity_type_id = at.activity_type_id
        LEFT JOIN locations l ON s.location_id = l.location_id
        WHERE s.instructor_id = $1
      `;
      
      let params = [instructorId];
      let paramCount = 1;
      
      if (startDate) {
        paramCount++;
        query += ` AND s.schedule_date >= $${paramCount}`;
        params.push(startDate);
      }
      
      if (endDate) {
        paramCount++;
        query += ` AND s.schedule_date <= $${paramCount}`;
        params.push(endDate);
      }
      
      if (status) {
        paramCount++;
        query += ` AND s.status = $${paramCount}`;
        params.push(status);
      }
      
      query += ` ORDER BY s.schedule_date DESC, s.start_time ASC`;
      
      const result = await pool.query(query, params);
      return result.rows;
    } catch (error) {
      throw error;
    }
  }
  
  // ดึงตารางของกลุ่ม
  static async findByGroup(groupId, options = {}) {
    try {
      const { startDate, endDate, status } = options;
      
      let query = `
        SELECT 
          s.*,
          c.course_name,
          c.course_code,
          at.type_name as activity_type_name,
          at.color_code,
          CONCAT(u.first_name, ' ', u.last_name) as instructor_name,
          l.location_name,
          l.location_code
        FROM schedules s
        JOIN schedule_groups sg ON s.schedule_id = sg.schedule_id
        LEFT JOIN courses c ON s.course_id = c.course_id
        LEFT JOIN activity_types at ON s.activity_type_id = at.activity_type_id
        LEFT JOIN instructors inst ON s.instructor_id = inst.instructor_id
        LEFT JOIN users u ON inst.user_id = u.user_id
        LEFT JOIN locations l ON s.location_id = l.location_id
        WHERE sg.group_id = $1
        AND sg.status = 'active'
      `;
      
      let params = [groupId];
      let paramCount = 1;
      
      if (startDate) {
        paramCount++;
        query += ` AND s.schedule_date >= $${paramCount}`;
        params.push(startDate);
      }
      
      if (endDate) {
        paramCount++;
        query += ` AND s.schedule_date <= $${paramCount}`;
        params.push(endDate);
      }
      
      if (status) {
        paramCount++;
        query += ` AND s.status = $${paramCount}`;
        params.push(status);
      }
      
      query += ` ORDER BY s.schedule_date DESC, s.start_time ASC`;
      
      const result = await pool.query(query, params);
      return result.rows;
    } catch (error) {
      throw error;
    }
  }
  
  // อัพเดทจำนวนนักศึกษาปัจจุบัน
  static async updateCurrentStudents(scheduleId) {
    try {
      const result = await pool.query(`
        UPDATE schedules 
        SET current_students = (
          SELECT COUNT(DISTINCT st.student_id)
          FROM schedule_groups sg
          JOIN groups g ON sg.group_id = g.group_id
          JOIN students st ON g.group_id = st.group_id
          WHERE sg.schedule_id = $1
          AND sg.status = 'active'
          AND st.status = 'active'
        ),
        updated_at = NOW()
        WHERE schedule_id = $1
        RETURNING current_students
      `, [scheduleId]);
      
      return result.rows[0]?.current_students || 0;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = Schedule;
