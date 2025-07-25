const { body, param, query, validationResult } = require('express-validator');
const { validatePassword, sanitizeInput } = require('../config/security');
const { createResponse } = require('../utils/response');

// Handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.path,
      message: error.msg,
      value: error.value
    }));

    return res.status(400).json(
      createResponse(false, 'Validation failed', { errors: errorMessages }, 'VALIDATION_ERROR')
    );
  }
  next();
};

// Sanitize input middleware
const sanitizeInputs = (fields) => {
  return (req, res, next) => {
    fields.forEach(field => {
      if (req.body[field]) {
        req.body[field] = sanitizeInput(req.body[field]);
      }
    });
    next();
  };
};

// Custom validators
const customValidators = {
  isStrongPassword: (value) => {
    const validation = validatePassword(value);
    if (!validation.isValid) {
      throw new Error(validation.errors.join(', '));
    }
    return true;
  },
  
  isValidPhoneNumber: (value) => {
    if (!value) return true; // Phone number is optional
    const phoneRegex = /^[+]?[\d\s\-()]+$/;
    if (!phoneRegex.test(value)) {
      throw new Error('Invalid phone number format');
    }
    return true;
  },
  
  isValidRole: (value) => {
    const validRoles = ['admin', 'user'];
    if (!validRoles.includes(value)) {
      throw new Error('Invalid role. Must be either admin or user');
    }
    return true;
  }
};

// Validation rules for signup
const validateSignup = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage('Username must be between 3 and 50 characters')
    .isAlphanumeric()
    .withMessage('Username must contain only letters and numbers')
    .notEmpty()
    .withMessage('Username is required'),
    
  body('email')
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
    .isLength({ max: 100 })
    .withMessage('Email must not exceed 100 characters'),
    
  body('phoneNumber')
    .optional()
    .trim()
    .custom(customValidators.isValidPhoneNumber),
    
  body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .custom(customValidators.isStrongPassword),
    
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Password confirmation does not match password');
      }
      return true;
    }),
    
  sanitizeInputs(['username', 'email', 'phoneNumber']),
  handleValidationErrors
];

// Validation rules for login
const validateLogin = [
  body('identifier')
    .trim()
    .notEmpty()
    .withMessage('Username or email is required')
    .isLength({ min: 3, max: 100 })
    .withMessage('Identifier must be between 3 and 100 characters'),
    
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 1, max: 128 })
    .withMessage('Invalid password length'),
    
  sanitizeInputs(['identifier']),
  handleValidationErrors
];

// Validation rules for password change
const validatePasswordChange = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
    
  body('newPassword')
    .isLength({ min: 8, max: 128 })
    .withMessage('New password must be between 8 and 128 characters')
    .custom(customValidators.isStrongPassword),
    
  body('confirmNewPassword')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('New password confirmation does not match new password');
      }
      return true;
    }),
    
  handleValidationErrors
];

// Validation rules for profile update
const validateProfileUpdate = [
  body('username')
    .optional()
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage('Username must be between 3 and 50 characters')
    .isAlphanumeric()
    .withMessage('Username must contain only letters and numbers'),
    
  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
    .isLength({ max: 100 })
    .withMessage('Email must not exceed 100 characters'),
    
  body('phoneNumber')
    .optional()
    .trim()
    .custom(customValidators.isValidPhoneNumber),
    
  body('profilePicture')
    .optional()
    .isURL()
    .withMessage('Profile picture must be a valid URL'),
    
  sanitizeInputs(['username', 'email', 'phoneNumber']),
  handleValidationErrors
];

// Validation rules for admin operations
const validateAdminUserUpdate = [
  body('role')
    .optional()
    .custom(customValidators.isValidRole),
    
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean value'),
    
  body('isVerified')
    .optional()
    .isBoolean()
    .withMessage('isVerified must be a boolean value'),
    
  handleValidationErrors
];

// Validation rules for refresh token
const validateRefreshToken = [
  body('refreshToken')
    .notEmpty()
    .withMessage('Refresh token is required')
    .isJWT()
    .withMessage('Invalid refresh token format'),
    
  handleValidationErrors
];

// Validation rules for pagination
const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
    
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
    
  query('sortBy')
    .optional()
    .isIn(['createdAt', 'updatedAt', 'username', 'email', 'role'])
    .withMessage('Invalid sort field'),
    
  query('sortOrder')
    .optional()
    .isIn(['ASC', 'DESC'])
    .withMessage('Sort order must be ASC or DESC'),
    
  handleValidationErrors
];

// Validation rules for ID parameters
const validateIdParam = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('ID must be a positive integer'),
    
  handleValidationErrors
];

// Validation rules for category creation
const validateCategoryCreate = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Category name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Category name must be between 2 and 100 characters'),
    
  body('slug')
    .optional()
    .trim()
    .isSlug()
    .withMessage('Slug must be a valid slug format')
    .isLength({ min: 2, max: 120 })
    .withMessage('Slug must be between 2 and 120 characters'),
    
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must not exceed 1000 characters'),
    
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean value'),
    
  body('sortOrder')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Sort order must be a non-negative integer'),
    
  sanitizeInputs(['name', 'slug', 'description']),
  handleValidationErrors
];

// Validation rules for category update
const validateCategoryUpdate = [
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Category name cannot be empty')
    .isLength({ min: 2, max: 100 })
    .withMessage('Category name must be between 2 and 100 characters'),
    
  body('slug')
    .optional()
    .trim()
    .isSlug()
    .withMessage('Slug must be a valid slug format')
    .isLength({ min: 2, max: 120 })
    .withMessage('Slug must be between 2 and 120 characters'),
    
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must not exceed 1000 characters'),
    
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean value'),
    
  body('sortOrder')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Sort order must be a non-negative integer'),
    
  sanitizeInputs(['name', 'slug', 'description']),
  handleValidationErrors
];

// Validation rules for product creation
const validateProductCreate = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Product title is required')
    .isLength({ min: 2, max: 200 })
    .withMessage('Product title must be between 2 and 200 characters'),
    
  body('slug')
    .optional()
    .trim()
    .isSlug()
    .withMessage('Slug must be a valid slug format')
    .isLength({ min: 2, max: 220 })
    .withMessage('Slug must be between 2 and 220 characters'),
    
  body('description')
    .optional()
    .trim()
    .isLength({ max: 5000 })
    .withMessage('Description must not exceed 5000 characters'),
    
  body('points')
    .isInt({ min: 0 })
    .withMessage('Points must be a non-negative integer'),
    
  body('price')
    .isFloat({ min: 0 })
    .withMessage('Price must be a non-negative number'),
    
  body('url')
    .optional()
    .trim()
    .isURL()
    .withMessage('URL must be a valid URL')
    .isLength({ max: 500 })
    .withMessage('URL must not exceed 500 characters'),
    
  body('categoryId')
    .isInt({ min: 1 })
    .withMessage('Category ID must be a positive integer'),
    
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean value'),
    
  body('isFeatured')
    .optional()
    .isBoolean()
    .withMessage('isFeatured must be a boolean value'),
    
  body('stockQuantity')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Stock quantity must be a non-negative integer'),
    
  body('sortOrder')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Sort order must be a non-negative integer'),
    
  body('metaTitle')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Meta title must not exceed 200 characters'),
    
  body('metaDescription')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Meta description must not exceed 500 characters'),
    
  sanitizeInputs(['title', 'slug', 'description', 'url', 'metaTitle', 'metaDescription']),
  handleValidationErrors
];

// Validation rules for product update
const validateProductUpdate = [
  body('title')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Product title cannot be empty')
    .isLength({ min: 2, max: 200 })
    .withMessage('Product title must be between 2 and 200 characters'),
    
  body('slug')
    .optional()
    .trim()
    .isSlug()
    .withMessage('Slug must be a valid slug format')
    .isLength({ min: 2, max: 220 })
    .withMessage('Slug must be between 2 and 220 characters'),
    
  body('description')
    .optional()
    .trim()
    .isLength({ max: 5000 })
    .withMessage('Description must not exceed 5000 characters'),
    
  body('points')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Points must be a non-negative integer'),
    
  body('price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Price must be a non-negative number'),
    
  body('url')
    .optional()
    .trim()
    .isURL()
    .withMessage('URL must be a valid URL')
    .isLength({ max: 500 })
    .withMessage('URL must not exceed 500 characters'),
    
  body('categoryId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Category ID must be a positive integer'),
    
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean value'),
    
  body('isFeatured')
    .optional()
    .isBoolean()
    .withMessage('isFeatured must be a boolean value'),
    
  body('stockQuantity')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Stock quantity must be a non-negative integer'),
    
  body('sortOrder')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Sort order must be a non-negative integer'),
    
  body('metaTitle')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Meta title must not exceed 200 characters'),
    
  body('metaDescription')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Meta description must not exceed 500 characters'),
    
  sanitizeInputs(['title', 'slug', 'description', 'url', 'metaTitle', 'metaDescription']),
  handleValidationErrors
];

// Validation rules for search and filtering
const validateProductFilter = [
  query('category')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Category must be a positive integer'),
    
  query('minPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Minimum price must be a non-negative number'),
    
  query('maxPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Maximum price must be a non-negative number'),
    
  query('minPoints')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Minimum points must be a non-negative integer'),
    
  query('maxPoints')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Maximum points must be a non-negative integer'),
    
  query('featured')
    .optional()
    .isBoolean()
    .withMessage('Featured must be a boolean value'),
    
  query('search')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search query must be between 1 and 100 characters'),
    
  handleValidationErrors
];

// Validation rules for point redemption request
const validateRedemptionRequest = [
  body('pointsToRedeem')
    .isInt({ min: 1 })
    .withMessage('Points to redeem must be a positive integer'),
    
  body('redemptionType')
    .trim()
    .notEmpty()
    .withMessage('Redemption type is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Redemption type must be between 2 and 50 characters'),
    
  body('redemptionValue')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Redemption value must be a non-negative number'),
    
  body('redemptionDetails')
    .optional()
    .isObject()
    .withMessage('Redemption details must be an object'),
    
  sanitizeInputs(['redemptionType']),
  handleValidationErrors
];

// Validation rules for manual point award (Admin only)
const validateManualPointAward = [
  body('userId')
    .isInt({ min: 1 })
    .withMessage('User ID must be a positive integer'),
    
  body('activityCode')
    .trim()
    .notEmpty()
    .withMessage('Activity code is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Activity code must be between 2 and 50 characters'),
    
  body('customAmount')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Custom amount must be a positive integer'),
    
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters'),
    
  body('referenceId')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Reference ID must not exceed 100 characters'),
    
  body('referenceType')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Reference type must not exceed 50 characters'),
    
  sanitizeInputs(['activityCode', 'description', 'referenceId', 'referenceType']),
  handleValidationErrors
];

// Validation rules for redemption processing (Admin only)
const validateRedemptionProcessing = [
  body('action')
    .isIn(['approve', 'reject'])
    .withMessage('Action must be either "approve" or "reject"'),
    
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes must not exceed 1000 characters'),
    
  sanitizeInputs(['notes']),
  handleValidationErrors
];

// Validation rules for transaction filtering
const validateTransactionFilter = [
  query('userId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('User ID must be a positive integer'),
    
  query('activityType')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Activity type must be between 1 and 50 characters'),
    
  query('transactionType')
    .optional()
    .isIn(['credit', 'debit'])
    .withMessage('Transaction type must be either "credit" or "debit"'),
    
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
    
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),
    
  handleValidationErrors
];

module.exports = {
  validateSignup,
  validateLogin,
  validatePasswordChange,
  validateProfileUpdate,
  validateAdminUserUpdate,
  validateRefreshToken,
  validatePagination,
  validateIdParam,
  validateCategoryCreate,
  validateCategoryUpdate,
  validateProductCreate,
  validateProductUpdate,
  validateProductFilter,
  validateRedemptionRequest,
  validateManualPointAward,
  validateRedemptionProcessing,
  validateTransactionFilter,
  handleValidationErrors,
  sanitizeInputs,
  customValidators
};