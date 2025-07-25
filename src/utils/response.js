/**
 * Create standardized API response
 * @param {boolean} success - Success status
 * @param {string} message - Response message
 * @param {object} data - Response data
 * @param {string} code - Error/success code
 * @param {object} meta - Additional metadata (pagination, etc.)
 * @returns {object} Standardized response object
 */
const createResponse = (success = true, message = '', data = null, code = null, meta = null) => {
  const response = {
    success,
    message,
    timestamp: new Date().toISOString()
  };

  if (data !== null) {
    response.data = data;
  }

  if (code) {
    response.code = code;
  }

  if (meta) {
    response.meta = meta;
  }

  return response;
};

/**
 * Create success response
 * @param {string} message - Success message
 * @param {object} data - Response data
 * @param {object} meta - Additional metadata
 * @returns {object} Success response
 */
const successResponse = (message = 'Success', data = null, meta = null) => {
  return createResponse(true, message, data, 'SUCCESS', meta);
};

/**
 * Create error response
 * @param {string} message - Error message
 * @param {string} code - Error code
 * @param {object} data - Error data
 * @returns {object} Error response
 */
const errorResponse = (message = 'Error', code = 'ERROR', data = null) => {
  return createResponse(false, message, data, code);
};

/**
 * Create pagination metadata
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @param {number} total - Total items
 * @param {number} totalPages - Total pages
 * @returns {object} Pagination metadata
 */
const createPaginationMeta = (page, limit, total, totalPages) => {
  return {
    pagination: {
      currentPage: parseInt(page),
      itemsPerPage: parseInt(limit),
      totalItems: parseInt(total),
      totalPages: parseInt(totalPages),
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    }
  };
};

/**
 * Handle async route errors
 * @param {function} fn - Async function
 * @returns {function} Express middleware
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Common HTTP status codes with messages
 */
const HTTP_STATUS = {
  OK: { code: 200, message: 'OK' },
  CREATED: { code: 201, message: 'Created' },
  ACCEPTED: { code: 202, message: 'Accepted' },
  NO_CONTENT: { code: 204, message: 'No Content' },
  BAD_REQUEST: { code: 400, message: 'Bad Request' },
  UNAUTHORIZED: { code: 401, message: 'Unauthorized' },
  FORBIDDEN: { code: 403, message: 'Forbidden' },
  NOT_FOUND: { code: 404, message: 'Not Found' },
  METHOD_NOT_ALLOWED: { code: 405, message: 'Method Not Allow' },
  CONFLICT: { code: 409, message: 'Conflict' },
  UNPROCESSABLE_ENTITY: { code: 422, message: 'Unprocessable Entity' },
  TOO_MANY_REQUESTS: { code: 429, message: 'Too Many Requests' },
  INTERNAL_SERVER_ERROR: { code: 500, message: 'Internal Server Error' },
  BAD_GATEWAY: { code: 502, message: 'Bad Gateway' },
  SERVICE_UNAVAILABLE: { code: 503, message: 'Service Unavailable' }
};

/**
 * Common error codes
 */
const ERROR_CODES = {
  // Authentication errors
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  ACCOUNT_DISABLED: 'ACCOUNT_DISABLED',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  MISSING_TOKEN: 'MISSING_TOKEN',
  
  // Authorization errors
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  ACCESS_DENIED: 'ACCESS_DENIED',
  
  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  INVALID_INPUT: 'INVALID_INPUT',
  
  // Resource errors
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  RESOURCE_ALREADY_EXISTS: 'RESOURCE_ALREADY_EXISTS',
  RESOURCE_CONFLICT: 'RESOURCE_CONFLICT',
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  
  // Rate limiting
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  
  // Server errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR'
};

/**
 * Success codes
 */
const SUCCESS_CODES = {
  USER_CREATED: 'USER_CREATED',
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGOUT_SUCCESS: 'LOGOUT_SUCCESS',
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',
  PROFILE_UPDATED: 'PROFILE_UPDATED',
  EMAIL_VERIFIED: 'EMAIL_VERIFIED',
  EMAIL_VERIFICATION_SENT: 'EMAIL_VERIFICATION_SENT',
  TOKEN_REFRESHED: 'TOKEN_REFRESHED',
  POINTS_AWARDED: 'POINTS_AWARDED',
  POINTS_REDEEMED: 'POINTS_REDEEMED',
  REDEMPTION_PROCESSED: 'REDEMPTION_PROCESSED',
  RESOURCE_CREATED: 'RESOURCE_CREATED',
  RESOURCE_UPDATED: 'RESOURCE_UPDATED',
  RESOURCE_DELETED: 'RESOURCE_DELETED',
  STATUS_UPDATED: 'STATUS_UPDATED',
  FILE_UPLOADED: 'FILE_UPLOADED'
};

module.exports = {
  createResponse,
  successResponse,
  errorResponse,
  createPaginationMeta,
  asyncHandler,
  HTTP_STATUS,
  ERROR_CODES,
  SUCCESS_CODES
};