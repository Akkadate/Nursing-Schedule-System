const { query, getClient } = require('../config/database');

class StudentService {
  // Get all students with filtering and pagination
  static async getAllStudents(options = {}) {
    try {
      const { 
        page = 1, 
        limit = 10, 
        search = '', 
        sectionId = '', 
        groupId = '', 
        yearLevel = '',
        status = '',
        sortBy = 'student_code',
        sortOrder = 'ASC'
      } = options;
      
      const offset = (page - 1) * limit;
      
      let whereClause = 'WHERE 1=1';
      let params = [];
      let paramCount = 0;
      
      // Search filter
      if (search) {
        paramCount++;
        whereClause += ` AND (s.student_code ILIKE $${paramCount} OR s.first_name ILIKE $${paramCount} OR s.last_name ILIKE $${paramCount} OR s.email ILIKE $${paramCount})`;
        params.push(`%${search}%`);
      }
      
      // Section filter
      if (sectionId) {
        paramCount++;
        whereClause += ` AND s.section_id = $${paramCount}`;
        params.push(sectionId);
      }
      
      // Group filter
      if (groupId) {
        paramCount++;
        whereClause += ` AND s.group_id = $${paramCount}`;
        params.push(groupId);
      }
      
      // Year level filter
      if (yearLevel) {
        paramCount++;
        whereClause += ` AND s.year_level = $${paramCount}`;
        params.push(yearLevel);
      }
      
      // Status filter
      if (status) {
        paramCount++;
        whereClause += ` AND s.status = $${paramCount}`;
        params.push(status);
      }
      
      // Validate sort column
      const allowedSortColumns = ['student_code', 'first_name', 'last_name', 'email', 'year_level', 'status', 'created_at'];
      const validSortBy = allowedSortColumns.includes(sortBy) ? `s.${sortBy}` : 's.student_code';
      const validSortOrder = ['ASC', 'DESC'].includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'ASC';
      
      const studentsQuery = `
        SELECT s.student_id, s.student_code, s.first_name, s.last_name, s.email, s.phone,
               s.year_level, s.status, s.created_at, s.updated_at,
               sec.section_id, sec.section_name, sec.section_code,
               g.group_id, g.group_name, g.group_code
        FROM students s
        LEFT JOIN sections sec ON s.section_id = sec.section_id
        LEFT JOIN groups g ON s.group_id = g.group_id
        ${whereClause}
        ORDER BY ${validSortBy} ${validSortOrder}
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
      
      return {
        students: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: total,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      throw new Error(`Error getting all students: ${error.message}`);
    }
  }

  // Get student by ID with detailed information
  static async getStudentById(studentId) {
    try {
      const studentResult = await query(
        `SELECT s.student_id, s.student_code, s.first_name, s.last_name, s.email, s.phone,
                s.year_level, s.status, s.created_at, s.updated_at,
                sec.section_id, sec.section_name, sec.section_code, sec.academic_year,
                g.group_id, g.group_name, g.group_code
         FROM students s
         LEFT JOIN sections sec ON s.section_id = sec.section_id
         LEFT JOIN groups g ON s.group_id = g.group_id
         WHERE s.student_id = $1`,
        [studentId]
      );
      
      if (studentResult.rows.length === 0) {
        throw new Error('Student not found');
      }
      
      const student = studentResult.rows[0];
      
      // Get attendance statistics
      const attendanceStats = await this.getStudentAttendanceStats(studentId);
      student.attendance_stats = attendanceStats;
      
      return student;
    } catch (error) {
      throw error;
    }
  }

  // Create new student
  static async createStudent(studentData) {
    const client = await getClient();
    
    try {
      await client.query('BEGIN');
      
      const { studentCode, firstName, lastName, email, phone, sectionId, groupId, yearLevel } = studentData;
      
      // Validate input data
      const validationErrors = this.validateStudentData(studentData);
      if (validationErrors.length > 0) {
        throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
      }
      
      // Check if student code already exists
      const existingStudent = await client.query(
        'SELECT student_id FROM students WHERE student_code = $1',
        [studentCode]
      );
      
      if (existingStudent.rows.length > 0) {
        throw new Error('Student code already exists');
      }
      
      // Check if email already exists (if provided)
      if (email) {
        const emailCheck = await client.query(
          'SELECT student_id FROM students WHERE email = $1',
          [email]
        );
        
        if (emailCheck.rows.length > 0) {
          throw new Error('Email already exists');
        }
      }
      
      // Validate section and group if provided
      if (sectionId) {
        const sectionCheck = await client.query('SELECT section_id FROM sections WHERE section_id = $1', [sectionId]);
        if (sectionCheck.rows.length === 0) {
          throw new Error('Section not found');
        }
      }
      
      if (groupId) {
        const groupCheck = await client.query('SELECT group_id, capacity FROM groups WHERE group_id = $1', [groupId]);
        if (groupCheck.rows.length === 0) {
          throw new Error('Group not found');
        }
        
        // Check group capacity
        const group = groupCheck.rows[0];
        if (group.capacity) {
          const currentCount = await client.query(
            'SELECT COUNT(*) FROM students WHERE group_id = $1 AND status = $2',
            [groupId, 'active']
          );
          
          if (parseInt(currentCount.rows[0].count) >= group.capacity) {
            throw new Error('Group is at full capacity');
          }
        }
      }
      
      // Create student
      const result = await client.query(
        `INSERT INTO students (student_code, first_name, last_name, email, phone, section_id, group_id, year_level, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
         RETURNING student_id, student_code, first_name, last_name, email, phone, section_id, group_id, year_level, status, created_at`,
        [studentCode, firstName, lastName, email, phone, sectionId, groupId, yearLevel]
      );
      
      await client.query('COMMIT');
      return result.rows[0];
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Update student
  static async updateStudent(studentId, updateData) {
    const client = await getClient();
    
    try {
      await client.query('BEGIN');
      
      const { firstName, lastName, email, phone, sectionId, groupId, yearLevel, status } = updateData;
      
      // Check if student exists
      const checkResult = await client.query(
        'SELECT student_id, group_id FROM students WHERE student_id = $1',
        [studentId]
      );
      
      if (checkResult.rows.length === 0) {
        throw new Error('Student not found');
      }
      
      const currentStudent = checkResult.rows[0];
      
      // Check email uniqueness if email is being updated
      if (email) {
        const emailCheck = await client.query(
          'SELECT student_id FROM students WHERE email = $1 AND student_id != $2',
          [email, studentId]
        );
        
        if (emailCheck.rows.length > 0) {
          throw new Error('Email already exists');
        }
      }
      
      // Check group capacity if group is being changed
      if (groupId && groupId !== currentStudent.group_id) {
        const groupCheck = await client.query('SELECT group_id, capacity FROM groups WHERE group_id = $1', [groupId]);
        if (groupCheck.rows.length === 0) {
          throw new Error('Group not found');
        }
        
        const group = groupCheck.rows[0];
        if (group.capacity) {
          const currentCount = await client.query(
            'SELECT COUNT(*) FROM students WHERE group_id = $1 AND status = $2 AND student_id != $3',
            [groupId, 'active', studentId]
          );
          
          if (parseInt(currentCount.rows[0].count) >= group.capacity) {
            throw new Error('Group is at full capacity');
          }
        }
      }
      
      // Update student
      const result = await client.query(
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
        [firstName, lastName, email, phone, sectionId, groupId, yearLevel, status, studentId]
      );
      
      await client.query('COMMIT');
      return result.rows[0];
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Delete student
  static async deleteStudent(studentId) {
    const client = await getClient();
    
    try {
      await client.query('BEGIN');
      
      // Check if student exists
      const checkResult = await client.query(
        'SELECT student_id, student_code FROM students WHERE student_id = $1',
        [studentId]
      );
      
      if (checkResult.rows.length === 0) {
        throw new Error('Student not found');
      }
      
      // Check if student has attendance records
      const attendanceCheck = await client.query(
        'SELECT attendance_id FROM attendance WHERE student_id = $1',
        [studentId]
      );
      
      if (attendanceCheck.rows.length > 0) {
        throw new Error('Cannot delete student with attendance records');
      }
      
      // Delete student
      await client.query('DELETE FROM students WHERE student_id = $1', [studentId]);
      
      await client.query('COMMIT');
      return true;
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Get students by section
  static async getStudentsBySection(sectionId, options = {}) {
    try {
      const { page = 1, limit = 50 } = options;
      const offset = (page - 1) * limit;
      
      const result = await query(
        `SELECT s.student_id, s.student_code, s.first_name, s.last_name, s.email, s.phone,
                s.year_level, s.status, g.group_id, g.group_name, g.group_code
         FROM students s
         LEFT JOIN groups g ON s.group_id = g.group_id
         WHERE s.section_id = $1
         ORDER BY s.student_code ASC
         LIMIT $2 OFFSET $3`,
        [sectionId, limit, offset]
      );
      
      return result.rows;
    } catch (error) {
      throw new Error(`Error getting students by section: ${error.message}`);
    }
  }

  // Get students by group
  static async getStudentsByGroup(groupId) {
    try {
      const result = await query(
        `SELECT s.student_id, s.student_code, s.first_name, s.last_name, s.email, s.phone,
                s.year_level, s.status, sec.section_name, sec.section_code
         FROM students s
         LEFT JOIN sections sec ON s.section_id = sec.section_id
         WHERE s.group_id = $1
         ORDER BY s.student_code ASC`,
        [groupId]
      );
      
      return result.rows;
    } catch (error) {
      throw new Error(`Error getting students by group: ${error.message}`);
    }
  }

  // Get student attendance statistics
  static async getStudentAttendanceStats(studentId) {
    try {
      const statsResult = await query(`
        SELECT 
          COUNT(*) as total_sessions,
          COUNT(CASE WHEN a.status = 'present' THEN 1 END) as present_count,
          COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as absent_count,
          COUNT(CASE WHEN a.status = 'late' THEN 1 END) as late_count,
          COUNT(CASE WHEN a.status = 'excused' THEN 1 END) as excused_count,
          ROUND(AVG(CASE WHEN a.score IS NOT NULL THEN a.score END), 2) as average_score
        FROM attendance a
        JOIN schedules s ON a.schedule_id = s.schedule_id
        WHERE a.student_id = $1
      `, [studentId]);
      
      const stats = statsResult.rows[0];
      
      // Calculate attendance rate
      const totalSessions = parseInt(stats.total_sessions);
      const presentCount = parseInt(stats.present_count);
      const attendanceRate = totalSessions > 0 ? (presentCount / totalSessions * 100).toFixed(2) : 0;
      
      return {
        total_sessions: totalSessions,
        present_count: presentCount,
        absent_count: parseInt(stats.absent_count),
        late_count: parseInt(stats.late_count),
        excused_count: parseInt(stats.excused_count),
        attendance_rate: parseFloat(attendanceRate),
        average_score: stats.average_score ? parseFloat(stats.average_score) : null
      };
    } catch (error) {
      throw new Error(`Error getting student attendance stats: ${error.message}`);
    }
  }

  // Get student schedule
  static async getStudentSchedule(studentId, options = {}) {
    try {
      const { startDate, endDate, limit = 100 } = options;
      
      let whereClause = `WHERE sg.group_id = (SELECT group_id FROM students WHERE student_id = $1)`;
      let params = [studentId];
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
        `SELECT s.*, c.course_name, at.type_name, l.location_name,
                i.first_name as instructor_first_name, i.last_name as instructor_last_name,
                a.status as attendance_status, a.score, a.check_in_time, a.check_out_time
         FROM schedules s
         JOIN schedule_groups sg ON s.schedule_id = sg.schedule_id
         JOIN courses c ON s.course_id = c.course_id
         JOIN activity_types at ON s.activity_type_id = at.activity_type_id
         JOIN locations l ON s.location_id = l.location_id
         JOIN instructors inst ON s.instructor_id = inst.instructor_id
         JOIN users i ON inst.user_id = i.user_id
         LEFT JOIN attendance a ON s.schedule_id = a.schedule_id AND a.student_id = $1
         ${whereClause}
         ORDER BY s.schedule_date ASC, s.start_time ASC
         LIMIT $${paramCount + 1}`,
        [...params, limit]
      );
      
      return result.rows;
    } catch (error) {
      throw new Error(`Error getting student schedule: ${error.message}`);
    }
  }

  // Get student statistics
  static async getStudentStatistics() {
    try {
      const statsResult = await query(`
        SELECT 
          COUNT(*) as total_students,
          COUNT(CASE WHEN year_level = 1 THEN 1 END) as year1_count,
          COUNT(CASE WHEN year_level = 2 THEN 1 END) as year2_count,
          COUNT(CASE WHEN year_level = 3 THEN 1 END) as year3_count,
          COUNT(CASE WHEN year_level = 4 THEN 1 END) as year4_count,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active_students,
          COUNT(CASE WHEN status = 'inactive' THEN 1 END) as inactive_students,
          COUNT(CASE WHEN status = 'graduated' THEN 1 END) as graduated_students,
          COUNT(CASE WHEN status = 'dropped' THEN 1 END) as dropped_students,
          COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as new_students_30_days
        FROM students
      `);
      
      return statsResult.rows[0];
    } catch (error) {
      throw new Error(`Error getting student statistics: ${error.message}`);
    }
  }

  // Bulk import students from CSV data
  static async bulkImportStudents(studentsData) {
    const client = await getClient();
    
    try {
      await client.query('BEGIN');
      
      const results = {
        success: [],
        errors: [],
        duplicates: []
      };
      
      for (let i = 0; i < studentsData.length; i++) {
        const studentData = studentsData[i];
        
        try {
          // Validate data
          const validationErrors = this.validateStudentData(studentData);
          if (validationErrors.length > 0) {
            results.errors.push({
              row: i + 1,
              data: studentData,
              error: `Validation failed: ${validationErrors.join(', ')}`
            });
            continue;
          }
          
          // Check for duplicates
          const existingStudent = await client.query(
            'SELECT student_id FROM students WHERE student_code = $1',
            [studentData.studentCode]
          );
          
          if (existingStudent.rows.length > 0) {
            results.duplicates.push({
              row: i + 1,
              data: studentData,
              error: 'Student code already exists'
            });
            continue;
          }
          
          // Create student
          const result = await client.query(
            `INSERT INTO students (student_code, first_name, last_name, email, phone, section_id, group_id, year_level, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
             RETURNING student_id, student_code`,
            [studentData.studentCode, studentData.firstName, studentData.lastName, 
             studentData.email, studentData.phone, studentData.sectionId, 
             studentData.groupId, studentData.yearLevel]
          );
          
          results.success.push({
            row: i + 1,
            student_id: result.rows[0].student_id,
            student_code: result.rows[0].student_code
          });
          
        } catch (error) {
          results.errors.push({
            row: i + 1,
            data: studentData,
            error: error.message
          });
        }
      }
      
      await client.query('COMMIT');
      return results;
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Validate student data
  static validateStudentData(studentData, isUpdate = false) {
    const errors = [];
    
    if (!isUpdate) {
      if (!studentData.studentCode) {
        errors.push('Student code is required');
      }
      
      if (!studentData.firstName) {
        errors.push('First name is required');
      }
      
      if (!studentData.lastName) {
        errors.push('Last name is required');
      }
      
      if (!studentData.yearLevel || !Number.isInteger(studentData.yearLevel) || 
          studentData.yearLevel < 1 || studentData.yearLevel > 4) {
        errors.push('Year level must be 1, 2, 3, or 4');
      }
    }
    
    if (studentData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(studentData.email)) {
      errors.push('Invalid email format');
    }
    
    if (studentData.phone && !/^[0-9\-\+\s\(\)]{8,20}$/.test(studentData.phone)) {
      errors.push('Invalid phone number format');
    }
    
    if (studentData.status && !['active', 'inactive', 'graduated', 'dropped'].includes(studentData.status)) {
      errors.push('Status must be active, inactive, graduated, or dropped');
    }
    
    return errors;
  }
}

module.exports = StudentService;
