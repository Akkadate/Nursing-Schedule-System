const { query, getClient } = require('../config/database');
const AuthService = require('./authService');

class UserService {
  // Get all users with filtering and pagination
  static async getAllUsers(options = {}) {
    try {
      const { 
        page = 1, 
        limit = 10, 
        search = '', 
        role = '', 
        status = '',
        sortBy = 'created_at',
        sortOrder = 'DESC'
      } = options;
      
      const offset = (page - 1) * limit;
      
      let whereClause = 'WHERE 1=1';
      let params = [];
      let paramCount = 0;
      
      // Search filter
      if (search) {
        paramCount++;
        whereClause += ` AND (username ILIKE $${paramCount} OR email ILIKE $${paramCount} OR first_name ILIKE $${paramCount} OR last_name ILIKE $${paramCount})`;
        params.push(`%${search}%`);
      }
      
      // Role filter
      if (role) {
        paramCount++;
        whereClause += ` AND role = $${paramCount}`;
        params.push(role);
      }
      
      // Status filter
      if (status) {
        paramCount++;
        whereClause += ` AND status = $${paramCount}`;
        params.push(status);
      }
      
      // Validate sort column
      const allowedSortColumns = ['username', 'email', 'first_name', 'last_name', 'role', 'status', 'created_at', 'updated_at'];
      const validSortBy = allowedSortColumns.includes(sortBy) ? sortBy : 'created_at';
      const validSortOrder = ['ASC', 'DESC'].includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';
      
      const usersQuery = `
        SELECT user_id, username, email, first_name, last_name, role, status, created_at, updated_at
        FROM users 
        ${whereClause}
        ORDER BY ${validSortBy} ${validSortOrder}
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `;
      params.push(limit, offset);
      
      const result = await query(usersQuery, params);
      
      // Count total for pagination
      const countQuery = `SELECT COUNT(*) FROM users ${whereClause}`;
      const countResult = await query(countQuery, params.slice(0, paramCount));
      const total = parseInt(countResult.rows[0].count);
      
      return {
        users: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: total,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      throw new Error(`Error getting all users: ${error.message}`);
    }
  }

  // Get user by ID with additional information
  static async getUserById(userId) {
    try {
      const userResult = await query(
        `SELECT user_id, username, email, first_name, last_name, role, status, created_at, updated_at
         FROM users WHERE user_id = $1`,
        [userId]
      );
      
      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }
      
      const user = userResult.rows[0];
      
      // Get additional information based on role
      if (user.role === 'instructor') {
        const instructorResult = await query(
          `SELECT instructor_id, instructor_code, title, department, specialization, max_students_per_session
           FROM instructors WHERE user_id = $1`,
          [userId]
        );
        
        if (instructorResult.rows.length > 0) {
          user.instructor_info = instructorResult.rows[0];
        }
      }
      
      return user;
    } catch (error) {
      throw error;
    }
  }

  // Create new user
  static async createUser(userData) {
    const client = await getClient();
    
    try {
      await client.query('BEGIN');
      
      const { username, email, password, firstName, lastName, role, instructorData } = userData;
      
      // Validate input data
      const validationErrors = this.validateUserData(userData);
      if (validationErrors.length > 0) {
        throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
      }
      
      // Check if username or email already exists
      const existingUser = await client.query(
        'SELECT user_id FROM users WHERE username = $1 OR email = $2',
        [username, email]
      );
      
      if (existingUser.rows.length > 0) {
        throw new Error('Username or email already exists');
      }
      
      // Hash password
      const hashedPassword = await AuthService.hashPassword(password);
      
      // Create user
      const userResult = await client.query(
        `INSERT INTO users (username, email, password_hash, first_name, last_name, role, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
         RETURNING user_id, username, email, first_name, last_name, role, status, created_at`,
        [username, email, hashedPassword, firstName, lastName, role]
      );
      
      const newUser = userResult.rows[0];
      
      // If role is instructor, create instructor record
      if (role === 'instructor' && instructorData) {
        const { instructorCode, title, department, specialization, maxStudentsPerSession } = instructorData;
        
        await client.query(
          `INSERT INTO instructors (user_id, instructor_code, title, department, specialization, max_students_per_session, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
          [newUser.user_id, instructorCode, title, department, specialization, maxStudentsPerSession]
        );
      }
      
      await client.query('COMMIT');
      return newUser;
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Update user
  static async updateUser(userId, updateData) {
    const client = await getClient();
    
    try {
      await client.query('BEGIN');
      
      const { email, firstName, lastName, role, status, instructorData } = updateData;
      
      // Check if user exists
      const checkResult = await client.query(
        'SELECT user_id, role FROM users WHERE user_id = $1',
        [userId]
      );
      
      if (checkResult.rows.length === 0) {
        throw new Error('User not found');
      }
      
      const currentUser = checkResult.rows[0];
      
      // Check email uniqueness if email is being updated
      if (email) {
        const emailCheck = await client.query(
          'SELECT user_id FROM users WHERE email = $1 AND user_id != $2',
          [email, userId]
        );
        
        if (emailCheck.rows.length > 0) {
          throw new Error('Email already exists');
        }
      }
      
      // Update user
      const result = await client.query(
        `UPDATE users 
         SET email = COALESCE($1, email),
             first_name = COALESCE($2, first_name),
             last_name = COALESCE($3, last_name),
             role = COALESCE($4, role),
             status = COALESCE($5, status),
             updated_at = NOW()
         WHERE user_id = $6
         RETURNING user_id, username, email, first_name, last_name, role, status, updated_at`,
        [email, firstName, lastName, role, status, userId]
      );
      
      const updatedUser = result.rows[0];
      
      // Handle instructor data if role is instructor
      if (role === 'instructor' || currentUser.role === 'instructor') {
        const instructorExists = await client.query(
          'SELECT instructor_id FROM instructors WHERE user_id = $1',
          [userId]
        );
        
        if (role === 'instructor') {
          if (instructorExists.rows.length > 0 && instructorData) {
            // Update existing instructor record
            const { title, department, specialization, maxStudentsPerSession } = instructorData;
            await client.query(
              `UPDATE instructors 
               SET title = COALESCE($1, title),
                   department = COALESCE($2, department),
                   specialization = COALESCE($3, specialization),
                   max_students_per_session = COALESCE($4, max_students_per_session),
                   updated_at = NOW()
               WHERE user_id = $5`,
              [title, department, specialization, maxStudentsPerSession, userId]
            );
          } else if (instructorExists.rows.length === 0 && instructorData) {
            // Create new instructor record
            const { instructorCode, title, department, specialization, maxStudentsPerSession } = instructorData;
            await client.query(
              `INSERT INTO instructors (user_id, instructor_code, title, department, specialization, max_students_per_session, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
              [userId, instructorCode, title, department, specialization, maxStudentsPerSession]
            );
          }
        } else if (currentUser.role === 'instructor' && role !== 'instructor') {
          // Role changed from instructor to something else - check if can delete instructor record
          const scheduleCheck = await client.query(
            'SELECT schedule_id FROM schedules WHERE instructor_id = (SELECT instructor_id FROM instructors WHERE user_id = $1)',
            [userId]
          );
          
          if (scheduleCheck.rows.length > 0) {
            throw new Error('Cannot change role: user has existing schedule assignments');
          }
          
          // Delete instructor record
          await client.query('DELETE FROM instructors WHERE user_id = $1', [userId]);
        }
      }
      
      await client.query('COMMIT');
      return updatedUser;
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Delete user
  static async deleteUser(userId, currentUserId) {
    const client = await getClient();
    
    try {
      await client.query('BEGIN');
      
      // Prevent self-deletion
      if (parseInt(userId) === currentUserId) {
        throw new Error('Cannot delete your own account');
      }
      
      // Check if user exists
      const checkResult = await client.query(
        'SELECT user_id, username, role FROM users WHERE user_id = $1',
        [userId]
      );
      
      if (checkResult.rows.length === 0) {
        throw new Error('User not found');
      }
      
      const user = checkResult.rows[0];
      
      // Check if user has related records that prevent deletion
      if (user.role === 'instructor') {
        const instructorCheck = await client.query(
          'SELECT instructor_id FROM instructors WHERE user_id = $1',
          [userId]
        );
        
        if (instructorCheck.rows.length > 0) {
          const scheduleCheck = await client.query(
            'SELECT schedule_id FROM schedules WHERE instructor_id = $1',
            [instructorCheck.rows[0].instructor_id]
          );
          
          if (scheduleCheck.rows.length > 0) {
            throw new Error('Cannot delete user: instructor has existing schedule assignments');
          }
          
          // Delete instructor record first
          await client.query('DELETE FROM instructors WHERE user_id = $1', [userId]);
        }
      }
      
      // Delete user
      await client.query('DELETE FROM users WHERE user_id = $1', [userId]);
      
      await client.query('COMMIT');
      return true;
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Update user status
  static async updateUserStatus(userId, status, currentUserId) {
    try {
      // Prevent changing own status
      if (parseInt(userId) === currentUserId) {
        throw new Error('Cannot change your own account status');
      }
      
      // Check if user exists
      const checkResult = await query(
        'SELECT user_id, username, status FROM users WHERE user_id = $1',
        [userId]
      );
      
      if (checkResult.rows.length === 0) {
        throw new Error('User not found');
      }
      
      // Update status
      const result = await query(
        `UPDATE users 
         SET status = $1, updated_at = NOW()
         WHERE user_id = $2
         RETURNING user_id, username, email, first_name, last_name, role, status, updated_at`,
        [status, userId]
      );
      
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Get user statistics
  static async getUserStatistics() {
    try {
      const statsResult = await query(`
        SELECT 
          COUNT(*) as total_users,
          COUNT(CASE WHEN role = 'admin' THEN 1 END) as admin_count,
          COUNT(CASE WHEN role = 'instructor' THEN 1 END) as instructor_count,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active_users,
          COUNT(CASE WHEN status = 'inactive' THEN 1 END) as inactive_users,
          COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as new_users_30_days
        FROM users
      `);
      
      return statsResult.rows[0];
    } catch (error) {
      throw new Error(`Error getting user statistics: ${error.message}`);
    }
  }

  // Validate user data
  static validateUserData(userData, isUpdate = false) {
    const errors = [];
    
    if (!isUpdate) {
      if (!userData.username || userData.username.length < 3) {
        errors.push('Username must be at least 3 characters long');
      }
      
      if (!userData.password || userData.password.length < 8) {
        errors.push('Password must be at least 8 characters long');
      }
      
      if (!userData.firstName) {
        errors.push('First name is required');
      }
      
      if (!userData.lastName) {
        errors.push('Last name is required');
      }
      
      if (!userData.role || !['admin', 'instructor'].includes(userData.role)) {
        errors.push('Role must be admin or instructor');
      }
    }
    
    if (userData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userData.email)) {
      errors.push('Invalid email format');
    }
    
    if (userData.status && !['active', 'inactive'].includes(userData.status)) {
      errors.push('Status must be active or inactive');
    }
    
    return errors;
  }

  // Reset user password (admin function)
  static async resetUserPassword(userId, newPassword) {
    try {
      // Validate new password
      const passwordErrors = AuthService.validatePasswordStrength(newPassword);
      if (passwordErrors.length > 0) {
        throw new Error(`Password validation failed: ${passwordErrors.join(', ')}`);
      }
      
      // Hash new password
      const hashedPassword = await AuthService.hashPassword(newPassword);
      
      // Update password
      const result = await query(
        'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE user_id = $2 RETURNING user_id',
        [hashedPassword, userId]
      );
      
      if (result.rows.length === 0) {
        throw new Error('User not found');
      }
      
      return true;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = UserService;
