const { 
  errorResponse, 
  HTTP_STATUS, 
  ERROR_CODES 
} = require('../utils/response');
const { logSystemError } = require('../utils/logger');

// Handle Sequelize validation errors
const handleSequelizeValidationError = (err) => {
  const errors = err.errors.map(error => ({
    field: error.path,
    message: error.message,
    value: error.value
  }));

  return errorResponse('Validation failed', ERROR_CODES.VALIDATION_ERROR, { errors });
};

// Handle Sequelize unique constraint errors
const handleSequelizeUniqueConstraintError = (err) => {
  const field = err.errors[0]?.path || 'field';
  const message = `${field} already exists`;
  
  return errorResponse(message, ERROR_CODES.RESOURCE_ALREADY_EXISTS);
};

// Handle Sequelize foreign key constraint errors
const handleSequelizeForeignKeyConstraintError = (err) => {
  return errorResponse('Referenced resource does not exist', ERROR_CODES.RESOURCE_NOT_FOUND);
};

// Handle Sequelize database connection errors
const handleSequelizeConnectionError = (err) => {
  return errorResponse('Database connection failed', ERROR_CODES.DATABASE_ERROR);
};

// Handle JWT errors
const handleJWTError = (err) => {
  if (err.name === 'JsonWebTokenError') {
    return errorResponse('Invalid token', ERROR_CODES.INVALID_TOKEN);
  }
  
  if (err.name === 'TokenExpiredError') {
    return errorResponse('Token expired', ERROR_CODES.TOKEN_EXPIRED);
  }
  
  return errorResponse('Authentication failed', ERROR_CODES.INVALID_TOKEN);
};

// Handle multer errors (file upload)
const handleMulterError = (err) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return errorResponse('File too large', ERROR_CODES.VALIDATION_ERROR);
  }
  
  if (err.code === 'LIMIT_FILE_COUNT') {
    return errorResponse('Too many files', ERROR_CODES.VALIDATION_ERROR);
  }
  
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return errorResponse('Unexpected field', ERROR_CODES.VALIDATION_ERROR);
  }
  
  return errorResponse('File upload failed', ERROR_CODES.VALIDATION_ERROR);
};

// Handle cast errors
const handleCastError = (err) => {
  return errorResponse('Invalid data format', ERROR_CODES.VALIDATION_ERROR);
};

// Main error handler middleware
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  logSystemError(err, {
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user ? req.user.id : null,
    body: req.method !== 'GET' ? req.body : undefined
  });

  // Sequelize errors
  if (err.name === 'SequelizeValidationError') {
    const response = handleSequelizeValidationError(err);
    return res.status(HTTP_STATUS.BAD_REQUEST.code).json(response);
  }

  if (err.name === 'SequelizeUniqueConstraintError') {
    const response = handleSequelizeUniqueConstraintError(err);
    return res.status(HTTP_STATUS.CONFLICT.code).json(response);
  }

  if (err.name === 'SequelizeForeignKeyConstraintError') {
    const response = handleSequelizeForeignKeyConstraintError(err);
    return res.status(HTTP_STATUS.BAD_REQUEST.code).json(response);
  }

  if (err.name === 'SequelizeConnectionError' || err.name === 'SequelizeConnectionRefusedError') {
    const response = handleSequelizeConnectionError(err);
    return res.status(HTTP_STATUS.SERVICE_UNAVAILABLE.code).json(response);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    const response = handleJWTError(err);
    return res.status(HTTP_STATUS.UNAUTHORIZED.code).json(response);
  }

  // Multer errors
  if (err.name === 'MulterError') {
    const response = handleMulterError(err);
    return res.status(HTTP_STATUS.BAD_REQUEST.code).json(response);
  }

  // Cast errors (invalid ObjectId, etc.)
  if (err.name === 'CastError') {
    const response = handleCastError(err);
    return res.status(HTTP_STATUS.BAD_REQUEST.code).json(response);
  }

  // CORS errors
  if (err.message && err.message.includes('CORS')) {
    return res.status(HTTP_STATUS.FORBIDDEN.code).json(
      errorResponse('CORS policy violation', ERROR_CODES.ACCESS_DENIED)
    );
  }

  // Rate limiting errors
  if (err.status === 429) {
    return res.status(HTTP_STATUS.TOO_MANY_REQUESTS.code).json(
      errorResponse(err.message || 'Too many requests', ERROR_CODES.RATE_LIMIT_EXCEEDED)
    );
  }

  // Validation errors (express-validator)
  if (err.status === 400 && err.array) {
    return res.status(HTTP_STATUS.BAD_REQUEST.code).json(
      errorResponse('Validation failed', ERROR_CODES.VALIDATION_ERROR, { errors: err.array() })
    );
  }

  // Default error response
  const statusCode = err.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR.code;
  const message = process.env.NODE_ENV === 'production' 
    ? 'Something went wrong' 
    : err.message || 'Internal server error';

  res.status(statusCode).json(
    errorResponse(message, ERROR_CODES.INTERNAL_ERROR)
  );
};

// Handle 404 errors
const notFoundHandler = (req, res, next) => {
  const message = `Route ${req.originalUrl} not found`;
  
  logSystemError(new Error(message), {
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  res.status(HTTP_STATUS.NOT_FOUND.code).json(
    errorResponse(message, ERROR_CODES.RESOURCE_NOT_FOUND)
  );
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  logSystemError(err, { 
    type: 'unhandledRejection',
    promise: promise.toString() 
  });
  
  // Close server & exit process
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logSystemError(err, { type: 'uncaughtException' });
  
  // Close server & exit process
  process.exit(1);
});

module.exports = {
  errorHandler,
  notFoundHandler
};