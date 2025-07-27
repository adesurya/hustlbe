const express = require('express');
const { Op } = require('sequelize');
const { 
  successResponse, 
  errorResponse, 
  asyncHandler,
  HTTP_STATUS,
  SUCCESS_CODES,
  ERROR_CODES 
} = require('../utils/response');
const { logSecurityEvent } = require('../utils/logger');
const { 
  authenticateToken, 
  authorizeRoles 
} = require('../middleware/auth');
const { param, body, validationResult } = require('express-validator');

// Import rate limiters with fallback
let authLimiter, adminLimiter;
try {
  const security = require('../config/security');
  authLimiter = security.authLimiter || ((req, res, next) => next());
  adminLimiter = security.adminLimiter || ((req, res, next) => next());
} catch (error) {
  console.warn('⚠️ Security config not found, using no-op limiters');
  authLimiter = (req, res, next) => next();
  adminLimiter = (req, res, next) => next();
}

const router = express.Router();

// Handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.path,
      message: error.msg,
      value: error.value
    }));

    return res.status(HTTP_STATUS.BAD_REQUEST.code).json(
      errorResponse(
        'Validation failed',
        ERROR_CODES.VALIDATION_ERROR,
        { errors: errorMessages }
      )
    );
  }
  next();
};

// Validate user ID parameter
const validateUserId = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('User ID must be a positive integer'),
  handleValidationErrors
];

// Validate password reset
const validatePasswordReset = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('User ID must be a positive integer'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters'),
  handleValidationErrors
];

// Apply rate limiting to all user management routes
router.use(authLimiter);

// Import User model with error handling
let User;
try {
  User = require('../models/User');
} catch (error) {
  console.error('⚠️ User model not found. Make sure models/User.js exists.');
}

// Direct controller methods to avoid import issues
const userControllerMethods = {
  // Get all users
  getAllUsers: asyncHandler(async (req, res) => {
    if (!User) {
      return res.status(500).json(errorResponse('User model not available', ERROR_CODES.INTERNAL_ERROR));
    }

    const { 
      page = 1, 
      limit = 20, 
      search = '', 
      role = '',
      status = '',
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const whereClause = {};

    if (search) {
      whereClause[Op.or] = [
        { username: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } }
      ];
    }

    if (role && ['admin', 'user'].includes(role)) {
      whereClause.role = role;
    }

    if (status) {
      if (status === 'active') whereClause.isActive = true;
      else if (status === 'inactive') whereClause.isActive = false;
      else if (status === 'verified') whereClause.isVerified = true;
      else if (status === 'unverified') whereClause.isVerified = false;
    }

    try {
      const { count, rows: users } = await User.findAndCountAll({
        where: whereClause,
        attributes: { exclude: ['passwordHash', 'refreshTokenHash', 'twoFactorSecret', 'emailVerificationToken'] },
        order: [[sortBy, sortOrder.toUpperCase()]],
        limit: parseInt(limit),
        offset,
        paranoid: false
      });

      const totalPages = Math.ceil(count / parseInt(limit));

      res.status(HTTP_STATUS.OK.code).json(
        successResponse(
          'Users retrieved successfully',
          {
            users: users.map(user => ({
              ...user.toJSON(),
              isLocked: user.isLocked ? user.isLocked() : false,
              canEarnPoints: user.canEarnPoints ? user.canEarnPoints() : false,
              accountAge: Math.floor((new Date() - user.createdAt) / (1000 * 60 * 60 * 24))
            })),
            pagination: {
              currentPage: parseInt(page),
              totalPages,
              totalUsers: count,
              hasNext: parseInt(page) < totalPages,
              hasPrev: parseInt(page) > 1
            }
          }
        )
      );
    } catch (error) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR.code).json(
        errorResponse('Failed to retrieve users', ERROR_CODES.INTERNAL_ERROR)
      );
    }
  }),

  // Get user statistics
  getUserStatistics: asyncHandler(async (req, res) => {
    try {
      const { sequelize } = require('../config/database');
      
      // Use raw queries to avoid field mapping issues
      const queries = [
        'SELECT COUNT(*) as count FROM users WHERE deleted_at IS NULL',
        'SELECT COUNT(*) as count FROM users WHERE deleted_at IS NULL AND is_active = true',
        'SELECT COUNT(*) as count FROM users WHERE deleted_at IS NULL AND is_verified = true',
        'SELECT COUNT(*) as count FROM users WHERE deleted_at IS NULL AND role = "admin"',
        'SELECT COUNT(*) as count FROM users WHERE deleted_at IS NULL AND locked_until > NOW()',
        `SELECT COUNT(*) as count FROM users 
         WHERE deleted_at IS NULL 
         AND created_at >= DATE_FORMAT(NOW(), '%Y-%m-01')`,
        'SELECT COUNT(*) as count FROM users WHERE deleted_at IS NOT NULL',
        'SELECT COUNT(*) as count FROM users WHERE deleted_at IS NULL AND is_active = false'
      ];

      const results = await Promise.all(
        queries.map(query => 
          sequelize.query(query, { type: sequelize.QueryTypes.SELECT })
            .then(result => result[0].count)
        )
      );

      const statistics = {
        totalUsers: results[0],
        activeUsers: results[1],
        verifiedUsers: results[2],
        adminUsers: results[3],
        lockedUsers: results[4],
        newUsersThisMonth: results[5],
        deletedUsers: results[6],
        bannedUsers: results[7],
        inactiveUsers: results[0] - results[1],
        unverifiedUsers: results[0] - results[2],
        regularUsers: results[0] - results[3]
      };

      res.status(HTTP_STATUS.OK.code).json(
        successResponse('User statistics retrieved successfully', { statistics })
      );
    } catch (error) {
      console.error('getUserStatistics error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR.code).json(
        errorResponse('Failed to retrieve statistics', ERROR_CODES.INTERNAL_ERROR)
      );
    }
  }),

  // Get banned users - FIXED WITH PURE RAW QUERY
  getBannedUsers: asyncHandler(async (req, res) => {
    const { 
      page = 1, 
      limit = 20, 
      search = '',
      sortBy = 'updated_at',
      sortOrder = 'DESC'
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    try {
      const { sequelize } = require('../config/database');
      
      // Build WHERE clause for search
      let searchClause = '';
      let replacements = { isActive: false, limit: parseInt(limit), offset: offset };
      
      if (search) {
        searchClause = 'AND (username LIKE :search OR email LIKE :search)';
        replacements.search = `%${search}%`;
      }

      // Validate sort parameters
      const validSortColumns = ['id', 'username', 'email', 'created_at', 'updated_at', 'is_active'];
      const safeSortBy = validSortColumns.includes(sortBy) ? sortBy : 'updated_at';
      const safeSortOrder = ['ASC', 'DESC'].includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';

      // Count query
      const countQuery = `
        SELECT COUNT(*) as total 
        FROM users 
        WHERE deleted_at IS NULL 
        AND is_active = :isActive
        ${searchClause}
      `;

      // Data query
      const dataQuery = `
        SELECT 
          id, 
          username, 
          email, 
          phone_number as phoneNumber,
          role,
          google_id as googleId,
          profile_picture as profilePicture,
          is_verified as isVerified,
          is_active as isActive,
          login_attempts as loginAttempts,
          locked_until as lockedUntil,
          last_login as lastLogin,
          password_changed_at as passwordChangedAt,
          email_verified_at as emailVerifiedAt,
          two_factor_enabled as twoFactorEnabled,
          current_points as currentPoints,
          created_at as createdAt,
          updated_at as updatedAt
        FROM users 
        WHERE deleted_at IS NULL 
        AND is_active = :isActive
        ${searchClause}
        ORDER BY ${safeSortBy} ${safeSortOrder}
        LIMIT :limit OFFSET :offset
      `;

      // Execute queries
      const [countResult] = await sequelize.query(countQuery, {
        replacements,
        type: sequelize.QueryTypes.SELECT
      });

      const users = await sequelize.query(dataQuery, {
        replacements,
        type: sequelize.QueryTypes.SELECT
      });

      const totalBannedUsers = countResult.total;
      const totalPages = Math.ceil(totalBannedUsers / parseInt(limit));

      logSecurityEvent('admin_banned_users_list_accessed', {
        adminId: req.user.id,
        filters: { search, sortBy: safeSortBy, sortOrder: safeSortOrder },
        resultCount: users.length
      });

      res.status(HTTP_STATUS.OK.code).json(
        successResponse(
          'Banned users retrieved successfully',
          {
            bannedUsers: users.map(user => ({
              ...user,
              accountAge: Math.floor((new Date() - new Date(user.createdAt)) / (1000 * 60 * 60 * 24)),
              bannedDuration: Math.floor((new Date() - new Date(user.updatedAt)) / (1000 * 60 * 60 * 24)),
              createdAt: new Date(user.createdAt),
              updatedAt: new Date(user.updatedAt),
              lastLogin: user.lastLogin ? new Date(user.lastLogin) : null,
              lockedUntil: user.lockedUntil ? new Date(user.lockedUntil) : null,
              passwordChangedAt: user.passwordChangedAt ? new Date(user.passwordChangedAt) : null,
              emailVerifiedAt: user.emailVerifiedAt ? new Date(user.emailVerifiedAt) : null
            })),
            pagination: {
              currentPage: parseInt(page),
              totalPages,
              totalBannedUsers,
              hasNext: parseInt(page) < totalPages,
              hasPrev: parseInt(page) > 1
            },
            supportContact: 'support@sijago.ai'
          }
        )
      );
    } catch (error) {
      console.error('getBannedUsers error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR.code).json(
        errorResponse('Failed to retrieve banned users', ERROR_CODES.INTERNAL_ERROR)
      );
    }
  }),

  // Get user ban status - FIXED WITH PURE RAW QUERY  
  getUserBanStatus: asyncHandler(async (req, res) => {
    const { id } = req.params;

    try {
      const { sequelize } = require('../config/database');
      
      // Pure raw query to avoid any Sequelize field mapping
      const query = `
        SELECT 
          id, 
          username, 
          email, 
          is_active as isActive, 
          created_at as createdAt,
          updated_at as updatedAt
        FROM users 
        WHERE deleted_at IS NULL 
        AND id = ?
      `;

      const [user] = await sequelize.query(query, {
        replacements: [id],
        type: sequelize.QueryTypes.SELECT
      });

      if (!user) {
        return res.status(HTTP_STATUS.NOT_FOUND.code).json(
          errorResponse('User not found', ERROR_CODES.RESOURCE_NOT_FOUND)
        );
      }

      const banStatus = {
        userId: user.id,
        username: user.username,
        email: user.email,
        isBanned: !user.isActive,
        isActive: user.isActive,
        accountCreated: new Date(user.createdAt),
        lastStatusChange: new Date(user.updatedAt),
        supportContact: 'support@sijago.ai'
      };

      if (!user.isActive) {
        banStatus.bannedDuration = Math.floor((new Date() - new Date(user.updatedAt)) / (1000 * 60 * 60 * 24));
        banStatus.message = 'Account is currently banned. For more information about your account status, please contact: support@sijago.ai';
      }

      res.status(HTTP_STATUS.OK.code).json(
        successResponse(
          'User ban status retrieved successfully',
          { banStatus }
        )
      );
    } catch (error) {
      console.error('getUserBanStatus error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR.code).json(
        errorResponse('Failed to retrieve ban status', ERROR_CODES.INTERNAL_ERROR)
      );
    }
  }),

  // Ban user
  banUser: asyncHandler(async (req, res) => {
    if (!User) {
      return res.status(500).json(errorResponse('User model not available', ERROR_CODES.INTERNAL_ERROR));
    }

    const { id } = req.params;
    const { reason = 'Account banned by administrator', notifyUser = true } = req.body;

    try {
      const user = await User.findByPk(id);

      if (!user) {
        return res.status(HTTP_STATUS.NOT_FOUND.code).json(
          errorResponse('User not found', ERROR_CODES.RESOURCE_NOT_FOUND)
        );
      }

      if (parseInt(id) === req.user.id) {
        return res.status(HTTP_STATUS.BAD_REQUEST.code).json(
          errorResponse('You cannot ban your own account', ERROR_CODES.INVALID_OPERATION)
        );
      }

      if (!user.isActive) {
        return res.status(HTTP_STATUS.BAD_REQUEST.code).json(
          errorResponse('User is already banned', ERROR_CODES.INVALID_OPERATION)
        );
      }

      await user.update({ 
        isActive: false,
        lockedUntil: null,
        loginAttempts: 0
      });

      // Invalidate tokens if method exists
      if (user.invalidateAllTokens) {
        await user.invalidateAllTokens('account_banned');
      }

      // Send notification email if requested
      if (notifyUser) {
        try {
          const emailService = require('../services/emailService');
          await emailService.sendAccountBannedNotification(user, reason);
        } catch (emailError) {
          console.error('Failed to send ban notification email:', emailError);
        }
      }

      logSecurityEvent('admin_user_banned', {
        adminId: req.user.id,
        bannedUserId: user.id,
        bannedUserEmail: user.email,
        reason: reason,
        notificationSent: notifyUser
      });

      res.status(HTTP_STATUS.OK.code).json(
        successResponse('User has been banned successfully', {
          user: user.toSafeJSON ? user.toSafeJSON() : user.toJSON(),
          bannedAt: new Date(),
          reason: reason,
          notificationSent: notifyUser,
          supportContact: 'support@sijago.ai'
        })
      );
    } catch (error) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR.code).json(
        errorResponse('Failed to ban user', ERROR_CODES.INTERNAL_ERROR)
      );
    }
  }),

  // Unban user
  unbanUser: asyncHandler(async (req, res) => {
    if (!User) {
      return res.status(500).json(errorResponse('User model not available', ERROR_CODES.INTERNAL_ERROR));
    }

    const { id } = req.params;
    const { reason = 'Account reactivated by administrator', notifyUser = true } = req.body;

    try {
      const user = await User.findByPk(id);

      if (!user) {
        return res.status(HTTP_STATUS.NOT_FOUND.code).json(
          errorResponse('User not found', ERROR_CODES.RESOURCE_NOT_FOUND)
        );
      }

      if (user.isActive) {
        return res.status(HTTP_STATUS.BAD_REQUEST.code).json(
          errorResponse('User is not banned', ERROR_CODES.INVALID_OPERATION)
        );
      }

      await user.update({
        isActive: true,
        loginAttempts: 0,
        lockedUntil: null
      });

      // Send notification email if requested
      if (notifyUser) {
        try {
          const emailService = require('../services/emailService');
          await emailService.sendAccountReactivatedNotification(user, reason);
        } catch (emailError) {
          console.error('Failed to send reactivation notification email:', emailError);
        }
      }

      logSecurityEvent('admin_user_unbanned', {
        adminId: req.user.id,
        unbannedUserId: user.id,
        unbannedUserEmail: user.email,
        reason: reason,
        notificationSent: notifyUser
      });

      res.status(HTTP_STATUS.OK.code).json(
        successResponse('User has been unbanned successfully', {
          user: user.toSafeJSON ? user.toSafeJSON() : user.toJSON(),
          unbannedAt: new Date(),
          reason: reason,
          notificationSent: notifyUser
        })
      );
    } catch (error) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR.code).json(
        errorResponse('Failed to unban user', ERROR_CODES.INTERNAL_ERROR)
      );
    }
  })
};

// Validation middleware for user creation
const validateCreateUser = [
  body('username')
    .isLength({ min: 3, max: 50 })
    .withMessage('Username must be between 3 and 50 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters'),
  handleValidationErrors
];

/**
 * @route   GET /api/v1/users/banned
 * @desc    Get banned users list (Admin only)
 * @access  Private (Admin)
 */
router.get('/banned', 
  adminLimiter,
  authenticateToken, 
  authorizeRoles('admin'), 
  userControllerMethods.getBannedUsers
);

/**
 * @route   GET /api/v1/users/statistics
 * @desc    Get user statistics (Admin only)
 * @access  Private (Admin)
 */
router.get('/statistics', 
  adminLimiter,
  authenticateToken, 
  authorizeRoles('admin'), 
  userControllerMethods.getUserStatistics
);

/**
 * @route   GET /api/v1/users/:id/ban-status
 * @desc    Check ban status for a user (Admin only)
 * @access  Private (Admin)
 */
router.get('/:id/ban-status', 
  adminLimiter,
  authenticateToken, 
  authorizeRoles('admin'),
  validateUserId,
  userControllerMethods.getUserBanStatus
);

/**
 * @route   GET /api/v1/users
 * @desc    Get all users with pagination and filtering (Admin only)
 * @access  Private (Admin)
 */
router.get('/', 
  adminLimiter,
  authenticateToken, 
  authorizeRoles('admin'), 
  userControllerMethods.getAllUsers
);

/**
 * @route   PATCH /api/v1/users/:id/ban
 * @desc    Ban user (deactivate account) (Admin only)
 * @access  Private (Admin)
 */
router.patch('/:id/ban', 
  adminLimiter,
  authenticateToken, 
  authorizeRoles('admin'),
  validateUserId,
  userControllerMethods.banUser
);

/**
 * @route   PATCH /api/v1/users/:id/unban
 * @desc    Unban user (reactivate account) (Admin only)
 * @access  Private (Admin)
 */
router.patch('/:id/unban', 
  adminLimiter,
  authenticateToken, 
  authorizeRoles('admin'),
  validateUserId,
  userControllerMethods.unbanUser
);

module.exports = router;