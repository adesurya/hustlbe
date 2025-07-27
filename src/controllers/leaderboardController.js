const leaderboardService = require('../services/leaderboardService');
const { 
  successResponse, 
  errorResponse, 
  asyncHandler,
  HTTP_STATUS,
  SUCCESS_CODES,
  ERROR_CODES 
} = require('../utils/response');

class LeaderboardController {
  /**
   * Get daily leaderboard (top 10)
   * @route GET /api/v1/leaderboard/daily
   * @access Public/Private
   */
  getDailyLeaderboard = asyncHandler(async (req, res) => {
    try {
      const { date } = req.query;
      const targetDate = date ? new Date(date) : new Date();

      const leaderboard = await leaderboardService.getDailyLeaderboard(targetDate);

      res.status(HTTP_STATUS.OK.code).json(
        successResponse(
          'Daily leaderboard retrieved successfully',
          leaderboard
        )
      );
    } catch (error) {
      console.error('Error getting daily leaderboard:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR.code).json(
        errorResponse('Failed to retrieve daily leaderboard', ERROR_CODES.INTERNAL_ERROR)
      );
    }
  });

  /**
   * Get monthly leaderboard (top 10)
   * @route GET /api/v1/leaderboard/monthly
   * @access Public/Private
   */
  getMonthlyLeaderboard = asyncHandler(async (req, res) => {
    try {
      const { year, month } = req.query;
      const targetDate = new Date();
      
      if (year && month) {
        targetDate.setFullYear(parseInt(year));
        targetDate.setMonth(parseInt(month) - 1); // month is 0-indexed
      }

      const leaderboard = await leaderboardService.getMonthlyLeaderboard(
        targetDate.getFullYear(),
        targetDate.getMonth() + 1
      );

      res.status(HTTP_STATUS.OK.code).json(
        successResponse(
          'Monthly leaderboard retrieved successfully',
          leaderboard
        )
      );
    } catch (error) {
      console.error('Error getting monthly leaderboard:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR.code).json(
        errorResponse('Failed to retrieve monthly leaderboard', ERROR_CODES.INTERNAL_ERROR)
      );
    }
  });

  /**
   * Get all-time leaderboard (top 10)
   * @route GET /api/v1/leaderboard/all-time
   * @access Public/Private
   */
  getAllTimeLeaderboard = asyncHandler(async (req, res) => {
    try {
      const leaderboard = await leaderboardService.getAllTimeLeaderboard();

      res.status(HTTP_STATUS.OK.code).json(
        successResponse(
          'All-time leaderboard retrieved successfully',
          leaderboard
        )
      );
    } catch (error) {
      console.error('Error getting all-time leaderboard:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR.code).json(
        errorResponse('Failed to retrieve all-time leaderboard', ERROR_CODES.INTERNAL_ERROR)
      );
    }
  });

  /**
   * Get user's ranking in daily leaderboard
   * @route GET /api/v1/leaderboard/my-rank/daily
   * @access Private
   */
  getMyDailyRank = asyncHandler(async (req, res) => {
    try {
      const userId = req.user.id;
      const { date } = req.query;
      const targetDate = date ? new Date(date) : new Date();

      const ranking = await leaderboardService.getUserDailyRanking(userId, targetDate);

      res.status(HTTP_STATUS.OK.code).json(
        successResponse(
          'User daily ranking retrieved successfully',
          ranking
        )
      );
    } catch (error) {
      console.error('Error getting user daily ranking:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR.code).json(
        errorResponse('Failed to retrieve user daily ranking', ERROR_CODES.INTERNAL_ERROR)
      );
    }
  });

  /**
   * Get user's ranking in monthly leaderboard
   * @route GET /api/v1/leaderboard/my-rank/monthly
   * @access Private
   */
  getMyMonthlyRank = asyncHandler(async (req, res) => {
    try {
      const userId = req.user.id;
      const { year, month } = req.query;
      const targetDate = new Date();
      
      if (year && month) {
        targetDate.setFullYear(parseInt(year));
        targetDate.setMonth(parseInt(month) - 1);
      }

      const ranking = await leaderboardService.getUserMonthlyRanking(
        userId,
        targetDate.getFullYear(),
        targetDate.getMonth() + 1
      );

      res.status(HTTP_STATUS.OK.code).json(
        successResponse(
          'User monthly ranking retrieved successfully',
          ranking
        )
      );
    } catch (error) {
      console.error('Error getting user monthly ranking:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR.code).json(
        errorResponse('Failed to retrieve user monthly ranking', ERROR_CODES.INTERNAL_ERROR)
      );
    }
  });

  /**
   * Get user's ranking in all-time leaderboard
   * @route GET /api/v1/leaderboard/my-rank/all-time
   * @access Private
   */
  getMyAllTimeRank = asyncHandler(async (req, res) => {
    try {
      const userId = req.user.id;
      const ranking = await leaderboardService.getUserAllTimeRanking(userId);

      res.status(HTTP_STATUS.OK.code).json(
        successResponse(
          'User all-time ranking retrieved successfully',
          ranking
        )
      );
    } catch (error) {
      console.error('Error getting user all-time ranking:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR.code).json(
        errorResponse('Failed to retrieve user all-time ranking', ERROR_CODES.INTERNAL_ERROR)
      );
    }
  });

  /**
   * Get comprehensive leaderboard data
   * @route GET /api/v1/leaderboard/comprehensive
   * @access Private
   */
  getComprehensiveLeaderboard = asyncHandler(async (req, res) => {
    try {
      const userId = req.user.id;
      const { date, year, month } = req.query;
      
      const targetDate = date ? new Date(date) : new Date();
      const targetYear = year ? parseInt(year) : new Date().getFullYear();
      const targetMonth = month ? parseInt(month) : new Date().getMonth() + 1;

      const comprehensive = await leaderboardService.getComprehensiveLeaderboard(
        userId,
        targetDate,
        targetYear,
        targetMonth
      );

      res.status(HTTP_STATUS.OK.code).json(
        successResponse(
          'Comprehensive leaderboard retrieved successfully',
          comprehensive
        )
      );
    } catch (error) {
      console.error('Error getting comprehensive leaderboard:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR.code).json(
        errorResponse('Failed to retrieve comprehensive leaderboard', ERROR_CODES.INTERNAL_ERROR)
      );
    }
  });

  /**
   * Get leaderboard statistics
   * @route GET /api/v1/leaderboard/statistics
   * @access Private (Admin only)
   */
  getLeaderboardStatistics = asyncHandler(async (req, res) => {
    try {
      const statistics = await leaderboardService.getLeaderboardStatistics();

      res.status(HTTP_STATUS.OK.code).json(
        successResponse(
          'Leaderboard statistics retrieved successfully',
          statistics
        )
      );
    } catch (error) {
      console.error('Error getting leaderboard statistics:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR.code).json(
        errorResponse('Failed to retrieve leaderboard statistics', ERROR_CODES.INTERNAL_ERROR)
      );
    }
  });
}

module.exports = new LeaderboardController();