const pointService = require('../services/pointService');
const PointActivity = require('../models/PointActivity');
const PointTransaction = require('../models/PointTransaction');
const PointRedemption = require('../models/PointRedemption');
const User = require('../models/User');
const { 
  successResponse, 
  errorResponse, 
  asyncHandler,
  HTTP_STATUS,
  SUCCESS_CODES,
  ERROR_CODES 
} = require('../utils/response');
const { logSecurityEvent } = require('../utils/logger');

class PointController {
  /**
   * Get user's current points and summary
   */
  getMyPoints = asyncHandler(async (req, res) => {
    try {
      const userId = req.user.id;

      // Get user's current points from user model
      const user = await User.findByPk(userId, {
        attributes: ['id', 'username', 'email', 'currentPoints']
      });

      if (!user) {
        return res.status(HTTP_STATUS.NOT_FOUND.code).json(
          errorResponse('User not found', ERROR_CODES.USER_NOT_FOUND)
        );
      }

      // Get detailed point summary from transactions
      const pointSummary = await pointService.getUserPointSummary(userId);

      // Get available activities
      const availableActivities = await pointService.getAvailableActivitiesForUser(userId);

      res.status(HTTP_STATUS.OK.code).json(
        successResponse(
          'Points retrieved successfully',
          {
            currentBalance: user.currentPoints,
            summary: pointSummary,
            availableActivities: availableActivities
          }
        )
      );
    } catch (error) {
      console.error('Error getting user points:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR.code).json(
        errorResponse('Failed to retrieve points', ERROR_CODES.INTERNAL_ERROR)
      );
    }
  });

  /**
   * Get user's point transaction history
   */
  getMyTransactionHistory = asyncHandler(async (req, res) => {
    try {
      const userId = req.user.id;
      const { 
        page = 1, 
        limit = 20, 
        transactionType, 
        activityType,
        startDate,
        endDate
      } = req.query;

      const transactions = await PointTransaction.getUserTransactions(userId, {
        page: parseInt(page),
        limit: parseInt(limit),
        transactionType,
        activityType,
        startDate,
        endDate
      });

      res.status(HTTP_STATUS.OK.code).json(
        successResponse(
          'Transaction history retrieved successfully',
          {
            transactions: transactions.rows.map(tx => tx.toSafeJSON()),
            pagination: {
              currentPage: parseInt(page),
              totalPages: Math.ceil(transactions.count / parseInt(limit)),
              totalItems: transactions.count,
              itemsPerPage: parseInt(limit)
            }
          }
        )
      );
    } catch (error) {
      console.error('Error getting transaction history:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR.code).json(
        errorResponse('Failed to retrieve transaction history', ERROR_CODES.INTERNAL_ERROR)
      );
    }
  });

  /**
   * Request point redemption
   */
  requestRedemption = asyncHandler(async (req, res) => {
    try {
      const userId = req.user.id;
      const { 
        pointsToRedeem, 
        redemptionType, 
        redemptionDetails 
      } = req.body;

      // Get user's current points
      const user = await User.findByPk(userId);
      
      if (!user) {
        return res.status(HTTP_STATUS.NOT_FOUND.code).json(
          errorResponse('User not found', ERROR_CODES.USER_NOT_FOUND)
        );
      }

      if (user.currentPoints < pointsToRedeem) {
        return res.status(HTTP_STATUS.BAD_REQUEST.code).json(
          errorResponse('Insufficient points balance', ERROR_CODES.INSUFFICIENT_BALANCE)
        );
      }

      // Calculate redemption value (example: 100 points = $1)
      const redemptionValue = pointsToRedeem / 100;

      // Create redemption request
      const redemption = await PointRedemption.create({
        userId: userId,
        pointsRedeemed: pointsToRedeem,
        redemptionType: redemptionType,
        redemptionValue: redemptionValue,
        redemptionDetails: redemptionDetails,
        status: 'pending'
      });

      logSecurityEvent('redemption_requested', {
        userId: userId,
        redemptionId: redemption.id,
        pointsRequested: pointsToRedeem,
        redemptionType: redemptionType
      });

      res.status(HTTP_STATUS.CREATED.code).json(
        successResponse(
          'Redemption request submitted successfully',
          {
            redemption: {
              id: redemption.id,
              pointsRedeemed: redemption.pointsRedeemed,
              redemptionType: redemption.redemptionType,
              redemptionValue: redemption.redemptionValue,
              status: redemption.status,
              requestedAt: redemption.requestedAt
            }
          },
          null,
          SUCCESS_CODES.REDEMPTION_REQUESTED
        )
      );
    } catch (error) {
      console.error('Error requesting redemption:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR.code).json(
        errorResponse('Failed to process redemption request', ERROR_CODES.INTERNAL_ERROR)
      );
    }
  });

  /**
   * Get user's redemption history
   */
  getMyRedemptions = asyncHandler(async (req, res) => {
    try {
      const userId = req.user.id;
      const { 
        page = 1, 
        limit = 20, 
        status,
        redemptionType
      } = req.query;

      const redemptions = await PointRedemption.getUserRedemptions(userId, {
        page: parseInt(page),
        limit: parseInt(limit),
        status,
        redemptionType
      });

      res.status(HTTP_STATUS.OK.code).json(
        successResponse(
          'Redemption history retrieved successfully',
          {
            redemptions: redemptions.rows,
            pagination: {
              currentPage: parseInt(page),
              totalPages: Math.ceil(redemptions.count / parseInt(limit)),
              totalItems: redemptions.count,
              itemsPerPage: parseInt(limit)
            }
          }
        )
      );
    } catch (error) {
      console.error('Error getting redemption history:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR.code).json(
        errorResponse('Failed to retrieve redemption history', ERROR_CODES.INTERNAL_ERROR)
      );
    }
  });

  /**
   * Get available point activities
   */
  getAvailableActivities = asyncHandler(async (req, res) => {
    try {
      const userId = req.user.id;
      const activities = await pointService.getAvailableActivitiesForUser(userId);

      res.status(HTTP_STATUS.OK.code).json(
        successResponse(
          'Available activities retrieved successfully',
          { activities }
        )
      );
    } catch (error) {
      console.error('Error getting available activities:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR.code).json(
        errorResponse('Failed to retrieve available activities', ERROR_CODES.INTERNAL_ERROR)
      );
    }
  });

  // Admin endpoints
  /**
   * Get all users' point transactions (Admin only)
   */
  getAllTransactions = asyncHandler(async (req, res) => {
    try {
      const { 
        page = 1, 
        limit = 20, 
        transactionType, 
        activityType,
        userId,
        startDate,
        endDate
      } = req.query;

      const whereClause = {};
      
      if (transactionType) whereClause.transactionType = transactionType;
      if (activityType) whereClause.activityType = activityType;
      if (userId) whereClause.userId = parseInt(userId);
      
      if (startDate || endDate) {
        whereClause.created_at = {};
        if (startDate) whereClause.created_at[PointTransaction.sequelize.Sequelize.Op.gte] = new Date(startDate);
        if (endDate) whereClause.created_at[PointTransaction.sequelize.Sequelize.Op.lte] = new Date(endDate);
      }

      const transactions = await PointTransaction.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'username', 'email']
          }
        ],
        order: [['created_at', 'DESC']],
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit)
      });

      res.status(HTTP_STATUS.OK.code).json(
        successResponse(
          'All transactions retrieved successfully',
          {
            transactions: transactions.rows,
            pagination: {
              currentPage: parseInt(page),
              totalPages: Math.ceil(transactions.count / parseInt(limit)),
              totalItems: transactions.count,
              itemsPerPage: parseInt(limit)
            }
          }
        )
      );
    } catch (error) {
      console.error('Error getting all transactions:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR.code).json(
        errorResponse('Failed to retrieve transactions', ERROR_CODES.INTERNAL_ERROR)
      );
    }
  });

  /**
   * Award points manually (Admin only)
   */
  awardPointsManually = asyncHandler(async (req, res) => {
    try {
      const adminId = req.user.id;
      const { 
        userId, 
        points, 
        reason, 
        activityCode = 'MANUAL_AWARD' 
      } = req.body;

      // Check if target user exists
      const targetUser = await User.findByPk(userId);
      if (!targetUser) {
        return res.status(HTTP_STATUS.NOT_FOUND.code).json(
          errorResponse('Target user not found', ERROR_CODES.USER_NOT_FOUND)
        );
      }

      // Award points manually
      const result = await pointService.awardPoints(userId, activityCode, {
        processedBy: adminId,
        referenceType: 'manual_award',
        metadata: {
          reason: reason,
          awardedBy: adminId,
          adminNote: `Manual award: ${reason}`
        }
      });

      if (!result.success) {
        return res.status(HTTP_STATUS.BAD_REQUEST.code).json(
          errorResponse(result.message, ERROR_CODES.POINT_AWARD_FAILED)
        );
      }

      logSecurityEvent('manual_points_awarded', {
        adminId: adminId,
        targetUserId: userId,
        pointsAwarded: points,
        reason: reason
      });

      res.status(HTTP_STATUS.OK.code).json(
        successResponse(
          'Points awarded successfully',
          {
            pointsAwarded: result.points,
            newBalance: result.newBalance,
            targetUser: {
              id: targetUser.id,
              username: targetUser.username,
              email: targetUser.email
            }
          },
          null,
          SUCCESS_CODES.POINTS_AWARDED
        )
      );
    } catch (error) {
      console.error('Error awarding points manually:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR.code).json(
        errorResponse('Failed to award points', ERROR_CODES.INTERNAL_ERROR)
      );
    }
  });

  /**
   * Get system point statistics (Admin only)
   */
  getSystemStatistics = asyncHandler(async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      // Get system statistics
      const systemStats = await PointTransaction.getSystemStatistics({
        startDate,
        endDate
      });

      // Get activity statistics
      const activityStats = await PointActivity.getActivityStatistics();

      // Get total points in system from user balances
      const totalPointsInSystem = await User.getTotalPointsInSystem();

      // Get top point users
      const topUsers = await User.getTopPointUsers(10);

      res.status(HTTP_STATUS.OK.code).json(
        successResponse(
          'System statistics retrieved successfully',
          {
            systemOverview: systemStats.overview,
            totalPointsInUserBalances: totalPointsInSystem,
            transactionsByActivity: systemStats.byActivity,
            activityStatistics: activityStats,
            topPointUsers: topUsers,
            consistencyCheck: {
              calculatedTotal: systemStats.overview.netPointsInCirculation,
              actualTotal: totalPointsInSystem,
              isConsistent: systemStats.overview.netPointsInCirculation === totalPointsInSystem
            }
          }
        )
      );
    } catch (error) {
      console.error('Error getting system statistics:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR.code).json(
        errorResponse('Failed to retrieve system statistics', ERROR_CODES.INTERNAL_ERROR)
      );
    }
  });

  /**
   * Get all redemption requests (Admin only)
   */
  getAllRedemptions = asyncHandler(async (req, res) => {
    try {
      const { 
        page = 1, 
        limit = 20, 
        status,
        redemptionType,
        userId
      } = req.query;

      const redemptions = await PointRedemption.getAllRedemptions({
        page: parseInt(page),
        limit: parseInt(limit),
        status,
        redemptionType,
        userId: userId ? parseInt(userId) : undefined
      });

      res.status(HTTP_STATUS.OK.code).json(
        successResponse(
          'All redemptions retrieved successfully',
          {
            redemptions: redemptions.rows,
            pagination: {
              currentPage: parseInt(page),
              totalPages: Math.ceil(redemptions.count / parseInt(limit)),
              totalItems: redemptions.count,
              itemsPerPage: parseInt(limit)
            }
          }
        )
      );
    } catch (error) {
      console.error('Error getting all redemptions:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR.code).json(
        errorResponse('Failed to retrieve redemptions', ERROR_CODES.INTERNAL_ERROR)
      );
    }
  });

  /**
   * Process redemption request (Admin only)
   */
  processRedemption = asyncHandler(async (req, res) => {
    try {
      const adminId = req.user.id;
      const { redemptionId } = req.params;
      const { action, adminNotes } = req.body; // action: 'approve' or 'reject'

      const redemption = await PointRedemption.findByPk(redemptionId);

      if (!redemption) {
        return res.status(HTTP_STATUS.NOT_FOUND.code).json(
          errorResponse('Redemption request not found', ERROR_CODES.REDEMPTION_NOT_FOUND)
        );
      }

      if (redemption.status !== 'pending') {
        return res.status(HTTP_STATUS.BAD_REQUEST.code).json(
          errorResponse('Only pending redemptions can be processed', ERROR_CODES.INVALID_REDEMPTION_STATUS)
        );
      }

      let result;
      if (action === 'approve') {
        result = await redemption.approve(adminId, adminNotes);
      } else if (action === 'reject') {
        result = await redemption.reject(adminId, adminNotes);
      } else {
        return res.status(HTTP_STATUS.BAD_REQUEST.code).json(
          errorResponse('Invalid action. Use "approve" or "reject"', ERROR_CODES.VALIDATION_ERROR)
        );
      }

      logSecurityEvent('redemption_processed', {
        adminId: adminId,
        redemptionId: redemptionId,
        action: action,
        userId: redemption.userId,
        pointsProcessed: redemption.pointsRedeemed
      });

      res.status(HTTP_STATUS.OK.code).json(
        successResponse(
          `Redemption ${action}d successfully`,
          { redemption: result },
          null,
          action === 'approve' ? SUCCESS_CODES.REDEMPTION_APPROVED : SUCCESS_CODES.REDEMPTION_REJECTED
        )
      );
    } catch (error) {
      console.error('Error processing redemption:', error);
      
      if (error.message.includes('insufficient points')) {
        return res.status(HTTP_STATUS.BAD_REQUEST.code).json(
          errorResponse(error.message, ERROR_CODES.INSUFFICIENT_BALANCE)
        );
      }

      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR.code).json(
        errorResponse('Failed to process redemption', ERROR_CODES.INTERNAL_ERROR)
      );
    }
  });

  /**
   * Check system consistency (Admin only)
   */
  checkSystemConsistency = asyncHandler(async (req, res) => {
    try {
      const issues = [];
      const summary = {
        totalUsersChecked: 0,
        inconsistentUsers: 0,
        totalDiscrepancy: 0
      };

      // Get all active users with their current points
      const users = await User.findAll({
        where: { isActive: true },
        attributes: ['id', 'username', 'email', 'currentPoints']
      });

      summary.totalUsersChecked = users.length;

      for (const user of users) {
        // Calculate points from transactions
        const transactionSummary = await PointTransaction.getUserPointsSummary(user.id);
        const calculatedBalance = transactionSummary.netBalance;
        const actualBalance = user.currentPoints;

        if (calculatedBalance !== actualBalance) {
          const discrepancy = actualBalance - calculatedBalance;
          summary.inconsistentUsers++;
          summary.totalDiscrepancy += Math.abs(discrepancy);

          issues.push({
            userId: user.id,
            username: user.username,
            email: user.email,
            currentBalance: actualBalance,
            calculatedBalance: calculatedBalance,
            discrepancy: discrepancy,
            transactionSummary: transactionSummary
          });
        }
      }

      res.status(HTTP_STATUS.OK.code).json(
        successResponse(
          'System consistency check completed',
          {
            summary: summary,
            issues: issues,
            isSystemConsistent: issues.length === 0
          }
        )
      );
    } catch (error) {
      console.error('Error checking system consistency:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR.code).json(
        errorResponse('Failed to check system consistency', ERROR_CODES.INTERNAL_ERROR)
      );
    }
  });

  /**
   * Fix inconsistent balances (Admin only)
   */
  fixInconsistentBalances = asyncHandler(async (req, res) => {
    try {
      const adminId = req.user.id;
      const { userIds } = req.body; // Array of user IDs to fix, or empty for all

      const fixedUsers = [];
      const errors = [];

      // Get users to fix
      let usersToFix;
      if (userIds && userIds.length > 0) {
        usersToFix = await User.findAll({
          where: { 
            id: userIds,
            isActive: true 
          }
        });
      } else {
        usersToFix = await User.findAll({
          where: { isActive: true }
        });
      }

      for (const user of usersToFix) {
        try {
          // Calculate correct balance from transactions
          const transactionSummary = await PointTransaction.getUserPointsSummary(user.id);
          const calculatedBalance = transactionSummary.netBalance;
          const currentBalance = user.currentPoints;

          if (calculatedBalance !== currentBalance) {
            const oldBalance = currentBalance;
            
            // Update user's balance to match transactions
            await user.update({ currentPoints: calculatedBalance });

            // Log the fix
            logSecurityEvent('balance_corrected', {
              adminId: adminId,
              userId: user.id,
              oldBalance: oldBalance,
              newBalance: calculatedBalance,
              discrepancy: currentBalance - calculatedBalance
            });

            fixedUsers.push({
              userId: user.id,
              username: user.username,
              email: user.email,
              oldBalance: oldBalance,
              newBalance: calculatedBalance,
              discrepancy: currentBalance - calculatedBalance
            });
          }
        } catch (userError) {
          errors.push({
            userId: user.id,
            username: user.username,
            error: userError.message
          });
        }
      }

      res.status(HTTP_STATUS.OK.code).json(
        successResponse(
          `Balance correction completed. Fixed ${fixedUsers.length} users.`,
          {
            fixedUsers: fixedUsers,
            errors: errors,
            summary: {
              totalProcessed: usersToFix.length,
              successfulFixes: fixedUsers.length,
              errors: errors.length
            }
          },
          null,
          SUCCESS_CODES.BALANCES_FIXED
        )
      );
    } catch (error) {
      console.error('Error fixing inconsistent balances:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR.code).json(
        errorResponse('Failed to fix inconsistent balances', ERROR_CODES.INTERNAL_ERROR)
      );
    }
  });

  /**
   * Get detailed balance information for specific user (Admin only)
   */
  getUserBalanceDetails = asyncHandler(async (req, res) => {
    try {
      const { userId } = req.params;

      const user = await User.findByPk(userId, {
        attributes: ['id', 'username', 'email', 'currentPoints', 'isActive', 'isVerified']
      });

      if (!user) {
        return res.status(HTTP_STATUS.NOT_FOUND.code).json(
          errorResponse('User not found', ERROR_CODES.USER_NOT_FOUND)
        );
      }

      // Get transaction summary
      const transactionSummary = await PointTransaction.getUserPointsSummary(userId);

      // Get recent transactions
      const recentTransactions = await PointTransaction.getUserTransactions(userId, {
        page: 1,
        limit: 10
      });

      // Get available activities for this user
      const availableActivities = await pointService.getAvailableActivitiesForUser(userId);

      res.status(HTTP_STATUS.OK.code).json(
        successResponse(
          'User balance details retrieved successfully',
          {
            user: user,
            currentBalance: user.currentPoints,
            transactionSummary: transactionSummary,
            recentTransactions: recentTransactions.rows.map(tx => tx.toSafeJSON()),
            availableActivities: availableActivities,
            consistencyCheck: {
              isConsistent: user.currentPoints === transactionSummary.netBalance,
              discrepancy: user.currentPoints - transactionSummary.netBalance
            }
          }
        )
      );
    } catch (error) {
      console.error('Error getting user balance details:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR.code).json(
        errorResponse('Failed to retrieve user balance details', ERROR_CODES.INTERNAL_ERROR)
      );
    }
  });

  /**
   * Award product share points
   */
  awardProductSharePoints = asyncHandler(async (req, res) => {
    try {
      const userId = req.user.id;
      const { productId } = req.body;

      const result = await pointService.awardProductSharePoints(userId, productId);

      if (!result.success) {
        return res.status(HTTP_STATUS.BAD_REQUEST.code).json(
          errorResponse(result.message, ERROR_CODES.POINT_AWARD_FAILED)
        );
      }

      res.status(HTTP_STATUS.OK.code).json(
        successResponse(
          result.message,
          {
            pointsAwarded: result.points,
            newBalance: result.newBalance,
            transaction: result.transaction
          },
          null,
          SUCCESS_CODES.POINTS_AWARDED
        )
      );
    } catch (error) {
      console.error('Error awarding product share points:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR.code).json(
        errorResponse('Failed to award share points', ERROR_CODES.INTERNAL_ERROR)
      );
    }
  });

  /**
   * Award campaign share points
   */
  awardCampaignSharePoints = asyncHandler(async (req, res) => {
    try {
      const userId = req.user.id;
      const { campaignId } = req.body;

      const result = await pointService.awardCampaignSharePoints(userId, campaignId);

      if (!result.success) {
        return res.status(HTTP_STATUS.BAD_REQUEST.code).json(
          errorResponse(result.message, ERROR_CODES.POINT_AWARD_FAILED)
        );
      }

      res.status(HTTP_STATUS.OK.code).json(
        successResponse(
          result.message,
          {
            pointsAwarded: result.points,
            newBalance: result.newBalance,
            transaction: result.transaction
          },
          null,
          SUCCESS_CODES.POINTS_AWARDED
        )
      );
    } catch (error) {
      console.error('Error awarding campaign share points:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR.code).json(
        errorResponse('Failed to award share points', ERROR_CODES.INTERNAL_ERROR)
      );
    }
  });
}

module.exports = new PointController();