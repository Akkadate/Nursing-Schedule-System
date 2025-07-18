const { query } = require('../config/database');

class Section {
  constructor(data) {
    this.sectionId = data.section_id;
    this.sectionName = data.section_name;
    this.sectionCode = data.section_code;
    this.yearLevel = data.year_level;
    this.academicYear = data.academic_year;
    this.semester = data.semester;
    this.capacity = data.capacity;
    this.description = data.description;
    this.status = data.status;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
    
    // Calculated fields
    this.currentStudents = parseInt(data.current_students) || 0;
    this.totalGroups = parseInt(data.total_groups) || 0;
  }

  // Static methods for database operations
  static async findById(sectionId) {
    try {
      const result = await query(
        `SELECT s.*, 
                COUNT(DISTINCT st.student_id) as current_students,
                COUNT(DISTINCT g.group_id) as total_groups
         FROM sections s
         LEFT JOIN students st ON s.section_id = st.section_id AND st.status = 'active'
         LEFT JOIN groups g ON s.section_id = g.section_id AND g.status = 'active'
         WHERE s.section_id = $1
         GROUP BY s.section_id`,
        [sectionId]
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return new Section(result.rows[0]);
    } catch (error) {
      throw new Error(`Error finding section by ID: ${error.message}`);
    }
  }

  static async findBySectionCode(sectionCode, academicYear) {
    try {
      const result = await query(
        `SELECT s.*, 
                COUNT(DISTINCT st.student_id) as current_students,
                COUNT(DISTINCT g.group_id) as total_groups
         FROM sections s
         LEFT JOIN students st ON s.section_id = st.section_id AND st.status = 'active'
         LEFT JOIN groups g ON s.section_id = g.section_id AND g.status = 'active'
         WHERE s.section_code = $1 AND s.academic_year = $2
         GROUP BY s.section_id`,
        [sectionCode, academicYear]
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return new Section(result.rows[0]);
    } catch (error) {
      throw new Error(`Error finding section by code: ${error.message}`);
    }
  }

  static async findAll(options = {}) {
    try {
      const { page = 1, limit = 10, search = '', yearLevel = '', academicYear = '', semester = '' } = options;
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
        SELECT s.*, 
               COUNT(DISTINCT st.student_id) as current_students,
               COUNT(DISTINCT g.group_id) as total_groups
        FROM sections s
        LEFT JOIN students st ON s.section_id = st.section_id AND st.status = 'active'
        LEFT JOIN groups g ON s.section_id = g.section_id AND g.status = 'active'
        ${whereClause}
        GROUP BY s.section_id
        ORDER BY s.academic_year DESC, s.year_level ASC, s.section_code ASC
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `;
      params.push(limit, offset);
      
      const result = await query(sectionsQuery, params);
      
      // Count total for pagination
      const countQuery = `SELECT COUNT(*) FROM sections s ${whereClause}`;
      const countResult = await query(countQuery, params.slice(0, paramCount));
      const total = parseInt(countResult.rows[0].count);
      
      return {
        sections: result.rows.map(row => new Section(row)),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: total,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      throw new Error(`Error finding all sections: ${error.message}`);
    }
  }

  static async create(sectionData) {
    try {
      const { sectionName, sectionCode, yearLevel, academicYear, semester, capacity, description } = sectionData;
      
      // Check if section code already exists for this academic year
      const existingSection = await query(
        'SELECT section_id FROM sections WHERE section_code = $1 AND academic_year = $2',
        [sectionCode, academicYear]
      );
      
      if (existingSection.rows.length > 0) {
        throw new Error('Section code already exists for this academic year');
      }
      
      const result = await query(
        `INSERT INTO sections (section_name, section_code, year_level, academic_year, semester, capacity, description, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
         RETURNING *`,
        [sectionName, sectionCode, yearLevel, academicYear, semester, capacity, description]
      );
      
      return new Section(result.rows[0]);
    } catch (error) {
      throw new Error(`Error creating section: ${error.message}`);
    }
  }

  // Instance methods
  async update(updateData) {
    try {
      const { sectionName, yearLevel, academicYear, semester, capacity, description, status } = updateData;
      
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
         RETURNING *`,
        [sectionName, yearLevel, academicYear, semester, capacity, description, status, this.sectionId]
      );
      
      if (result.rows.length === 0) {
        throw new Error('Section not found');
      }
      
      // Update instance properties
      const updatedSection = result.rows[0];
      Object.assign(this, {
        sectionName: updatedSection.section_name,
        yearLevel: updatedSection.year_level,
        academicYear: updatedSection.academic_year,
        semester: updatedSection.semester,
        capacity: updatedSection.capacity,
        description: updatedSection.description,
        status: updatedSection.status,
        updatedAt: updatedSection.updated_at
      });
      
      return this;
    } catch (error) {
      throw new Error(`Error updating section: ${error.message}`);
    }
  }

  async delete() {
    try {
      // Check if section has students
      const studentsCheck = await query(
        'SELECT student_id FROM students WHERE section_id = $1',
        [this.sectionId]
      );
      
      if (studentsCheck.rows.length > 0) {
        throw new Error('Cannot delete section with students');
      }
      
      // Check if section has groups
      const groupsCheck = await query(
        'SELECT group_id FROM groups WHERE section_id = $1',
        [this.sectionId]
      );
      
      if (groupsCheck.rows.length > 0) {
        throw new Error('Cannot delete section with groups');
      }
      
      const result = await query(
        'DELETE FROM sections WHERE section_id = $1 RETURNING section_id',
        [this.sectionId]
      );
      
      if (result.rows.length === 0) {
        throw new Error('Section not found');
      }
      
      return true;
    } catch (error) {
      throw new Error(`Error deleting section: ${error.message}`);
    }
  }

  async getGroups() {
    try {
      const result = await query(
        `SELECT g.*, COUNT(st.student_id) as current_students
         FROM groups g
         LEFT JOIN students st ON g.group_id = st.group_id AND st.status = 'active'
         WHERE g.section_id = $1 AND g.status = 'active'
         GROUP BY g.group_id
         ORDER BY g.group_code ASC`,
        [this.sectionId]
      );
      
      return result.rows;
    } catch (error) {
      throw new Error(`Error getting section groups: ${error.message}`);
    }
  }

  async getStudents(options = {}) {
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
        [this.sectionId, limit, offset]
      );
      
      return result.rows;
    } catch (error) {
      throw new Error(`Error getting section students: ${error.message}`);
    }
  }

  async getSchedules(options = {}) {
    try {
      const { startDate, endDate, limit = 100 } = options;
      
      let whereClause = 'WHERE sg.group_id IN (SELECT group_id FROM groups WHERE section_id = $1)';
      let params = [this.sectionId];
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
                g.group_name, g.group_code
         FROM schedules s
         JOIN schedule_groups sg ON s.schedule_id = sg.schedule_id
         JOIN groups g ON sg.group_id = g.group_id
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
      throw new Error(`Error getting section schedules: ${error.message}`);
    }
  }

  // Get section's safe data
  toSafeObject() {
    return {
      sectionId: this.sectionId,
      sectionName: this.sectionName,
      sectionCode: this.sectionCode,
      yearLevel: this.yearLevel,
      academicYear: this.academicYear,
      semester: this.semester,
      capacity: this.capacity,
      description: this.description,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      currentStudents: this.currentStudents,
      totalGroups: this.totalGroups
    };
  }

  // Validation methods
  static validateSectionData(sectionData, isUpdate = false) {
    const errors = [];
    
    if (!isUpdate) {
      if (!sectionData.sectionName) {
        errors.push('Section name is required');
      }
      
      if (!sectionData.sectionCode) {
        errors.push('Section code is required');
      }
      
      if (!sectionData.yearLevel || !Number.isInteger(sectionData.yearLevel) || 
          sectionData.yearLevel < 1 || sectionData.yearLevel > 4) {
        errors.push('Year level must be 1, 2, 3, or 4');
      }
      
      if (!sectionData.academicYear || !/^\d{4}\/\d{4}$/.test(sectionData.academicYear)) {
        errors.push('Academic year must be in format YYYY/YYYY');
      }
      
      if (!sectionData.semester || !Number.isInteger(sectionData.semester) || 
          sectionData.semester < 1 || sectionData.semester > 3) {
        errors.push('Semester must be 1, 2, or 3');
      }
    }
    
    if (sectionData.capacity && (!Number.isInteger(sectionData.capacity) || sectionData.capacity < 1)) {
      errors.push('Capacity must be a positive integer');
    }
    
    if (sectionData.status && !['active', 'inactive'].includes(sectionData.status)) {
      errors.push('Status must be active or inactive');
    }
    
    return errors;
  }

  static validateAcademicYear(academicYear) {
    if (!/^\d{4}\/\d{4}$/.test(academicYear)) {
      return false;
    }
    
    const [startYear, endYear] = academicYear.split('/').map(Number);
    return endYear === startYear + 1;
  }
}

module.exports = Section;
