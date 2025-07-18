const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
const { jwtSecret, jwtExpire } = require('../config/auth');
const { authLogger } = require('../utils/logger');

class AuthService {
  // Generate JWT token
  static generateToken(payload) {
    try {
      return jwt.sign(payload, jwtSecret, { expiresIn: jwtExpire });
    } catch (error) {
      throw new Error(`Error generating token: ${error.message}`);
    }
  }

  // Verify JWT token
  static verifyToken(token) {
    try {
      return jwt.verify(token, jwtSecret);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Token expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid token');
      } else {
        throw new Error(`Token verification failed: ${error.message}`);
      }
    }
  }

  // Authenticate user credentials
  static async authenticate(username, password, clientIp) {
    try {
      // Find user by username
      const userResult = await query(
        `SELECT u.user_id, u.username, u.password_hash, u.email, u.first_name, u.last_name, u.role, u.status
         FROM users u 
         WHERE u.username = $1`,
        [username]
      );

      if (userResult.rows.length === 0) {
        authLogger.loginFailed(username, clientIp, 'User not found');
        throw new Error('Invalid credentials');
      }

      const user = userResult.rows[0];

      // Check user status
      if (user.status !== 'active') {
        authLogger.loginFailed(username, clientIp, 'Account inactive');
        throw new Error('Account is inactive');
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
        authLogger.loginFailed(username, clientIp, 'Invalid password');
        throw new Error('Invalid credentials');
      }

      // Log successful authentication
      authLogger.loginSuccess(user.user_id, user.username, clientIp);

      // Return user data (without password)
      return {
        userId: user.user_id,
        username: user.username,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        status: user.status
      };
    } catch (error) {
      throw error;
    }
  }

  // Create login session
  static async createSession(user, clientIp) {
    try {
      // Generate JWT token
      const tokenPayload = {
        userId: user.userId,
        username: user.username,
        role: user.role,
        iat: Math.floor(Date.now() / 1000) // issued at time
      };

      const token = this.generateToken(tokenPayload);

      // Optional: Store session in database for tracking
      // This can be useful for features like "logout from all devices"
      await this.storeSession(user.userId, token, clientIp);

      return {
        token,
        user: {
          userId: user.userId,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role
        },
        expiresIn: jwtExpire
      };
    } catch (error) {
      throw new Error(`Error creating session: ${error.message}`);
    }
  }

  // Store session information (optional - for session tracking)
  static async storeSession(userId, token, clientIp) {
    try {
      // Create a simple sessions table if needed for advanced session management
      // For now, we'll just log the session creation
      console.log(`Session created for user ${userId} from ${clientIp}`);
      
      // Future enhancement: Store in sessions table
      // await query(
      //   'INSERT INTO user_sessions (user_id, token_hash, ip_address, created_at, expires_at) VALUES ($1, $2, $3, NOW(), NOW() + INTERVAL $4)',
      //   [userId, hashToken(token), clientIp, jwtExpire]
      // );
    } catch (error) {
      // Non-critical error - just log it
      console.error('Error storing session:', error);
    }
  }

  // Validate user session
  static async validateSession(token) {
    try {
      // Verify JWT token
      const decoded = this.verifyToken(token);

      // Check if user still exists and is active
      const userResult = await query(
        'SELECT user_id, username, email, role, status FROM users WHERE user_id = $1',
        [decoded.userId]
      );

      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }

      const user = userResult.rows[0];

      if (user.status !== 'active') {
        throw new Error('User account is inactive');
      }

      return {
        userId: user.user_id,
        username: user.username,
        email: user.email,
        role: user.role,
        tokenData: decoded
      };
    } catch (error) {
      throw error;
    }
  }

  // Change user password
  static async changePassword(userId, currentPassword, newPassword) {
    try {
      // Get current password hash
      const userResult = await query(
        'SELECT password_hash FROM users WHERE user_id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }

      const user = userResult.rows[0];

      // Verify current password
      const isValidCurrentPassword = await bcrypt.compare(currentPassword, user.password_hash);
      if (!isValidCurrentPassword) {
        throw new Error('Current password is incorrect');
      }

      // Validate new password strength
      const passwordErrors = this.validatePasswordStrength(newPassword);
      if (passwordErrors.length > 0) {
        throw new Error(`Password validation failed: ${passwordErrors.join(', ')}`);
      }

      // Hash new password
      const saltRounds = 12;
      const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

      // Update password
      await query(
        'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE user_id = $2',
        [hashedNewPassword, userId]
      );

      return true;
    } catch (error) {
      throw error;
    }
  }

  // Validate password strength
  static validatePasswordStrength(password) {
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

    // Optional: Check for special characters
    // if (!/(?=.*[!@#$%^&*])/.test(password)) {
    //   errors.push('Password must contain at least one special character');
    // }

    return errors;
  }

  // Hash password
  static async hashPassword(password) {
    try {
      const saltRounds = 12;
      return await bcrypt.hash(password, saltRounds);
    } catch (error) {
      throw new Error(`Error hashing password: ${error.message}`);
    }
  }

  // Verify password
  static async verifyPassword(password, hash) {
    try {
      return await bcrypt.compare(password, hash);
    } catch (error) {
      throw new Error(`Error verifying password: ${error.message}`);
    }
  }

  // Logout user (invalidate session)
  static async logout(userId, username, clientIp) {
    try {
      // Log logout
      authLogger.logout(userId, username, clientIp);

      // Future enhancement: Invalidate stored sessions
      // await query('DELETE FROM user_sessions WHERE user_id = $1', [userId]);

      return true;
    } catch (error) {
      throw new Error(`Error during logout: ${error.message}`);
    }
  }

  // Get user profile information
  static async getUserProfile(userId) {
    try {
      const userResult = await query(
        `SELECT u.user_id, u.username, u.email, u.first_name, u.last_name, u.role, u.status,
                u.created_at, u.updated_at
         FROM users u 
         WHERE u.user_id = $1`,
        [userId]
      );

      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }

      const user = userResult.rows[0];

      return {
        userId: user.user_id,
        username: user.username,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        status: user.status,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      };
    } catch (error) {
      throw error;
    }
  }

  // Update user profile
  static async updateUserProfile(userId, updateData) {
    try {
      const { email, firstName, lastName } = updateData;

      // Check email uniqueness if email is being updated
      if (email) {
        const emailCheck = await query(
          'SELECT user_id FROM users WHERE email = $1 AND user_id != $2',
          [email, userId]
        );

        if (emailCheck.rows.length > 0) {
          throw new Error('Email already exists');
        }
      }

      // Update user profile
      const result = await query(
        `UPDATE users 
         SET email = COALESCE($1, email),
             first_name = COALESCE($2, first_name),
             last_name = COALESCE($3, last_name),
             updated_at = NOW()
         WHERE user_id = $4
         RETURNING user_id, username, email, first_name, last_name, role`,
        [email, firstName, lastName, userId]
      );

      if (result.rows.length === 0) {
        throw new Error('User not found');
      }

      const updatedUser = result.rows[0];

      return {
        userId: updatedUser.user_id,
        username: updatedUser.username,
        email: updatedUser.email,
        firstName: updatedUser.first_name,
        lastName: updatedUser.last_name,
        role: updatedUser.role
      };
    } catch (error) {
      throw error;
    }
  }

  // Check if user has permission for specific action
  static checkPermission(userRole, requiredRoles) {
    const allowedRoles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
    return allowedRoles.includes(userRole);
  }

  // Get permissions for role
  static getRolePermissions(role) {
    const permissions = {
      admin: [
        'user:read', 'user:write', 'user:delete',
        'student:read', 'student:write', 'student:delete',
        'instructor:read', 'instructor:write', 'instructor:delete',
        'section:read', 'section:write', 'section:delete',
        'group:read', 'group:write', 'group:delete',
        'schedule:read', 'schedule:write', 'schedule:delete',
        'attendance:read', 'attendance:write',
        'report:read'
      ],
      instructor: [
        'student:read',
        'section:read', 'group:read',
        'schedule:read',
        'attendance:read', 'attendance:write'
      ]
    };

    return permissions[role] || [];
  }
}

module.exports = AuthService;
