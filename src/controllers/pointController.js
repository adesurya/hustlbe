const pointService = require('../services/pointService');
const { PointRedemption } = require('../models');
const { 
  successResponse, 
  errorResponse, 
  asyncHandler,
  HTTP_STATUS,
  SUCCESS_CODES,
  ERROR_CODES,
  createPaginationMeta
} = require('../utils/response');

class PointController {
  /**
   * Get user's current points balance and summary
   */
  getMyPoints = asyncHandler(async (req, res) => {
    const userId = req.user.id;

    try {
      const pointsSummary = await pointService.getUserPointsSummary(userId);

      res.status(HTTP_STATUS.OK.code).json(
        successResponse(
          'Points summary retrieved successfully',
          pointsSummary
        )
      );
    } catch (error) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR.code).json(
        errorResponse(error.message, ERROR_CODES.INTERNAL_ERROR)
      );
    }
  });

  /**
   * Get user's point transaction history
   */
  getMyTransactionHistory = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const {
      page = 1,
      limit = 20,
      activityType,
      transactionType,
      startDate,
      endDate
    } = req.query;

    try {
      const result = await pointService.getUserTransactionHistory(userId, {
        page: parseInt(page),
        limit: parseInt(limit),
        activityType,
        transactionType,
        startDate,
        endDate
      });

      res.status(HTTP_STATUS.OK.code).json(
        successResponse(
          'Transaction history retrieved successfully',
          result.transactions,
          createPaginationMeta(
            result.pagination.currentPage,
            result.pagination.itemsPerPage,
            result.pagination.totalItems,
            result.pagination.totalPages
          )
        )
      );
    } catch (error) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR.code).json(
        errorResponse(error.message, ERROR_CODES.INTERNAL_ERROR)
      );
    }
  });

  /**
   * Request point redemption
   */
  requestRedemption = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const {
      pointsToRedeem,
      redemptionType,
      redemptionValue,
      redemptionDetails
    } = req.body;

    try {
      const redemption = await pointService.requestRedemption(userId, {
        pointsToRedeem: parseInt(pointsToRedeem),
        redemptionType,
        redemptionValue: redemptionValue ? parseFloat(redemptionValue) : null,
        redemptionDetails
      });

      res.status(HTTP_STATUS.CREATED.code).json(
        successResponse(
          'Redemption request submitted successfully',
          redemption,
          null,
          SUCCESS_CODES.RESOURCE_CREATED
        )
      );
    } catch (error) {
      if (error.message.includes('Insufficient points')) {
        return res.status(HTTP_STATUS.BAD_REQUEST.code).json(
          errorResponse(error.message, ERROR_CODES.INSUFFICIENT_BALANCE)
        );
      }

      res.status(HTTP_STATUS.BAD_REQUEST.code).json(
        errorResponse(error.message, ERROR_CODES.VALIDATION_ERROR)
      );
    }
  });

  /**
   * Get user's redemption history
   */
  getMyRedemptions = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const {
      page = 1,
      limit = 20,
      status,
      redemptionType
    } = req.query;

    try {
      const result = await PointRedemption.getUserRedemptions(userId, {
        page: parseInt(page),
        limit: parseInt(limit),
        status,
        redemptionType
      });

      res.status(HTTP_STATUS.OK.code).json(
        successResponse(
          'Redemption history retrieved successfully',
          result.rows,
          createPaginationMeta(
            parseInt(page),
            parseInt(limit),
            result.count,
            Math.ceil(result.count / parseInt(limit))
          )
        )
      );
    } catch (error) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR.code).json(
        errorResponse(error.message, ERROR_CODES.INTERNAL_ERROR)
      );
    }
  });

  /**
   * Get available point activities
   */
  getAvailableActivities = asyncHandler(async (req, res) => {
    try {
      const activities = await pointService.getAvailableActivities();

      res.status(HTTP_STATUS.OK.code).json(
        successResponse('Available activities retrieved successfully', activities)
      );
    } catch (error) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR.code).json(
        errorResponse(error.message, ERROR_CODES.INTERNAL_ERROR)
      );
    }
  });

  // Admin-only endpoints

  /**
   * Get all users' point transactions (Admin only)
   */
  getAllTransactions = asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 20,
      userId,
      activityType,
      transactionType,
      startDate,
      endDate
    } = req.query;

    try {
      // If userId is specified, get that user's history, otherwise get all
      const result = userId 
        ? await pointService.getUserTransactionHistory(parseInt(userId), {
            page: parseInt(page),
            limit: parseInt(limit),
            activityType,
            transactionType,
            startDate,
            endDate
          })
        : await pointService.getUserTransactionHistory(null, {
            page: parseInt(page),
            limit: parseInt(limit),
            activityType,
            transactionType,
            startDate,
            endDate
          });

      res.status(HTTP_STATUS.OK.code).json(
        successResponse(
          'All transactions retrieved successfully',
          result.transactions,
          createPaginationMeta(
            result.pagination.currentPage,
            result.pagination.itemsPerPage,
            result.pagination.totalItems,
            result.pagination.totalPages
          )
        )
      );
    } catch (error) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR.code).json(
        errorResponse(error.message, ERROR_CODES.INTERNAL_ERROR)
      );
    }
  });

  /**
   * Get all redemption requests (Admin only)
   */
  getAllRedemptions = asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 20,
      status,
      redemptionType,
      userId
    } = req.query;

    try {
      const result = await PointRedemption.getAllRedemptions({
        page: parseInt(page),
        limit: parseInt(limit),
        status,
        redemptionType,
        userId: userId ? parseInt(userId) : undefined
      });

      res.status(HTTP_STATUS.OK.code).json(
        successResponse(
          'All redemptions retrieved successfully',
          result.rows,
          createPaginationMeta(
            parseInt(page),
            parseInt(limit),
            result.count,
            Math.ceil(result.count / parseInt(limit))
          )
        )
      );
    } catch (error) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR.code).json(
        errorResponse(error.message, ERROR_CODES.INTERNAL_ERROR)
      );
    }
  });

  /**
   * Process redemption request (Admin only)
   */
  processRedemption = asyncHandler(async (req, res) => {
    const { redemptionId } = req.params;
    const { action, notes } = req.body;
    const adminId = req.user.id;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(HTTP_STATUS.BAD_REQUEST.code).json(
        errorResponse('Action must be "approve" or "reject"', ERROR_CODES.VALIDATION_ERROR)
      );
    }

    try {
      const processedRedemption = await pointService.processRedemption(
        parseInt(redemptionId),
        action,
        adminId,
        notes
      );

      res.status(HTTP_STATUS.OK.code).json(
        successResponse(
          `Redemption ${action}d successfully`,
          processedRedemption,
          null,
          SUCCESS_CODES.RESOURCE_UPDATED
        )
      );
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(HTTP_STATUS.NOT_FOUND.code).json(
          errorResponse(error.message, ERROR_CODES.RESOURCE_NOT_FOUND)
        );
      }

      if (error.message.includes('Insufficient points')) {
        return res.status(HTTP_STATUS.BAD_REQUEST.code).json(
          errorResponse(error.message, ERROR_CODES.INSUFFICIENT_BALANCE)
        );
      }

      res.status(HTTP_STATUS.BAD_REQUEST.code).json(
        errorResponse(error.message, ERROR_CODES.VALIDATION_ERROR)
      );
    }
  });

  /**
   * Get system point statistics (Admin only)
   */
  getSystemStatistics = asyncHandler(async (req, res) => {
    try {
      const statistics = await pointService.getSystemStatistics();

      res.status(HTTP_STATUS.OK.code).json(
        successResponse('System statistics retrieved successfully', statistics)
      );
    } catch (error) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR.code).json(
        errorResponse(error.message, ERROR_CODES.INTERNAL_ERROR)
      );
    }
  });

  /**
   * Award points manually (Admin only)
   */
  awardPointsManually = asyncHandler(async (req, res) => {
    const {
      userId,
      activityCode,
      customAmount,
      description,
      referenceId,
      referenceType
    } = req.body;

    try {
      const result = await pointService.awardPoints(parseInt(userId), activityCode, {
        customAmount: customAmount ? parseInt(customAmount) : null,
        description,
        referenceId,
        referenceType,
        metadata: {
          awardedBy: req.user.id,
          manualAward: true
        }
      });

      res.status(HTTP_STATUS.OK.code).json(
        successResponse(
          'Points awarded successfully',
          {
            transaction: result.transaction.toSafeJSON(),
            newBalance: result.newBalance,
            pointsAwarded: result.pointsAwarded
          },
          null,
          SUCCESS_CODES.POINTS_AWARDED
        )
      );
    } catch (error) {
      if (error.message.includes('User not found')) {
        return res.status(HTTP_STATUS.NOT_FOUND.code).json(
          errorResponse(error.message, ERROR_CODES.RESOURCE_NOT_FOUND)
        );
      }

      res.status(HTTP_STATUS.BAD_REQUEST.code).json(
        errorResponse(error.message, ERROR_CODES.VALIDATION_ERROR)
      );
    }
  });
}

module.exports = new PointController();