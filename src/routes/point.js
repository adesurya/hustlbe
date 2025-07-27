const express = require('express');
const pointController = require('../controllers/pointController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const {
  validateRedemptionRequest,
  validateManualPointAward,
  validateRedemptionProcessing,
  validateTransactionFilter,
  validatePagination,
  validateRedemptionIdParam,
  validateUserIdParam
} = require('../middleware/validation');
const { generalLimiter } = require('../config/security');

const router = express.Router();

// Apply rate limiting
router.use(generalLimiter);

// All point management routes require authentication
router.use(authenticateToken);

/**
 * @route   GET /api/v1/points/my-points
 * @desc    Get user's current points balance and summary
 * @access  Private (User/Admin)
 */
router.get('/my-points', pointController.getMyPoints);

/**
 * @route   GET /api/v1/points/my-transactions
 * @desc    Get user's point transaction history
 * @access  Private (User/Admin)
 */
router.get('/my-transactions', 
  validatePagination,
  validateTransactionFilter,
  pointController.getMyTransactionHistory
);

/**
 * @route   POST /api/v1/points/redeem
 * @desc    Request point redemption
 * @access  Private (User/Admin)
 */
router.post('/redeem',
  validateRedemptionRequest,
  pointController.requestRedemption
);

/**
 * @route   GET /api/v1/points/my-redemptions
 * @desc    Get user's redemption history
 * @access  Private (User/Admin)
 */
router.get('/my-redemptions',
  validatePagination,
  pointController.getMyRedemptions
);

/**
 * @route   GET /api/v1/points/activities
 * @desc    Get available point activities
 * @access  Private (User/Admin)
 */
router.get('/activities', pointController.getAvailableActivities);

// Admin-only routes
/**
 * @route   GET /api/v1/points/admin/transactions
 * @desc    Get all users' point transactions
 * @access  Admin
 */
router.get('/admin/transactions',
  authorizeRoles('admin'),
  validatePagination,
  validateTransactionFilter,
  pointController.getAllTransactions
);

/**
 * @route   GET /api/v1/points/admin/redemptions
 * @desc    Get all redemption requests
 * @access  Admin
 */
router.get('/admin/redemptions',
  authorizeRoles('admin'),
  validatePagination,
  pointController.getAllRedemptions
);

/**
 * @route   PUT /api/v1/points/admin/redemptions/:redemptionId/process
 * @desc    Process redemption request (approve/reject)
 * @access  Admin
 */
router.put('/admin/redemptions/:redemptionId/process',
  authorizeRoles('admin'),
  validateRedemptionIdParam, // Use specific validator for redemptionId
  validateRedemptionProcessing,
  pointController.processRedemption
);

/**
 * @route   GET /api/v1/points/admin/statistics
 * @desc    Get system point statistics including consistency check
 * @access  Admin
 */
router.get('/admin/statistics',
  authorizeRoles('admin'),
  pointController.getSystemStatistics
);

/**
 * @route   POST /api/v1/points/admin/award
 * @desc    Award points manually to user
 * @access  Admin
 */
router.post('/admin/award',
  authorizeRoles('admin'),
  validateManualPointAward,
  pointController.awardPointsManually
);

/**
 * @route   GET /api/v1/points/admin/consistency/check
 * @desc    Check system consistency between users and transactions
 * @access  Admin
 */
router.get('/admin/consistency/check',
  authorizeRoles('admin'),
  pointController.checkSystemConsistency
);

/**
 * @route   POST /api/v1/points/admin/consistency/fix
 * @desc    Fix inconsistent point balances between users and transactions
 * @access  Admin
 */
router.post('/admin/consistency/fix',
  authorizeRoles('admin'),
  pointController.fixInconsistentBalances
);

/**
 * @route   GET /api/v1/points/admin/users/:userId/balance
 * @desc    Get detailed balance information for specific user
 * @access  Admin
 */
router.get('/admin/users/:userId/balance',
  authorizeRoles('admin'),
  validateUserIdParam, // Use specific validator for userId
  pointController.getUserBalanceDetails
);

module.exports = router;