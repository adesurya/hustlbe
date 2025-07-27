const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests from specific origins or no origin (for mobile apps)
    const allowedOrigins = [
      process.env.FRONTEND_URL,
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001'
    ].filter(Boolean);

    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

// Helmet configuration for security headers
const helmetOptions = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: parseInt(process.env.HELMET_HSTS_MAX_AGE) || 31536000,
    includeSubDomains: true,
    preload: true
  }
};

// Rate limiting configuration
const createRateLimit = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      error: message || 'Too many requests, please try again later.',
      retryAfter: Math.ceil(windowMs / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        error: 'Too many requests',
        message: 'Rate limit exceeded',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
  });
};

// General rate limiting
const generalLimiter = createRateLimit(
  parseInt(process.env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000, // 15 minutes
  parseInt(process.env.RATE_LIMIT_MAX) || 100, // limit each IP to 100 requests per windowMs
  'Too many requests from this IP, please try again later.'
);

// Auth endpoints rate limiting (more restrictive)
const authLimiter = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  10, // limit each IP to 10 requests per windowMs
  'Too many authentication attempts, please try again later.'
);

// Login rate limiting (very restrictive)
const loginLimiter = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  5, // limit each IP to 5 login attempts per windowMs
  'Too many login attempts, please try again later.'
);

// Speed limiter for auth endpoints
const authSpeedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 3, // allow 3 requests per windowMs without delay
  delayMs: () => 500, // add 500ms delay per request after delayAfter
  maxDelayMs: 10000, // maximum delay of 10 seconds
  validate: {
    delayMs: false // disable the warning message
  }
});

// Password validation rules
const passwordRules = {
  minLength: 8,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  specialChars: '!@#$%^&*()_+-=[]{}|;:,.<>?',
  blacklistedPasswords: [
    'password', 'password123', '123456', '123456789', 'qwerty',
    'abc123', 'password1', 'admin', 'admin123', 'root', 'user'
  ]
};

// Input sanitization patterns
const sanitizationPatterns = {
  // Remove potentially dangerous characters
  dangerous: /[<>\"'%;()&+]/g,
  // SQL injection patterns
  sqlInjection: /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b)|(-{2})|\/\*|\*\//gi,
  // XSS patterns
  xss: /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  // NoSQL injection patterns
  nosqlInjection: /(\$where|\$ne|\$in|\$nin|\$gt|\$lt|\$gte|\$lte|\$exists|\$regex)/gi
};

// Validation helpers
const validatePassword = (password) => {
  const errors = [];
  
  if (password.length < passwordRules.minLength) {
    errors.push(`Password must be at least ${passwordRules.minLength} characters long`);
  }
  
  if (password.length > passwordRules.maxLength) {
    errors.push(`Password must be no more than ${passwordRules.maxLength} characters long`);
  }
  
  if (passwordRules.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (passwordRules.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (passwordRules.requireNumbers && !/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (passwordRules.requireSpecialChars && !new RegExp(`[${passwordRules.specialChars.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]`).test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  if (passwordRules.blacklistedPasswords.includes(password.toLowerCase())) {
    errors.push('Password is too common and not allowed');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Input sanitization function
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  
  return input
    .replace(sanitizationPatterns.dangerous, '')
    .replace(sanitizationPatterns.sqlInjection, '')
    .replace(sanitizationPatterns.xss, '')
    .replace(sanitizationPatterns.nosqlInjection, '')
    .trim();
};

// Additional security functions
const generateSecureToken = (length = 32) => {
  const crypto = require('crypto');
  return crypto.randomBytes(length).toString('hex');
};

const hashSensitiveData = (data, algorithm = 'sha256') => {
  const crypto = require('crypto');
  return crypto.createHash(algorithm).update(data).digest('hex');
};

const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const isValidPhoneNumber = (phone) => {
  const phoneRegex = /^[+]?[\d\s\-()]+$/;
  return phoneRegex.test(phone);
};

const isValidUrl = (url) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

// IP whitelist/blacklist functions
const isIPWhitelisted = (ip) => {
  const whitelist = process.env.IP_WHITELIST ? process.env.IP_WHITELIST.split(',') : [];
  return whitelist.length === 0 || whitelist.includes(ip);
};

const isIPBlacklisted = (ip) => {
  const blacklist = process.env.IP_BLACKLIST ? process.env.IP_BLACKLIST.split(',') : [];
  return blacklist.includes(ip);
};

// File upload security
const allowedFileTypes = {
  images: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
  documents: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  archives: ['application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed']
};

const isAllowedFileType = (mimetype, category = 'images') => {
  return allowedFileTypes[category] && allowedFileTypes[category].includes(mimetype.toLowerCase());
};

const getFileSizeLimit = (category = 'images') => {
  const limits = {
    images: 5 * 1024 * 1024, // 5MB
    documents: 10 * 1024 * 1024, // 10MB
    archives: 50 * 1024 * 1024 // 50MB
  };
  return limits[category] || limits.images;
};

// Security headers middleware
const securityHeaders = (req, res, next) => {
  // Additional security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  // Remove server signature
  res.removeHeader('X-Powered-By');
  
  next();
};

// Request logging for security monitoring
const securityLogger = (req, res, next) => {
  const startTime = Date.now();
  const originalEnd = res.end;
  
  res.end = function(...args) {
    const duration = Date.now() - startTime;
    const logData = {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      statusCode: res.statusCode,
      duration,
      timestamp: new Date().toISOString()
    };
    
    // Log suspicious activities
    if (res.statusCode === 401 || res.statusCode === 403 || res.statusCode === 429) {
      console.warn('Security Alert:', logData);
    }
    
    originalEnd.apply(this, args);
  };
  
  next();
};

module.exports = {
  corsOptions,
  helmetOptions,
  generalLimiter,
  authLimiter,
  loginLimiter,
  authSpeedLimiter,
  passwordRules,
  validatePassword,
  sanitizeInput,
  sanitizationPatterns,
  generateSecureToken,
  hashSensitiveData,
  isValidEmail,
  isValidPhoneNumber,
  isValidUrl,
  isIPWhitelisted,
  isIPBlacklisted,
  allowedFileTypes,
  isAllowedFileType,
  getFileSizeLimit,
  securityHeaders,
  securityLogger
};