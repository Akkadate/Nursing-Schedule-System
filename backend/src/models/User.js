const { query } = require('../config/database');
const bcrypt = require('bcryptjs');

class User {
  constructor(data) {
    this.userId = data.user_id;
    this.username = data.username;
    this.email = data.email;
    this.passwordHash = data.password_hash;
    this.firstName = data.first_name;
    this.lastName = data.last_name;
    this.role = data.role;
    this.status = data.status;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  // Static methods for database operations
  static async findById(userId) {
    try {
      const result = await query(
        'SELECT * FROM users WHERE user_id = $1',
        [userId]
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return new User(result.rows[0]);
    } catch (error) {
      throw new Error(`Error finding user by ID: ${error.message}`);
    }
  }

  static async findByUsername(username) {
    try {
      const result = await query(
        'SELECT * FROM users WHERE username = $1',
        [username]
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return new User(result.rows[0]);
    } catch (error) {
      throw new Error(`Error finding user by username: ${error.message}`);
    }
  }

  static async findByEmail(email) {
    try {
      const result = await query(
        'SELECT * FROM users WHERE email = $1',
        [email]
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return new User(result.rows[0]);
    } catch (error) {
      throw new Error(`Error finding user by email: ${error.message}`);
    }
  }

  static async findAll(options = {}) {
    try {
      const { page = 1, limit = 10, search = '', role = '' } = options;
      const offset = (page - 1) * limit;
      
      let whereClause = 'WHERE 1=1';
      let params = [];
      let paramCount = 0;
      
      if (search) {
        paramCount++;
        whereClause += ` AND (username ILIKE $${paramCount} OR email ILIKE $${paramCount} OR first_name ILIKE $${paramCount} OR last_name ILIKE $${paramCount})`;
        params.push(`%${search}%`);
      }
      
      if (role) {
        paramCount++;
        whereClause += ` AND role = $${paramCount}`;
        params.push(role);
      }
      
      const usersQuery = `
        SELECT user_id, username, email, first_name, last_name, role, status, created_at, updated_at
        FROM users 
        ${whereClause}
        ORDER BY created_at DESC 
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `;
      params.push(limit, offset);
      
      const result = await query(usersQuery, params);
      
      // Count total for pagination
      const countQuery = `SELECT COUNT(*) FROM users ${whereClause}`;
      const countResult = await query(countQuery, params.slice(0, paramCount));
      const total = parseInt(countResult.rows[0].count);
      
      return {
        users: result.rows.map(row => new User(row)),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: total,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      throw new Error(`Error finding all users: ${error.message}`);
    }
  }

  static async create(userData) {
    try {
      const { username, email, password, firstName, lastName, role } = userData;
      
      // Check if username or email already exists
      const existingUser = await query(
        'SELECT user_id FROM users WHERE username = $1 OR email = $2',
        [username, email]
      );
      
      if (existingUser.rows.length > 0) {
        throw new Error('Username or email already exists');
      }
      
      // Hash password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      
      const result = await query(
        `INSERT INTO users (username, email, password_hash, first_name, last_name, role, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
         RETURNING *`,
        [username, email, hashedPassword, firstName, lastName, role]
      );
      
      return new User(result.rows[0]);
    } catch (error) {
      throw new Error(`Error creating user: ${error.message}`);
    }
  }

  // Instance methods
  async update(updateData) {
    try {
      const { email, firstName, lastName, role, status } = updateData;
      
      // Check email uniqueness if email is being updated
      if (email && email !== this.email) {
        const emailCheck = await query(
          'SELECT user_id FROM users WHERE email = $1 AND user_id != $2',
          [email, this.userId]
        );
        
        if (emailCheck.rows.length > 0) {
          throw new Error('Email already exists');
        }
      }
      
      const result = await query(
        `UPDATE users 
         SET email = COALESCE($1, email),
             first_name = COALESCE($2, first_name),
             last_name = COALESCE($3, last_name),
             role = COALESCE($4, role),
             status = COALESCE($5, status),
             updated_at = NOW()
         WHERE user_id = $6
         RETURNING *`,
        [email, firstName, lastName, role, status, this.userId]
      );
      
      if (result.rows.length === 0) {
        throw new Error('User not found');
      }
      
      // Update instance properties
      const updatedUser = result.rows[0];
      Object.assign(this, {
        email: updatedUser.email,
        firstName: updatedUser.first_name,
        lastName: updatedUser.last_name,
        role: updatedUser.role,
        status: updatedUser.status,
        updatedAt: updatedUser.updated_at
      });
      
      return this;
    } catch (error) {
      throw new Error(`Error updating user: ${error.message}`);
    }
  }

  async updatePassword(currentPassword, newPassword) {
    try {
      // Verify current password
      const isValidPassword = await bcrypt.compare(currentPassword, this.passwordHash);
      if (!isValidPassword) {
        throw new Error('Current password is incorrect');
      }
      
      // Hash new password
      const saltRounds = 12;
      const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);
      
      await query(
        'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE user_id = $2',
        [hashedNewPassword, this.userId]
      );
      
      this.passwordHash = hashedNewPassword;
      
      return this;
    } catch (error) {
      throw new Error(`Error updating password: ${error.message}`);
    }
  }

  async delete() {
    try {
      // Check if user has related records
      const instructorCheck = await query(
        'SELECT instructor_id FROM instructors WHERE user_id = $1',
        [this.userId]
      );
      
      if (instructorCheck.rows.length > 0) {
        throw new Error('Cannot delete user with related instructor records');
      }
      
      const result = await query(
        'DELETE FROM users WHERE user_id = $1 RETURNING user_id',
        [this.userId]
      );
      
      if (result.rows.length === 0) {
        throw new Error('User not found');
      }
      
      return true;
    } catch (error) {
      throw new Error(`Error deleting user: ${error.message}`);
    }
  }

  async verifyPassword(password) {
    try {
      return await bcrypt.compare(password, this.passwordHash);
    } catch (error) {
      throw new Error(`Error verifying password: ${error.message}`);
    }
  }

  // Get user's safe data (without password)
  toSafeObject() {
    return {
      userId: this.userId,
      username: this.username,
      email: this.email,
      firstName: this.firstName,
      lastName: this.lastName,
      role: this.role,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  // Validation methods
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
    
    return errors;
  }

  static validatePassword(password) {
    const errors = [];
    
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }
    
    if (!/(?=.*[a-z])/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    
    if (!/(?=.*[A-Z])/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    
    if (!/(?=.*\d)/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    
    return errors;
  }
}

module.exports = User;
