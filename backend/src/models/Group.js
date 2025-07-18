const { query } = require('../config/database');

class Group {
  constructor(data) {
    this.groupId = data.group_id;
    this.sectionId = data.section_id;
    this.groupName = data.group_name;
    this.groupCode = data.group_code;
    this.capacity = data.capacity;
    this.description = data.description;
    this.status = data.status;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
    
    // Related section data
    this.sectionName = data.section_name;
    this.sectionCode = data.section_code;
    this.yearLevel = data.year_level;
    this.academicYear = data.academic_year;
    
    // Calculated fields
    this.currentStudents = parseInt(data.current_students) || 0;
  }

  // Static methods for database operations
  static async findById(groupId) {
    try {
      const result = await query(
        `SELECT g.*, s.section_name, s.section_code, s.year_level, s.academic_year,
                COUNT(st.student_id) as current_students
         FROM groups g
         LEFT JOIN sections s ON g.section_id = s.section_id
         LEFT JOIN students st ON g.group_id = st.group_id AND st.status = 'active'
         WHERE g.group_id = $1
         GROUP BY g.group_id, s.section_name, s.section_code, s.year_level, s.academic_year`,
        [groupId]
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return new Group(result.rows[0]);
    } catch (error) {
      throw new Error(`Error finding group by ID: ${error.message}`);
    }
  }

  static async findByCode(sectionId, groupCode) {
    try {
      const result = await query(
        `SELECT g.*, s.section_name, s.section_code, s.year_level, s.academic_year,
                COUNT(st.student_id) as current_students
         FROM groups g
         LEFT JOIN sections s ON g.section_id = s.section_id
         LEFT JOIN students st ON g.group_id = st.group_id AND st.status = 'active'
         WHERE g.section_id = $1 AND g.group_code = $2
         GROUP BY g.group_id, s.section_name, s.section_code, s.year_level, s.academic_year`,
        [sectionId, groupCode]
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return new Group(result.rows[0]);
    } catch (error) {
      throw new Error(`Error finding group by code: ${error.message}`);
    }
  }

  static async findAll(options = {}) {
    try {
      const { page = 1, limit = 10, search = '', sectionId = '' } = options;
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
        SELECT g.*, s.section_name, s.section_code, s.year_level, s.academic_year,
               COUNT(st.student_id) as current_students
        FROM groups g
        LEFT JOIN sections s ON g.section_id = s.section_id
        LEFT JOIN students st ON g.group_id = st.group_id AND st.status = 'active'
        ${whereClause}
        GROUP BY g.group_id, s.section_name, s.section_code, s.year_level, s.academic_year
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
      
      return {
        groups: result.rows.map(row => new Group(row)),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: total,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      throw new Error(`Error finding all groups: ${error.message}`);
    }
  }

  static async findBySection(sectionId) {
    try {
      const result = await query(
        `SELECT g.*, COUNT(st.student_id) as current_students
         FROM groups g
         LEFT JOIN students st ON g.group_id = st.group_id AND st.status = 'active'
         WHERE g.section_id = $1
         GROUP BY g.group_id
         ORDER BY g.group_code ASC`,
        [sectionId]
      );
      
      return result.rows.map(row => new Group(row));
    } catch (error) {
      throw new Error(`Error finding groups by section: ${error.message}`);
    }
  }

  static async create(groupData) {
    try {
      const { sectionId, groupName, groupCode, capacity, description } = groupData;
      
      // Check if section exists
      const sectionCheck = await query(
        'SELECT section_id FROM sections WHERE section_id = $1',
        [sectionId]
      );
      
      if (sectionCheck.rows.length === 0) {
        throw new Error('Section not found');
      }
      
      // Check if group code already exists in the same section
      const existingGroup = await query(
        'SELECT group_id FROM groups WHERE section_id = $1 AND group_code = $2',
        [sectionId, groupCode]
      );
      
      if (existingGroup.rows.length > 0) {
        throw new Error('Group code already exists in this section');
      }
      
      const result = await query(
        `INSERT INTO groups (section_id, group_name, group_code, capacity, description, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
         RETURNING *`,
        [sectionId, groupName, groupCode, capacity, description]
      );
      
      return new Group(result.rows[0]);
    } catch (error) {
      throw new Error(`Error creating group: ${error.message}`);
    }
  }

  // Instance methods
  async update(updateData) {
    try {
      const { groupName, capacity, description, status } = updateData;
      
      const result = await query(
        `UPDATE groups 
         SET group_name = COALESCE($1, group_name),
             capacity = COALESCE($2, capacity),
             description = COALESCE($3, description),
             status = COALESCE($4, status),
             updated_at = NOW()
         WHERE group_id = $5
         RETURNING *`,
        [groupName, capacity, description, status, this.groupId]
      );
      
      if (result.rows.length === 0) {
        throw new Error('Group not found');
      }
      
      // Update instance properties
      const updatedGroup = result.rows[0];
      Object.assign(this, {
        groupName: updatedGroup.group_name,
        capacity: updatedGroup.capacity,
        description: updatedGroup.description,
        status: updatedGroup.status,
        updatedAt: updatedGroup.updated_at
      });
      
      return this;
    } catch (error) {
      throw new Error(`Error updating group: ${error.message}`);
    }
  }

  async delete() {
    try {
      // Check if group has students
      const studentsCheck = await query(
        'SELECT student_id FROM students WHERE group_id = $1',
        [this.groupId]
      );
      
      if (studentsCheck.rows.length > 0) {
        throw new Error('Cannot delete group with students');
      }
      
      // Check if group has schedule assignments
      const scheduleCheck = await query(
        'SELECT schedule_group_id FROM schedule_groups WHERE group_id = $1',
        [this.groupId]
      );
      
      if (scheduleCheck.rows.length > 0) {
        throw new Error('Cannot delete group with schedule assignments');
      }
      
      const result = await query(
        'DELETE FROM groups WHERE group_id = $1 RETURNING group_id',
        [this.groupId]
      );
      
      if (result.rows.length === 0) {
        throw new Error('Group not found');
      }
      
      return true;
    } catch (error) {
      throw new Error(`Error deleting group: ${error.message}`);
    }
  }

  async getStudents() {
    try {
      const result = await query(
        `SELECT student_id, student_code, first_name, last_name, email, year_level, status
         FROM students
         WHERE group_id = $1
         ORDER BY student_code ASC`,
        [this.groupId]
      );
      
      return result.rows;
    } catch (error) {
      throw new Error(`Error getting group students: ${error.message}`);
    }
  }

  async getSchedules(options = {}) {
    try {
      const { startDate, endDate, limit = 100 } = options;
      
      let whereClause = 'WHERE sg.group_id = $1';
      let params = [this.groupId];
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
                i.first_name as instructor_first_name, i.last_name as instructor_last_name
         FROM schedules s
         JOIN schedule_groups sg ON s.schedule_id = sg.schedule_id
         JOIN courses c ON s.course_id = c.course_id
         JOIN activity_types at ON s.activity_type_id = at.activity_type_id
         JOIN locations l ON s.location_id = l.location_id
         JOIN instructors inst ON s.instructor_id = inst.instructor_id
         JOIN users i ON inst.user_id = i.user_id
         ${whereClause}
         ORDER BY s.schedule_date ASC, s.start_time ASC
         LIMIT $${paramCount + 1}`,
        [...params, limit]
      );
      
      return result.rows;
    } catch (error) {
      throw new Error(`Error getting group schedules: ${error.message}`);
    }
  }

  async addStudent(studentId) {
    try {
      // Check if student exists and is not already in another group
      const studentCheck = await query(
        'SELECT student_id, group_id FROM students WHERE student_id = $1',
        [studentId]
      );
      
      if (studentCheck.rows.length === 0) {
        throw new Error('Student not found');
      }
      
      const student = studentCheck.rows[0];
      if (student.group_id && student.group_id !== this.groupId) {
        throw new Error('Student is already assigned to another group');
      }
      
      // Check group capacity
      if (this.capacity && this.currentStudents >= this.capacity) {
        throw new Error('Group is at full capacity');
      }
      
      await query(
        'UPDATE students SET group_id = $1, updated_at = NOW() WHERE student_id = $2',
        [this.groupId, studentId]
      );
      
      // Update current students count
      this.currentStudents += 1;
      
      return true;
    } catch (error) {
      throw new Error(`Error adding student to group: ${error.message}`);
    }
  }

  async removeStudent(studentId) {
    try {
      const result = await query(
        'UPDATE students SET group_id = NULL, updated_at = NOW() WHERE student_id = $1 AND group_id = $2 RETURNING student_id',
        [studentId, this.groupId]
      );
      
      if (result.rows.length === 0) {
        throw new Error('Student not found in this group');
      }
      
      // Update current students count
      this.currentStudents = Math.max(0, this.currentStudents - 1);
      
      return true;
    } catch (error) {
      throw new Error(`Error removing student from group: ${error.message}`);
    }
  }

  // Get group's safe data
  toSafeObject() {
    return {
      groupId: this.groupId,
      sectionId: this.sectionId,
      groupName: this.groupName,
      groupCode: this.groupCode,
      capacity: this.capacity,
      description: this.description,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      currentStudents: this.currentStudents,
      section: {
        name: this.sectionName,
        code: this.sectionCode,
        yearLevel: this.yearLevel,
        academicYear: this.academicYear
      }
    };
  }

  // Validation methods
  static validateGroupData(groupData, isUpdate = false) {
    const errors = [];
    
    if (!isUpdate) {
      if (!groupData.sectionId || !Number.isInteger(groupData.sectionId) || groupData.sectionId < 1) {
        errors.push('Valid section ID is required');
      }
      
      if (!groupData.groupName) {
        errors.push('Group name is required');
      }
      
      if (!groupData.groupCode) {
        errors.push('Group code is required');
      }
    }
    
    if (groupData.capacity && (!Number.isInteger(groupData.capacity) || groupData.capacity < 1)) {
      errors.push('Capacity must be a positive integer');
    }
    
    if (groupData.status && !['active', 'inactive'].includes(groupData.status)) {
      errors.push('Status must be active or inactive');
    }
    
    return errors;
  }
}

module.exports = Group;
