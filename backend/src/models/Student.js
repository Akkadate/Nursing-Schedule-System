const { query } = require('../config/database');

class Student {
  constructor(data) {
    this.studentId = data.student_id;
    this.studentCode = data.student_code;
    this.firstName = data.first_name;
    this.lastName = data.last_name;
    this.email = data.email;
    this.phone = data.phone;
    this.sectionId = data.section_id;
    this.groupId = data.group_id;
    this.yearLevel = data.year_level;
    this.status = data.status;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
    
    // Related data
    this.sectionName = data.section_name;
    this.sectionCode = data.section_code;
    this.groupName = data.group_name;
    this.groupCode = data.group_code;
  }

  // Static methods for database operations
  static async findById(studentId) {
    try {
      const result = await query(
        `SELECT s.*, sec.section_name, sec.section_code, g.group_name, g.group_code
         FROM students s
         LEFT JOIN sections sec ON s.section_id = sec.section_id
         LEFT JOIN groups g ON s.group_id = g.group_id
         WHERE s.student_id = $1`,
        [studentId]
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return new Student(result.rows[0]);
    } catch (error) {
      throw new Error(`Error finding student by ID: ${error.message}`);
    }
  }

  static async findByStudentCode(studentCode) {
    try {
      const result = await query(
        `SELECT s.*, sec.section_name, sec.section_code, g.group_name, g.group_code
         FROM students s
         LEFT JOIN sections sec ON s.section_id = sec.section_id
         LEFT JOIN groups g ON s.group_id = g.group_id
         WHERE s.student_code = $1`,
        [studentCode]
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return new Student(result.rows[0]);
    } catch (error) {
      throw new Error(`Error finding student by code: ${error.message}`);
    }
  }

  static async findAll(options = {}) {
    try {
      const { page = 1, limit = 10, search = '', sectionId = '', groupId = '', yearLevel = '' } = options;
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
        SELECT s.*, sec.section_name, sec.section_code, g.group_name, g.group_code
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
      
      return {
        students: result.rows.map(row => new Student(row)),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: total,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      throw new Error(`Error finding all students: ${error.message}`);
    }
  }

  static async findBySection(sectionId, options = {}) {
    try {
      const { page = 1, limit = 50 } = options;
      const offset = (page - 1) * limit;
      
      const result = await query(
        `SELECT s.*, g.group_name, g.group_code
         FROM students s
         LEFT JOIN groups g ON s.group_id = g.group_id
         WHERE s.section_id = $1
         ORDER BY s.student_code ASC
         LIMIT $2 OFFSET $3`,
        [sectionId, limit, offset]
      );
      
      return result.rows.map(row => new Student(row));
    } catch (error) {
      throw new Error(`Error finding students by section: ${error.message}`);
    }
  }

  static async findByGroup(groupId) {
    try {
      const result = await query(
        `SELECT s.*, sec.section_name, sec.section_code
         FROM students s
         LEFT JOIN sections sec ON s.section_id = sec.section_id
         WHERE s.group_id = $1
         ORDER BY s.student_code ASC`,
        [groupId]
      );
      
      return result.rows.map(row => new Student(row));
    } catch (error) {
      throw new Error(`Error finding students by group: ${error.message}`);
    }
  }

  static async create(studentData) {
    try {
      const { studentCode, firstName, lastName, email, phone, sectionId, groupId, yearLevel } = studentData;
      
      // Check if student code already exists
      const existingStudent = await query(
        'SELECT student_id FROM students WHERE student_code = $1',
        [studentCode]
      );
      
      if (existingStudent.rows.length > 0) {
        throw new Error('Student code already exists');
      }
      
      // Check if email already exists (if provided)
      if (email) {
        const emailCheck = await query(
          'SELECT student_id FROM students WHERE email = $1',
          [email]
        );
        
        if (emailCheck.rows.length > 0) {
          throw new Error('Email already exists');
        }
      }
      
      // Validate section and group if provided
      if (sectionId) {
        const sectionCheck = await query('SELECT section_id FROM sections WHERE section_id = $1', [sectionId]);
        if (sectionCheck.rows.length === 0) {
          throw new Error('Section not found');
        }
      }
      
      if (groupId) {
        const groupCheck = await query('SELECT group_id FROM groups WHERE group_id = $1', [groupId]);
        if (groupCheck.rows.length === 0) {
          throw new Error('Group not found');
        }
      }
      
      const result = await query(
        `INSERT INTO students (student_code, first_name, last_name, email, phone, section_id, group_id, year_level, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
         RETURNING *`,
        [studentCode, firstName, lastName, email, phone, sectionId, groupId, yearLevel]
      );
      
      return new Student(result.rows[0]);
    } catch (error) {
      throw new Error(`Error creating student: ${error.message}`);
    }
  }

  // Instance methods
  async update(updateData) {
    try {
      const { firstName, lastName, email, phone, sectionId, groupId, yearLevel, status } = updateData;
      
      // Check email uniqueness if email is being updated
      if (email && email !== this.email) {
        const emailCheck = await query(
          'SELECT student_id FROM students WHERE email = $1 AND student_id != $2',
          [email, this.studentId]
        );
        
        if (emailCheck.rows.length > 0) {
          throw new Error('Email already exists');
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
         RETURNING *`,
        [firstName, lastName, email, phone, sectionId, groupId, yearLevel, status, this.studentId]
      );
      
      if (result.rows.length === 0) {
        throw new Error('Student not found');
      }
      
      // Update instance properties
      const updatedStudent = result.rows[0];
      Object.assign(this, {
        firstName: updatedStudent.first_name,
        lastName: updatedStudent.last_name,
        email: updatedStudent.email,
        phone: updatedStudent.phone,
        sectionId: updatedStudent.section_id,
        groupId: updatedStudent.group_id,
        yearLevel: updatedStudent.year_level,
        status: updatedStudent.status,
        updatedAt: updatedStudent.updated_at
      });
      
      return this;
    } catch (error) {
      throw new Error(`Error updating student: ${error.message}`);
    }
  }

  async delete() {
    try {
      // Check if student has attendance records
      const attendanceCheck = await query(
        'SELECT attendance_id FROM attendance WHERE student_id = $1',
        [this.studentId]
      );
      
      if (attendanceCheck.rows.length > 0) {
        throw new Error('Cannot delete student with attendance records');
      }
      
      const result = await query(
        'DELETE FROM students WHERE student_id = $1 RETURNING student_id',
        [this.studentId]
      );
      
      if (result.rows.length === 0) {
        throw new Error('Student not found');
      }
      
      return true;
    } catch (error) {
      throw new Error(`Error deleting student: ${error.message}`);
    }
  }

  async getAttendanceHistory(options = {}) {
    try {
      const { startDate, endDate, limit = 50 } = options;
      
      let whereClause = 'WHERE a.student_id = $1';
      let params = [this.studentId];
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
        `SELECT a.*, s.schedule_date, s.start_time, s.end_time,
                c.course_name, at.type_name,
                l.location_name, i.first_name as instructor_first_name, i.last_name as instructor_last_name
         FROM attendance a
         JOIN schedules s ON a.schedule_id = s.schedule_id
         JOIN courses c ON s.course_id = c.course_id
         JOIN activity_types at ON s.activity_type_id = at.activity_type_id
         JOIN locations l ON s.location_id = l.location_id
         JOIN instructors inst ON s.instructor_id = inst.instructor_id
         JOIN users i ON inst.user_id = i.user_id
         ${whereClause}
         ORDER BY s.schedule_date DESC, s.start_time DESC
         LIMIT $${paramCount + 1}`,
        [...params, limit]
      );
      
      return result.rows;
    } catch (error) {
      throw new Error(`Error getting attendance history: ${error.message}`);
    }
  }

  // Get student's safe data
  toSafeObject() {
    return {
      studentId: this.studentId,
      studentCode: this.studentCode,
      firstName: this.firstName,
      lastName: this.lastName,
      email: this.email,
      phone: this.phone,
      sectionId: this.sectionId,
      groupId: this.groupId,
      yearLevel: this.yearLevel,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      section: {
        name: this.sectionName,
        code: this.sectionCode
      },
      group: {
        name: this.groupName,
        code: this.groupCode
      }
    };
  }

  // Validation methods
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

module.exports = Student;
