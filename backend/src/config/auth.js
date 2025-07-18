require('dotenv').config();

const authConfig = {
  jwtSecret: process.env.JWT_SECRET,
  jwtExpire: process.env.JWT_EXPIRE || '24h',
  
  // Password requirements
  password: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: false
  },
  
  // Session configuration
  session: {
    maxConcurrentSessions: 3, // Maximum concurrent sessions per user
    extendOnActivity: true // Extend session on user activity
  },
  
  // Rate limiting for auth endpoints
  rateLimit: {
    login: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5 // Maximum 5 failed login attempts per window
    },
    register: {
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 3 // Maximum 3 registration attempts per hour
    }
  },
  
  // Account lockout settings
  lockout: {
    maxAttempts: 5, // Lock account after 5 failed attempts
    lockoutDuration: 30 * 60 * 1000, // Lock for 30 minutes
    resetOnSuccess: true // Reset failed attempts on successful login
  }
};

// Validate required environment variables
const validateAuthConfig = () => {
  if (!authConfig.jwtSecret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  
  if (authConfig.jwtSecret.length < 32) {
    console.warn('⚠️  JWT_SECRET should be at least 32 characters long for security');
  }
  
  console.log('✅ Authentication configuration validated');
};

module.exports = {
  ...authConfig,
  validateAuthConfig
};
