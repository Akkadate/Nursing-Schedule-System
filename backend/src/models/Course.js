const { query } = require('../config/database');

class Course {
  constructor(data) {
    this.courseId = data.course_id;
    this.courseName = data.course_name;
    this.courseCode = data.course_code;
    this.description = data.description;
    this.credits = data.credits;
    this.yearLevel = data.year_level;
    this.semester = data.semester;
    this.status = data.status;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  // Static methods for database operations
  static async findById(courseId) {
    try {
      const result = await query(
        'SELECT * FROM courses WHERE course_id = $1',
        [courseId]
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return new Course(result.rows[0]);
    } catch (error) {
      throw new Error(`Error finding course by ID: ${error.message}`);
    }
  }

  static async findByCourseCode(courseCode) {
    try {
      const result = await query(
        'SELECT * FROM courses WHERE course_code = $1',
        [courseCode]
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return new Course(result.rows[0]);
    } catch (error) {
      throw new Error(`Error finding course by code: ${error.message}`);
    }
  }

  static async findAll(options = {}) {
    try {
      const { 
        page = 1, 
        limit = 10, 
        search = '', 
        yearLevel = '', 
        status = '',
        semester = '',
        sortBy = 'course_code',
        sortOrder = 'ASC'
      } = options;
      
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
      
      if (semester) {
        paramCount++;
        whereClause += ` AND semester = $${paramCount}`;
        params.push(semester);
      }
      
      if (status) {
        paramCount++;
        whereClause += ` AND status = $${paramCount}`;
        params.push(status);
      }
      
      // Validate sort column
      const allowedSortColumns = ['course_name', 'course_code', 'credits', 'year_level', 'semester', 'created_at'];
      const validSortBy = allowedSortColumns.includes(sortBy) ? sortBy : 'course_code';
      const validSortOrder = ['ASC', 'DESC'].includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'ASC';
      
      const coursesQuery = `
        SELECT course_id, course_name, course_code, description, credits, year_level, semester, status, created_at, updated_at
        FROM courses 
        ${whereClause}
        ORDER BY ${validSortBy} ${validSortOrder}
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `;
      params.push(limit, offset);
      
      const result = await query(coursesQuery, params);
      
      // Count total for pagination
      const countQuery = `SELECT COUNT(*) FROM courses ${whereClause}`;
      const countResult = await query(countQuery, params.slice(0, paramCount));
      const total = parseInt(countResult.rows[0].count);
      
      return {
        courses: result.rows.map(row => new Course(row)),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: total,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      throw new Error(`Error finding all courses: ${error.message}`);
    }
  }

  static async findByYearAndSemester(yearLevel, semester) {
    try {
      const result = await query(
        `SELECT * FROM courses 
         WHERE year_level = $1 AND semester = $2 AND status = 'active'
         ORDER BY course_code ASC`,
        [yearLevel, semester]
      );
      
      return result.rows.map(row => new Course(row));
    } catch (error) {
      throw new Error(`Error finding courses by year and semester: ${error.message}`);
    }
  }

  static async create(courseData) {
    try {
      const { courseName, courseCode, description, credits, yearLevel, semester } = courseData;
      
      // Check if course code already exists
      const existingCourse = await query(
        'SELECT course_id FROM courses WHERE course_code = $1',
        [courseCode]
      );
      
      if (existingCourse.rows.length > 0) {
        throw new Error('Course code already exists');
      }
      
      const result = await query(
        `INSERT INTO courses (course_name, course_code, description, credits, year_level, semester, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
         RETURNING *`,
        [courseName, courseCode, description, credits, yearLevel, semester]
      );
      
      return new Course(result.rows[0]);
    } catch (error) {
      throw new Error(`Error creating course: ${error.message}`);
    }
  }

  // Instance methods
  async update(updateData) {
    try {
      const { courseName, description, credits, yearLevel, semester, status } = updateData;
      
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
         RETURNING *`,
        [courseName, description, credits, yearLevel, semester, status, this.courseId]
      );
      
      if (result.rows.length === 0) {
        throw new Error('Course not found');
      }
      
      // Update instance properties
      const updatedCourse = result.rows[0];
      Object.assign(this, {
        courseName: updatedCourse.course_name,
        description: updatedCourse.description,
        credits: updatedCourse.credits,
        yearLevel: updatedCourse.year_level,
        semester: updatedCourse.semester,
        status: updatedCourse.status,
        updatedAt: updatedCourse.updated_at
      });
      
      return this;
    } catch (error) {
      throw new Error(`Error updating course: ${error.message}`);
    }
  }

  async delete() {
    try {
      // Check if course has schedules
      const scheduleCheck = await query(
        'SELECT schedule_id FROM schedules WHERE course_id = $1',
        [this.courseId]
      );
      
      if (scheduleCheck.rows.length > 0) {
        throw new Error('Cannot delete course with existing schedules');
      }
      
      const result = await query(
        'DELETE FROM courses WHERE course_id = $1 RETURNING course_id',
        [this.courseId]
      );
      
      if (result.rows.length === 0) {
        throw new Error('Course not found');
      }
      
      return true;
    } catch (error) {
      throw new Error(`Error deleting course: ${error.message}`);
    }
  }

  async getSchedules(options = {}) {
    try {
      const { startDate, endDate, limit = 100 } = options;
      
      let whereClause = 'WHERE s.course_id = $1';
      let params = [this.courseId];
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
        `SELECT s.*, at.type_name, l.location_name, l.building,
                u.first_name || ' ' || u.last_name as instructor_name,
                string_agg(g.group_name, ', ') as groups
         FROM schedules s
         JOIN activity_types at ON s.activity_type_id = at.activity_type_id
         JOIN locations l ON s.location_id = l.location_id
         JOIN instructors inst ON s.instructor_id = inst.instructor_id
         JOIN users u ON inst.user_id = u.user_id
         LEFT JOIN schedule_groups sg ON s.schedule_id = sg.schedule_id
         LEFT JOIN groups g ON sg.group_id = g.group_id
         ${whereClause}
         GROUP BY s.schedule_id, at.type_name, l.location_name, l.building, u.first_name, u.last_name
         ORDER BY s.schedule_date ASC, s.start_time ASC
         LIMIT $${paramCount + 1}`,
        [...params, limit]
      );
      
      return result.rows;
    } catch (error) {
      throw new Error(`Error getting course schedules: ${error.message}`);
    }
  }

  async getStatistics() {
    try {
      const result = await query(
        `SELECT 
           COUNT(s.schedule_id) as total_schedules,
           COUNT(CASE WHEN s.schedule_date >= CURRENT_DATE THEN 1 END) as upcoming_schedules,
           COUNT(CASE WHEN s.schedule_date < CURRENT_DATE THEN 1 END) as completed_schedules,
           COUNT(DISTINCT s.instructor_id) as total_instructors,
           COUNT(DISTINCT sg.group_id) as total_groups
         FROM schedules s
         LEFT JOIN schedule_groups sg ON s.schedule_id = sg.schedule_id
         WHERE s.course_id = $1`,
        [this.courseId]
      );
      
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error getting course statistics: ${error.message}`);
    }
  }

  // Get course's safe data
  toSafeObject() {
    return {
      courseId: this.courseId,
      courseName: this.courseName,
      courseCode: this.courseCode,
      description: this.description,
      credits: this.credits,
      yearLevel: this.yearLevel,
      semester: this.semester,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  // Validation methods
  static validateCourseData(courseData, isUpdate = false) {
    const errors = [];
    
    if (!isUpdate) {
      if (!courseData.courseName) {
        errors.push('Course name is required');
      }
      
      if (!courseData.courseCode) {
        errors.push('Course code is required');
      }
      
      if (!courseData.credits || !Number.isInteger(courseData.credits) || 
          courseData.credits < 1 || courseData.credits > 10) {
        errors.push('Credits must be between 1 and 10');
      }
      
      if (!courseData.yearLevel || !Number.isInteger(courseData.yearLevel) || 
          courseData.yearLevel < 1 || courseData.yearLevel > 4) {
        errors.push('Year level must be between 1 and 4');
      }
      
      if (!courseData.semester || !Number.isInteger(courseData.semester) || 
          courseData.semester < 1 || courseData.semester > 3) {
        errors.push('Semester must be 1, 2, or 3');
      }
    }
    
    if (courseData.courseName && courseData.courseName.length > 200) {
      errors.push('Course name cannot exceed 200 characters');
    }
    
    if (courseData.courseCode && courseData.courseCode.length > 20) {
      errors.push('Course code cannot exceed 20 characters');
    }
    
    if (courseData.description && courseData.description.length > 1000) {
      errors.push('Description cannot exceed 1000 characters');
    }
    
    if (courseData.status && !['active', 'inactive'].includes(courseData.status)) {
      errors.push('Status must be active or inactive');
    }
    
    return errors;
  }

  // Get formatted course name with code
  getDisplayName() {
    return `${this.courseCode} - ${this.courseName}`;
  }

  // Check if course is currently active
  isActive() {
    return this.status === 'active';
  }

  // Get semester name in Thai
  getSemesterName() {
    const semesterNames = {
      1: 'ภาคเรียนที่ 1',
      2: 'ภาคเรียนที่ 2',
      3: 'ภาคฤดูร้อน'
    };
    
    return semesterNames[this.semester] || `ภาคเรียนที่ ${this.semester}`;
  }

  // Get year level name in Thai
  getYearLevelName() {
    const yearNames = {
      1: 'ชั้นปีที่ 1',
      2: 'ชั้นปีที่ 2',
      3: 'ชั้นปีที่ 3',
      4: 'ชั้นปีที่ 4'
    };
    
    return yearNames[this.yearLevel] || `ชั้นปีที่ ${this.yearLevel}`;
  }
}

// Activity Type class for managing activity types
class ActivityType {
  constructor(data) {
    this.activityTypeId = data.activity_type_id;
    this.typeName = data.type_name;
    this.description = data.description;
    this.requiresAttendance = data.requires_attendance;
    this.allowsScoring = data.allows_scoring;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  static async findAll() {
    try {
      const result = await query(
        'SELECT * FROM activity_types ORDER BY type_name ASC'
      );
      
      return result.rows.map(row => new ActivityType(row));
    } catch (error) {
      throw new Error(`Error finding all activity types: ${error.message}`);
    }
  }

  static async findById(activityTypeId) {
    try {
      const result = await query(
        'SELECT * FROM activity_types WHERE activity_type_id = $1',
        [activityTypeId]
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return new ActivityType(result.rows[0]);
    } catch (error) {
      throw new Error(`Error finding activity type by ID: ${error.message}`);
    }
  }

  static async create(activityTypeData) {
    try {
      const { typeName, description, requiresAttendance, allowsScoring } = activityTypeData;
      
      // Check if type name already exists
      const existingType = await query(
        'SELECT activity_type_id FROM activity_types WHERE type_name = $1',
        [typeName]
      );
      
      if (existingType.rows.length > 0) {
        throw new Error('Activity type name already exists');
      }
      
      const result = await query(
        `INSERT INTO activity_types (type_name, description, requires_attendance, allows_scoring, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         RETURNING *`,
        [typeName, description, requiresAttendance || false, allowsScoring || false]
      );
      
      return new ActivityType(result.rows[0]);
    } catch (error) {
      throw new Error(`Error creating activity type: ${error.message}`);
    }
  }

  async update(updateData) {
    try {
      const { typeName, description, requiresAttendance, allowsScoring } = updateData;
      
      const result = await query(
        `UPDATE activity_types 
         SET type_name = COALESCE($1, type_name),
             description = COALESCE($2, description),
             requires_attendance = COALESCE($3, requires_attendance),
             allows_scoring = COALESCE($4, allows_scoring),
             updated_at = NOW()
         WHERE activity_type_id = $5
         RETURNING *`,
        [typeName, description, requiresAttendance, allowsScoring, this.activityTypeId]
      );
      
      if (result.rows.length === 0) {
        throw new Error('Activity type not found');
      }
      
      // Update instance properties
      const updatedType = result.rows[0];
      Object.assign(this, {
        typeName: updatedType.type_name,
        description: updatedType.description,
        requiresAttendance: updatedType.requires_attendance,
        allowsScoring: updatedType.allows_scoring,
        updatedAt: updatedType.updated_at
      });
      
      return this;
    } catch (error) {
      throw new Error(`Error updating activity type: ${error.message}`);
    }
  }

  async delete() {
    try {
      // Check if activity type is used in schedules
      const scheduleCheck = await query(
        'SELECT schedule_id FROM schedules WHERE activity_type_id = $1',
        [this.activityTypeId]
      );
      
      if (scheduleCheck.rows.length > 0) {
        throw new Error('Cannot delete activity type with existing schedules');
      }
      
      const result = await query(
        'DELETE FROM activity_types WHERE activity_type_id = $1 RETURNING activity_type_id',
        [this.activityTypeId]
      );
      
      if (result.rows.length === 0) {
        throw new Error('Activity type not found');
      }
      
      return true;
    } catch (error) {
      throw new Error(`Error deleting activity type: ${error.message}`);
    }
  }

  toSafeObject() {
    return {
      activityTypeId: this.activityTypeId,
      typeName: this.typeName,
      description: this.description,
      requiresAttendance: this.requiresAttendance,
      allowsScoring: this.allowsScoring,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = { Course, ActivityType };
