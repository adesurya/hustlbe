const winston = require('winston');
const path = require('path');

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    
    if (stack) {
      log += `\nStack: ${stack}`;
    }
    
    if (Object.keys(meta).length > 0) {
      log += `\nMeta: ${JSON.stringify(meta, null, 2)}`;
    }
    
    return log;
  })
);

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Winston logger configuration
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { 
    service: 'secure-nodejs-backend',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    // Error log file
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    }),
    
    // Combined log file
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    }),
    
    // Security log file
    new winston.transports.File({
      filename: path.join(logsDir, 'security.log'),
      level: 'warn',
      maxsize: 5242880, // 5MB
      maxFiles: 10,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    })
  ],
  
  // Handle exceptions and rejections
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ],
  
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ]
});

// Add console transport for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple(),
      winston.format.printf(({ timestamp, level, message, stack }) => {
        let log = `${timestamp} [${level}]: ${message}`;
        if (stack) log += `\n${stack}`;
        return log;
      })
    )
  }));
}

// Security logging functions
const logSecurityEvent = (event, details = {}) => {
  logger.warn('Security Event', {
    event,
    ...details,
    timestamp: new Date().toISOString()
  });
};

const logAuthAttempt = (type, success, details = {}) => {
  const level = success ? 'info' : 'warn';
  logger.log(level, `Authentication ${type}`, {
    success,
    type,
    ...details,
    timestamp: new Date().toISOString()
  });
};

const logUserAction = (action, userId, details = {}) => {
  logger.info('User Action', {
    action,
    userId,
    ...details,
    timestamp: new Date().toISOString()
  });
};

const logSystemError = (error, context = {}) => {
  logger.error('System Error', {
    message: error.message,
    stack: error.stack,
    ...context,
    timestamp: new Date().toISOString()
  });
};

const logDatabaseOperation = (operation, success, details = {}) => {
  const level = success ? 'info' : 'error';
  logger.log(level, `Database ${operation}`, {
    success,
    operation,
    ...details,
    timestamp: new Date().toISOString()
  });
};

const logAPIRequest = (req, res, responseTime) => {
  const { method, url, ip, headers } = req;
  const userAgent = headers['user-agent'] || 'Unknown';
  const userId = req.user ? req.user.id : null;
  
  logger.info('API Request', {
    method,
    url,
    statusCode: res.statusCode,
    ip,
    userAgent,
    userId,
    responseTime,
    timestamp: new Date().toISOString()
  });
};

// Express middleware for request logging
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  // Log request
  const { method, url, ip, headers } = req;
  const userAgent = headers['user-agent'] || 'Unknown';
  
  // Override res.end to capture response
  const originalEnd = res.end;
  res.end = function(...args) {
    const responseTime = Date.now() - start;
    logAPIRequest(req, res, responseTime);
    originalEnd.apply(this, args);
  };
  
  next();
};

// Error logging middleware
const errorLogger = (error, req, res, next) => {
  logSystemError(error, {
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user ? req.user.id : null
  });
  
  next(error);
};

module.exports = {
  logger,
  logSecurityEvent,
  logAuthAttempt,
  logUserAction,
  logSystemError,
  logDatabaseOperation,
  logAPIRequest,
  requestLogger,
  errorLogger
};