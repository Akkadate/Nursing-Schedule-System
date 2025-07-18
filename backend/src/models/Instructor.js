const { query } = require('../config/database');

class Instructor {
  constructor(data) {
    this.instructorId = data.instructor_id;
    this.userId = data.user_id;
    this.instructorCode = data.instructor_code;
    this.title = data.title;
    this.department = data.department;
    this.specialization = data.specialization;
    this.maxStudentsPerSession = data.max_students_per_session;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
    
    // User data
    this.username = data.username;
    this.email = data.email;
    this.firstName = data.first_name;
    this.lastName = data.last_name;
    this.status = data.status;
    
    // Calculated fields
    this.totalSchedules = parseInt(data.total_schedules) || 0;
  }

  // Static methods for database operations
  static async findById(instructorId) {
    try {
      const result = await query(
        `SELECT i.*, u.username, u.email, u.first_name, u.last_name, u.status,
                COUNT(s.schedule_id) as total_schedules
         FROM instructors i
         JOIN users u ON i.user_id = u.user_id
         LEFT JOIN schedules s ON i.instructor_id = s.instructor_id
         WHERE i.instructor_id = $1
         GROUP BY i.instructor_id, u.user_id`,
        [instructorId]
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return new Instructor(result.rows[0]);
    } catch (error) {
      throw new Error(`Error finding instructor by ID: ${error.message}`);
    }
  }

  static async findByUserId(userId) {
    try {
      const result = await query(
        `SELECT i.*, u.username, u.email, u.first_name, u.last_name, u.status,
                COUNT(s.schedule_id) as total_schedules
         FROM instructors i
         JOIN users u ON i.user_id = u.user_id
         LEFT JOIN schedules s ON i.instructor_id = s.instructor_id
         WHERE i.user_id = $1
         GROUP BY i.instructor_id, u.user_id`,
        [userId]
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return new Instructor(result.rows[0]);
    } catch (error) {
      throw new Error(`Error finding instructor by user ID: ${error.message}`);
    }
  }

  static async findByInstructorCode(instructorCode) {
    try {
      const result = await query(
        `SELECT i.*, u.username, u.email, u.first_name, u.last_name, u.status,
                COUNT(s.schedule_id) as total_schedules
         FROM instructors i
         JOIN users u ON i.user_id = u.user_id
         LEFT JOIN schedules s ON i.instructor_id = s.instructor_id
         WHERE i.instructor_code = $1
         GROUP BY i.instructor_id, u.user_id`,
        [instructorCode]
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return new Instructor(result.rows[0]);
    } catch (error) {
      throw new Error(`Error finding instructor by code: ${error.message}`);
    }
  }

  static async findAll(options = {}) {
    try {
      const { 
        page = 1, 
        limit = 10, 
        search = '', 
        department = '', 
        status = '',
        sortBy = 'first_name',
        sortOrder = 'ASC'
      } = options;
      
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
      
      // Validate sort column
      const allowedSortColumns = ['first_name', 'last_name', 'email', 'instructor_code', 'department', 'created_at'];
      const validSortBy = allowedSortColumns.includes(sortBy) ? sortBy : 'first_name';
      const validSortOrder = ['ASC', 'DESC'].includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'ASC';
      
      const instructorsQuery = `
        SELECT i.*, u.username, u.email, u.first_name, u.last_name, u.status,
               COUNT(s.schedule_id) as total_schedules
        FROM instructors i
        JOIN users u ON i.user_id = u.user_id
        LEFT JOIN schedules s ON i.instructor_id = s.instructor_id
        ${whereClause}
        GROUP BY i.instructor_id, u.user_id
        ORDER BY u.${validSortBy} ${validSortOrder}
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
      
      return {
        instructors: result.rows.map(row => new Instructor(row)),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: total,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      throw new Error(`Error finding all instructors: ${error.message}`);
    }
  }

  static async create(instructorData) {
    try {
      const { userId, instructorCode, title, department, specialization, maxStudentsPerSession } = instructorData;
      
      // Check if user exists and has instructor role
      const userCheck = await query(
        'SELECT user_id, role FROM users WHERE user_id = $1',
        [userId]
      );
      
      if (userCheck.rows.length === 0) {
        throw new Error('User not found');
      }
      
      if (userCheck.rows[0].role !== 'instructor') {
        throw new Error('User must have instructor role');
      }
      
      // Check if user is already an instructor
      const existingInstructor = await query(
        'SELECT instructor_id FROM instructors WHERE user_id = $1',
        [userId]
      );
      
      if (existingInstructor.rows.length > 0) {
        throw new Error('User is already an instructor');
      }
      
      // Check instructor code uniqueness if provided
      if (instructorCode) {
        const codeCheck = await query(
          'SELECT instructor_id FROM instructors WHERE instructor_code = $1',
          [instructorCode]
        );
        
        if (codeCheck.rows.length > 0) {
          throw new Error('Instructor code already exists');
        }
      }
      
      const result = await query(
        `INSERT INTO instructors (user_id, instructor_code, title, department, specialization, max_students_per_session, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
         RETURNING *`,
        [userId, instructorCode, title, department, specialization, maxStudentsPerSession]
      );
      
      return new Instructor(result.rows[0]);
    } catch (error) {
      throw new Error(`Error creating instructor: ${error.message}`);
    }
  }

  // Instance methods
  async update(updateData) {
    try {
      const { title, department, specialization, maxStudentsPerSession } = updateData;
      
      const result = await query(
        `UPDATE instructors 
         SET title = COALESCE($1, title),
             department = COALESCE($2, department),
             specialization = COALESCE($3, specialization),
             max_students_per_session = COALESCE($4, max_students_per_session),
             updated_at = NOW()
         WHERE instructor_id = $5
         RETURNING *`,
        [title, department, specialization, maxStudentsPerSession, this.instructorId]
      );
      
      if (result.rows.length === 0) {
        throw new Error('Instructor not found');
      }
      
      // Update instance properties
      const updatedInstructor = result.rows[0];
      Object.assign(this, {
        title: updatedInstructor.title,
        department: updatedInstructor.department,
        specialization: updatedInstructor.specialization,
        maxStudentsPerSession: updatedInstructor.max_students_per_session,
        updatedAt: updatedInstructor.updated_at
      });
      
      return this;
    } catch (error) {
      throw new Error(`Error updating instructor: ${error.message}`);
    }
  }

  async delete() {
    try {
      // Check if instructor has schedules
      const scheduleCheck = await query(
        'SELECT schedule_id FROM schedules WHERE instructor_id = $1',
        [this.instructorId]
      );
      
      if (scheduleCheck.rows.length > 0) {
        throw new Error('Cannot delete instructor with existing schedules');
      }
      
      const result = await query(
        'DELETE FROM instructors WHERE instructor_id = $1 RETURNING instructor_id',
        [this.instructorId]
      );
      
      if (result.rows.length === 0) {
        throw new Error('Instructor not found');
      }
      
      return true;
    } catch (error) {
      throw new Error(`Error deleting instructor: ${error.message}`);
    }
  }

  async getSchedules(options = {}) {
    try {
      const { startDate, endDate, limit = 100 } = options;
      
      let whereClause = 'WHERE s.instructor_id = $1';
      let params = [this.instructorId];
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
        `SELECT s.*, c.course_name, c.course_code, at.type_name,
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
         LIMIT $${paramCount + 1}`,
        [...params, limit]
      );
      
      return result.rows;
    } catch (error) {
      throw new Error(`Error getting instructor schedules: ${error.message}`);
    }
  }

  async getStudents(options = {}) {
    try {
      const { limit = 100 } = options;
      
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
         LIMIT $2`,
        [this.instructorId, limit]
      );
      
      return result.rows;
    } catch (error) {
      throw new Error(`Error getting instructor students: ${error.message}`);
    }
  }

  async getTeachingStatistics() {
    try {
      const result = await query(
        `SELECT 
           COUNT(s.schedule_id) as total_schedules,
           COUNT(CASE WHEN s.schedule_date >= CURRENT_DATE THEN 1 END) as upcoming_schedules,
           COUNT(CASE WHEN s.schedule_date < CURRENT_DATE THEN 1 END) as completed_schedules,
           COUNT(DISTINCT sg.group_id) as total_groups_taught,
           COUNT(DISTINCT c.course_id) as total_courses_taught
         FROM schedules s
         LEFT JOIN schedule_groups sg ON s.schedule_id = sg.schedule_id
         LEFT JOIN courses c ON s.course_id = c.course_id
         WHERE s.instructor_id = $1`,
        [this.instructorId]
      );
      
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error getting teaching statistics: ${error.message}`);
    }
  }

  // Get instructor's safe data
  toSafeObject() {
    return {
      instructorId: this.instructorId,
      userId: this.userId,
      instructorCode: this.instructorCode,
      title: this.title,
      department: this.department,
      specialization: this.specialization,
      maxStudentsPerSession: this.maxStudentsPerSession,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      user: {
        username: this.username,
        email: this.email,
        firstName: this.firstName,
        lastName: this.lastName,
        status: this.status
      },
      totalSchedules: this.totalSchedules
    };
  }

  // Validation methods
  static validateInstructorData(instructorData, isUpdate = false) {
    const errors = [];
    
    if (!isUpdate) {
      if (!instructorData.userId || !Number.isInteger(instructorData.userId) || instructorData.userId <= 0) {
        errors.push('Valid user ID is required');
      }
    }
    
    if (instructorData.instructorCode && instructorData.instructorCode.length > 20) {
      errors.push('Instructor code cannot exceed 20 characters');
    }
    
    if (instructorData.title && instructorData.title.length > 50) {
      errors.push('Title cannot exceed 50 characters');
    }
    
    if (instructorData.department && instructorData.department.length > 100) {
      errors.push('Department cannot exceed 100 characters');
    }
    
    if (instructorData.specialization && instructorData.specialization.length > 200) {
      errors.push('Specialization cannot exceed 200 characters');
    }
    
    if (instructorData.maxStudentsPerSession && 
        (!Number.isInteger(instructorData.maxStudentsPerSession) || 
         instructorData.maxStudentsPerSession < 1 || 
         instructorData.maxStudentsPerSession > 100)) {
      errors.push('Max students per session must be between 1 and 100');
    }
    
    return errors;
  }
}

module.exports = Instructor;
