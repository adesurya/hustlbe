const { sequelize } = require('../config/database');
const { 
  User, 
  PointTransaction, 
  PointActivity, 
  PointRedemption 
} = require('../models');
const { logUserAction, logSystemError } = require('../utils/logger');

class PointService {
  /**
   * Award points to user for specific activity
   * @param {number} userId - User ID
   * @param {string} activityCode - Activity code
   * @param {object} options - Additional options
   * @returns {object} Transaction result
   */
  async awardPoints(userId, activityCode, options = {}) {
    const {
      referenceId = null,
      referenceType = null,
      customAmount = null,
      description = null,
      metadata = null
    } = options;

    const transaction = await sequelize.transaction();

    try {
      // Get user and activity
      const [user, activity] = await Promise.all([
        User.findByPk(userId),
        PointActivity.findByCode(activityCode)
      ]);

      if (!user) {
        throw new Error('User not found');
      }

      if (!activity) {
        throw new Error('Activity not found');
      }

      // Check if user can earn points for this activity
      const eligibility = await activity.canUserEarn(userId);
      if (!eligibility.canEarn) {
        throw new Error(eligibility.reason);
      }

      const pointsToAward = customAmount || activity.pointsReward;

      // Create point transaction
      const pointTransaction = await PointTransaction.create({
        userId,
        transactionType: 'credit',
        amount: pointsToAward,
        balanceBefore: user.currentPoints,
        activityType: activityCode,
        activityDescription: description || `Points earned for ${activity.activityName}`,
        referenceId,
        referenceType,
        status: 'completed',
        metadata
      }, { transaction });

      // Update user's current points
      await user.update({
        currentPoints: pointTransaction.balanceAfter
      }, { transaction });

      await transaction.commit();

      logUserAction('points_awarded', userId, {
        activityCode,
        pointsAwarded: pointsToAward,
        newBalance: pointTransaction.balanceAfter,
        referenceId,
        referenceType
      });

      return {
        transaction: pointTransaction,
        newBalance: pointTransaction.balanceAfter,
        pointsAwarded: pointsToAward
      };
    } catch (error) {
      await transaction.rollback();
      
      logSystemError(error, {
        context: 'award_points',
        userId,
        activityCode,
        options
      });
      
      throw error;
    }
  }

  /**
   * Deduct points from user
   * @param {number} userId - User ID
   * @param {number} amount - Points to deduct
   * @param {string} activityType - Activity type
   * @param {object} options - Additional options
   * @returns {object} Transaction result
   */
  async deductPoints(userId, amount, activityType, options = {}) {
    const {
      referenceId = null,
      referenceType = null,
      description = null,
      processedBy = null,
      metadata = null
    } = options;

    const transaction = await sequelize.transaction();

    try {
      const user = await User.findByPk(userId);
      
      if (!user) {
        throw new Error('User not found');
      }

      if (user.currentPoints < amount) {
        throw new Error('Insufficient points balance');
      }

      // Create debit transaction
      const pointTransaction = await PointTransaction.create({
        userId,
        transactionType: 'debit',
        amount,
        balanceBefore: user.currentPoints,
        activityType,
        activityDescription: description || `Points deducted for ${activityType}`,
        referenceId,
        referenceType,
        processedBy,
        status: 'completed',
        metadata
      }, { transaction });

      // Update user's current points
      await user.update({
        currentPoints: pointTransaction.balanceAfter
      }, { transaction });

      await transaction.commit();

      logUserAction('points_deducted', userId, {
        activityType,
        pointsDeducted: amount,
        newBalance: pointTransaction.balanceAfter,
        referenceId,
        referenceType,
        processedBy
      });

      return {
        transaction: pointTransaction,
        newBalance: pointTransaction.balanceAfter,
        pointsDeducted: amount
      };
    } catch (error) {
      await transaction.rollback();
      
      logSystemError(error, {
        context: 'deduct_points',
        userId,
        amount,
        activityType,
        options
      });
      
      throw error;
    }
  }

  /**
   * Get user's point balance and summary
   * @param {number} userId - User ID
   * @returns {object} Points summary
   */
  async getUserPointsSummary(userId) {
    try {
      const [user, transactionSummary, recentTransactions] = await Promise.all([
        User.findByPk(userId, {
          attributes: ['id', 'username', 'email', 'currentPoints']
        }),
        PointTransaction.getUserPointsSummary(userId),
        PointTransaction.getUserTransactionHistory(userId, { limit: 5 })
      ]);

      if (!user) {
        throw new Error('User not found');
      }

      return {
        user: user.toSafeJSON(),
        currentBalance: user.currentPoints,
        summary: transactionSummary,
        recentTransactions: recentTransactions.rows.map(t => t.toSafeJSON())
      };
    } catch (error) {
      logSystemError(error, {
        context: 'get_user_points_summary',
        userId
      });
      throw error;
    }
  }

  /**
   * Get user's transaction history
   * @param {number} userId - User ID
   * @param {object} options - Query options
   * @returns {object} Transaction history with pagination
   */
  async getUserTransactionHistory(userId, options = {}) {
    try {
      const result = await PointTransaction.getUserTransactionHistory(userId, options);
      
      return {
        transactions: result.rows.map(t => t.toSafeJSON()),
        pagination: {
          currentPage: parseInt(options.page) || 1,
          totalPages: Math.ceil(result.count / (parseInt(options.limit) || 20)),
          totalItems: result.count,
          itemsPerPage: parseInt(options.limit) || 20
        }
      };
    } catch (error) {
      logSystemError(error, {
        context: 'get_user_transaction_history',
        userId,
        options
      });
      throw error;
    }
  }

  /**
   * Request point redemption
   * @param {number} userId - User ID
   * @param {object} redemptionData - Redemption details
   * @returns {object} Redemption request
   */
  async requestRedemption(userId, redemptionData) {
    const {
      pointsToRedeem,
      redemptionType,
      redemptionValue = null,
      redemptionDetails = {}
    } = redemptionData;

    try {
      const user = await User.findByPk(userId);
      
      if (!user) {
        throw new Error('User not found');
      }

      if (user.currentPoints < pointsToRedeem) {
        throw new Error('Insufficient points for redemption');
      }

      // Create redemption request
      const redemption = await PointRedemption.create({
        userId,
        pointsRedeemed: pointsToRedeem,
        redemptionType,
        redemptionValue,
        redemptionDetails,
        status: 'pending'
      });

      logUserAction('redemption_requested', userId, {
        redemptionId: redemption.id,
        pointsRequested: pointsToRedeem,
        redemptionType,
        redemptionValue
      });

      return redemption;
    } catch (error) {
      logSystemError(error, {
        context: 'request_redemption',
        userId,
        redemptionData
      });
      throw error;
    }
  }

  /**
   * Get available point activities
   * @returns {Array} Active point activities
   */
  async getAvailableActivities() {
    try {
      const activities = await PointActivity.findActiveActivities();
      return activities.map(activity => ({
        id: activity.id,
        code: activity.activityCode,
        name: activity.activityName,
        description: activity.description,
        pointsReward: activity.pointsReward,
        dailyLimit: activity.dailyLimit,
        totalLimit: activity.totalLimit,
        isActive: activity.isActive
      }));
    } catch (error) {
      logSystemError(error, { context: 'get_available_activities' });
      throw error;
    }
  }

  /**
   * Get system-wide point statistics (Admin only)
   * @returns {object} System statistics
   */
  async getSystemStatistics() {
    try {
      const [basicStats, activityStats, redemptionStats] = await Promise.all([
        PointTransaction.getSystemPointsStatistics(),
        this.getActivityStatistics(),
        this.getRedemptionStatistics()
      ]);

      return {
        overview: basicStats,
        activities: activityStats,
        redemptions: redemptionStats
      };
    } catch (error) {
      logSystemError(error, { context: 'get_system_statistics' });
      throw error;
    }
  }

  /**
   * Get activity statistics
   * @returns {Array} Activity statistics
   */
  async getActivityStatistics() {
    try {
      const stats = await sequelize.query(`
        SELECT 
          pt.activity_type,
          COUNT(*) as transaction_count,
          SUM(pt.amount) as total_points,
          COUNT(DISTINCT pt.user_id) as unique_users,
          AVG(pt.amount) as avg_points_per_transaction
        FROM point_transactions pt
        WHERE pt.transaction_type = 'credit' AND pt.status = 'completed'
        GROUP BY pt.activity_type
        ORDER BY total_points DESC
      `, {
        type: sequelize.QueryTypes.SELECT
      });

      return stats;
    } catch (error) {
      logSystemError(error, { context: 'get_activity_statistics' });
      throw error;
    }
  }

  /**
   * Get redemption statistics
   * @returns {object} Redemption statistics
   */
  async getRedemptionStatistics() {
    try {
      const [statusStats, typeStats] = await Promise.all([
        sequelize.query(`
          SELECT 
            status,
            COUNT(*) as count,
            SUM(points_redeemed) as total_points
          FROM point_redemptions
          GROUP BY status
        `, { type: sequelize.QueryTypes.SELECT }),
        
        sequelize.query(`
          SELECT 
            redemption_type,
            COUNT(*) as count,
            SUM(points_redeemed) as total_points,
            AVG(points_redeemed) as avg_points
          FROM point_redemptions
          WHERE status IN ('approved', 'completed')
          GROUP BY redemption_type
          ORDER BY total_points DESC
        `, { type: sequelize.QueryTypes.SELECT })
      ]);

      return {
        byStatus: statusStats,
        byType: typeStats
      };
    } catch (error) {
      logSystemError(error, { context: 'get_redemption_statistics' });
      throw error;
    }
  }

  /**
   * Process redemption (Admin only)
   * @param {number} redemptionId - Redemption ID
   * @param {string} action - 'approve' or 'reject'
   * @param {number} adminId - Admin user ID
   * @param {string} notes - Admin notes
   * @returns {object} Updated redemption
   */
  async processRedemption(redemptionId, action, adminId, notes = null) {
    try {
      const redemption = await PointRedemption.findByPk(redemptionId, {
        include: [{
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'email', 'currentPoints']
        }]
      });

      if (!redemption) {
        throw new Error('Redemption not found');
      }

      let result;
      if (action === 'approve') {
        result = await redemption.approve(adminId, notes);
      } else if (action === 'reject') {
        result = await redemption.reject(adminId, notes);
      } else {
        throw new Error('Invalid action. Must be "approve" or "reject"');
      }

      logUserAction('redemption_processed', adminId, {
        redemptionId,
        action,
        userId: redemption.userId,
        pointsInvolved: redemption.pointsRedeemed,
        notes
      });

      return result;
    } catch (error) {
      logSystemError(error, {
        context: 'process_redemption',
        redemptionId,
        action,
        adminId
      });
      throw error;
    }
  }
}

module.exports = new PointService();