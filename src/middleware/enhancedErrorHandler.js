// middleware/enhancedErrorHandler.js
const { logger } = require('../utils/logger');
const { 
  errorResponse, 
  HTTP_STATUS, 
  ERROR_CODES 
} = require('../utils/response');

/**
 * Enhanced error handler with specific handling for Category operations
 */
const enhancedErrorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error details
  logger.error(`Error ${err.message}`, {
    error: err.stack,
    path: req.path,
    method: req.method,
    params: req.params,
    query: req.query,
    userId: req.user?.id,
    userRole: req.user?.role
  });

  // Sequelize validation errors
  if (err.name === 'SequelizeValidationError') {
    const messages = err.errors.map(error => error.message);
    return res.status(HTTP_STATUS.BAD_REQUEST.code).json(
      errorResponse(
        'Validation error',
        ERROR_CODES.VALIDATION_ERROR,
        {
          fields: messages
        }
      )
    );
  }

  // Sequelize unique constraint errors
  if (err.name === 'SequelizeUniqueConstraintError') {
    const field = err.errors[0]?.path || 'field';
    return res.status(HTTP_STATUS.CONFLICT.code).json(
      errorResponse(
        `${field} already exists`,
        ERROR_CODES.DUPLICATE_RESOURCE,
        {
          field: field,
          value: err.errors[0]?.value
        }
      )
    );
  }

  // Sequelize foreign key constraint errors
  if (err.name === 'SequelizeForeignKeyConstraintError') {
    return res.status(HTTP_STATUS.BAD_REQUEST.code).json(
      errorResponse(
        'Referenced resource not found',
        ERROR_CODES.INVALID_REFERENCE
      )
    );
  }

  // Sequelize database connection errors
  if (err.name === 'SequelizeConnectionError') {
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR.code).json(
      errorResponse(
        'Database connection error',
        ERROR_CODES.DATABASE_ERROR
      )
    );
  }

  // Custom application errors
  if (err.message === 'Category not found') {
    return res.status(HTTP_STATUS.NOT_FOUND.code).json(
      errorResponse(
        'Category not found',
        ERROR_CODES.RESOURCE_NOT_FOUND,
        {
          resource: 'category',
          id: req.params.id
        }
      )
    );
  }

  if (err.message?.includes('already exists')) {
    return res.status(HTTP_STATUS.CONFLICT.code).json(
      errorResponse(
        err.message,
        ERROR_CODES.DUPLICATE_RESOURCE
      )
    );
  }

  if (err.message?.includes('Cannot delete category')) {
    return res.status(HTTP_STATUS.BAD_REQUEST.code).json(
      errorResponse(
        err.message,
        ERROR_CODES.DEPENDENCY_CONFLICT,
        {
          suggestion: 'Remove or move associated products first'
        }
      )
    );
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(HTTP_STATUS.UNAUTHORIZED.code).json(
      errorResponse(
        'Invalid token',
        ERROR_CODES.INVALID_TOKEN
      )
    );
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(HTTP_STATUS.UNAUTHORIZED.code).json(
      errorResponse(
        'Token expired',
        ERROR_CODES.TOKEN_EXPIRED
      )
    );
  }

  // Multer errors (file upload)
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(HTTP_STATUS.BAD_REQUEST.code).json(
      errorResponse(
        'File size too large',
        ERROR_CODES.FILE_TOO_LARGE,
        {
          maxSize: '5MB'
        }
      )
    );
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(HTTP_STATUS.BAD_REQUEST.code).json(
      errorResponse(
        'Unexpected file field',
        ERROR_CODES.INVALID_FILE_FIELD
      )
    );
  }

  // Default server error
  const statusCode = err.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR.code;
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : err.message;

  res.status(statusCode).json(
    errorResponse(
      message,
      ERROR_CODES.INTERNAL_ERROR,
      process.env.NODE_ENV === 'development' ? { stack: err.stack } : undefined
    )
  );
};

/**
 * Async handler wrapper with enhanced error context
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((error) => {
    // Add request context to error
    error.requestContext = {
      method: req.method,
      path: req.path,
      params: req.params,
      query: req.query,
      userId: req.user?.id,
      timestamp: new Date().toISOString()
    };
    next(error);
  });
};

/**
 * 404 handler
 */
const notFoundHandler = (req, res, next) => {
  const error = new Error(`Resource not found - ${req.originalUrl}`);
  error.statusCode = HTTP_STATUS.NOT_FOUND.code;
  next(error);
};

/**
 * Validation error formatter
 */
const formatValidationErrors = (errors) => {
  return errors.reduce((acc, error) => {
    const field = error.path;
    if (!acc[field]) {
      acc[field] = [];
    }
    acc[field].push(error.msg);
    return acc;
  }, {});
};

module.exports = {
  enhancedErrorHandler,
  asyncHandler,
  notFoundHandler,
  formatValidationErrors
};