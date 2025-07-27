const express = require('express');
const leaderboardController = require('../controllers/leaderboardController');
const { authenticateToken, authorizeRoles, optionalAuth } = require('../middleware/auth');
const {
  validateDateQuery,
  validateMonthYearQuery
} = require('../middleware/leaderboardValidation');
const {
  validatePagination
} = require('../middleware/validation');
const { generalLimiter } = require('../config/security');

const router = express.Router();

// Apply rate limiting
router.use(generalLimiter);

/**
 * @route   GET /api/v1/leaderboard/daily
 * @desc    Get daily leaderboard (top 10)
 * @access  Public (with optional auth for enhanced features)
 */
router.get('/daily', 
  optionalAuth,
  validateDateQuery,
  leaderboardController.getDailyLeaderboard
);

/**
 * @route   GET /api/v1/leaderboard/monthly
 * @desc    Get monthly leaderboard (top 10)
 * @access  Public (with optional auth for enhanced features)
 */
router.get('/monthly',
  optionalAuth,
  validateMonthYearQuery,
  leaderboardController.getMonthlyLeaderboard
);

/**
 * @route   GET /api/v1/leaderboard/all-time
 * @desc    Get all-time leaderboard (top 10)
 * @access  Public (with optional auth for enhanced features)
 */
router.get('/all-time',
  optionalAuth,
  leaderboardController.getAllTimeLeaderboard
);

// User-specific ranking endpoints (require authentication)
/**
 * @route   GET /api/v1/leaderboard/my-rank/daily
 * @desc    Get user's daily ranking
 * @access  Private
 */
router.get('/my-rank/daily',
  authenticateToken,
  validateDateQuery,
  leaderboardController.getMyDailyRank
);

/**
 * @route   GET /api/v1/leaderboard/my-rank/monthly
 * @desc    Get user's monthly ranking
 * @access  Private
 */
router.get('/my-rank/monthly',
  authenticateToken,
  validateMonthYearQuery,
  leaderboardController.getMyMonthlyRank
);

/**
 * @route   GET /api/v1/leaderboard/my-rank/all-time
 * @desc    Get user's all-time ranking
 * @access  Private
 */
router.get('/my-rank/all-time',
  authenticateToken,
  leaderboardController.getMyAllTimeRank
);

/**
 * @route   GET /api/v1/leaderboard/comprehensive
 * @desc    Get comprehensive leaderboard data (all types + user rankings)
 * @access  Private
 */
router.get('/comprehensive',
  authenticateToken,
  validateDateQuery,
  validateMonthYearQuery,
  leaderboardController.getComprehensiveLeaderboard
);

// Admin-only endpoints
/**
 * @route   GET /api/v1/leaderboard/statistics
 * @desc    Get leaderboard statistics (Admin only)
 * @access  Admin
 */
router.get('/statistics',
  authenticateToken,
  authorizeRoles('admin'),
  leaderboardController.getLeaderboardStatistics
);


module.exports = router;