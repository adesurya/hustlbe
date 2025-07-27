const User = require('../models/User');
const PointActivity = require('../models/PointActivity');
const PointTransaction = require('../models/PointTransaction');
const { sequelize } = require('../config/database');
const { logSecurityEvent } = require('../utils/logger');

class PointService {
  /**
   * Award points to user for specific activity
   * @param {number} userId - User ID
   * @param {string} activityCode - Activity code (e.g., 'EMAIL_VERIFY', 'DAILY_LOGIN')
   * @param {object} options - Additional options
   * @returns {object} Transaction result
   */
  async awardPoints(userId, activityCode, options = {}) {
    const transaction = await sequelize.transaction();

    try {
      console.log(`🎯 Attempting to award points for activity: ${activityCode} to user: ${userId}`);

      // Find the activity
      const activity = await PointActivity.findByCode(activityCode);
      
      if (!activity) {
        console.log(`❌ Activity not found: ${activityCode}`);
        await transaction.rollback();
        return {
          success: false,
          message: `Activity ${activityCode} not found`,
          awarded: false
        };
      }

      console.log(`📋 Activity found:`, {
        code: activity.activityCode,
        name: activity.activityName,
        points: activity.pointsReward,
        isActive: activity.isActive
      });

      // Check if activity is valid and active
      if (!activity.isValidNow()) {
        console.log(`❌ Activity is not currently active: ${activityCode}`);
        await transaction.rollback();
        return {
          success: false,
          message: `Activity ${activityCode} is not currently active`,
          awarded: false
        };
      }

      // Check if user can earn points for this activity
      const canEarnResult = await activity.canUserEarn(userId);
      
      if (!canEarnResult.canEarn) {
        console.log(`❌ User cannot earn points:`, canEarnResult.reason);
        await transaction.rollback();
        return {
          success: false,
          message: canEarnResult.reason,
          awarded: false
        };
      }

      // Get user
      const user = await User.findByPk(userId, { transaction });
      
      if (!user) {
        console.log(`❌ User not found: ${userId}`);
        await transaction.rollback();
        return {
          success: false,
          message: 'User not found',
          awarded: false
        };
      }

      // Check if user can earn points (active and verified)
      if (!user.canEarnPoints()) {
        console.log(`❌ User cannot earn points - not active or verified`);
        await transaction.rollback();
        return {
          success: false,
          message: 'User account must be active and verified to earn points',
          awarded: false
        };
      }

      const pointsToAward = activity.pointsReward;
      const balanceBefore = user.currentPoints;

      console.log(`💰 Awarding ${pointsToAward} points to user ${userId}`);
      console.log(`💰 Balance before: ${balanceBefore}`);

      // Create point transaction
      const pointTransaction = await PointTransaction.create({
        userId: userId,
        transactionType: 'credit',
        amount: pointsToAward,
        balanceBefore: balanceBefore,
        activityType: activityCode,
        activityDescription: activity.activityName,
        referenceId: options.referenceId || null,
        referenceType: options.referenceType || 'activity',
        processedBy: options.processedBy || null,
        status: 'completed',
        metadata: {
          activityId: activity.id,
          activityName: activity.activityName,
          ...options.metadata
        }
      }, { transaction });

      // Update user's current points
      await user.addPoints(pointsToAward, transaction);

      await transaction.commit();

      console.log(`✅ Points awarded successfully!`);
      console.log(`✅ Transaction ID: ${pointTransaction.id}`);
      console.log(`✅ New balance: ${balanceBefore + pointsToAward}`);

      // Log the point award
      logSecurityEvent('points_awarded', {
        userId: userId,
        activityCode: activityCode,
        pointsAwarded: pointsToAward,
        balanceBefore: balanceBefore,
        balanceAfter: balanceBefore + pointsToAward,
        transactionId: pointTransaction.id
      });

      return {
        success: true,
        message: `Congratulations! You earned ${pointsToAward} points for ${activity.activityName}`,
        awarded: true,
        points: pointsToAward,
        newBalance: balanceBefore + pointsToAward,
        transaction: {
          id: pointTransaction.id,
          activity: activity.activityName,
          amount: pointsToAward
        }
      };

    } catch (error) {
      await transaction.rollback();
      console.error(`❌ Error awarding points:`, error);
      
      logSecurityEvent('points_award_error', {
        userId: userId,
        activityCode: activityCode,
        error: error.message,
        stack: error.stack
      });

      return {
        success: false,
        message: 'Failed to award points',
        awarded: false,
        error: error.message
      };
    }
  }

  /**
   * Award points for email verification
   * @param {number} userId - User ID
   * @returns {object} Result
   */
  async awardEmailVerificationPoints(userId) {
    return this.awardPoints(userId, 'EMAIL_VERIFY', {
      referenceType: 'email_verification',
      metadata: {
        event: 'email_verified',
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Award points for profile completion
   * @param {number} userId - User ID
   * @returns {object} Result
   */
  async awardProfileCompletionPoints(userId) {
    return this.awardPoints(userId, 'PROFILE_COMPLETE', {
      referenceType: 'profile_completion',
      metadata: {
        event: 'profile_completed',
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Award points for daily login
   * @param {number} userId - User ID
   * @returns {object} Result
   */
  async awardDailyLoginPoints(userId) {
    return this.awardPoints(userId, 'DAILY_LOGIN', {
      referenceType: 'daily_login',
      metadata: {
        event: 'daily_login',
        timestamp: new Date().toISOString(),
        loginDate: new Date().toISOString().split('T')[0]
      }
    });
  }

  /**
   * Award points for sharing product
   * @param {number} userId - User ID
   * @param {number} productId - Product ID
   * @returns {object} Result
   */
  async awardProductSharePoints(userId, productId) {
    return this.awardPoints(userId, 'PRODUCT_SHARE', {
      referenceId: productId.toString(),
      referenceType: 'product_share',
      metadata: {
        event: 'product_shared',
        productId: productId,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Award points for sharing campaign
   * @param {number} userId - User ID
   * @param {number} campaignId - Campaign ID
   * @returns {object} Result
   */
  async awardCampaignSharePoints(userId, campaignId) {
    return this.awardPoints(userId, 'CAMPAIGN_SHARE', {
      referenceId: campaignId.toString(),
      referenceType: 'campaign_share',
      metadata: {
        event: 'campaign_shared',
        campaignId: campaignId,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Get user's point summary
   * @param {number} userId - User ID
   * @returns {object} Point summary
   */
  async getUserPointSummary(userId) {
    try {
      const user = await User.findByPk(userId);
      
      if (!user) {
        throw new Error('User not found');
      }

      // Get transaction summary
      const transactions = await PointTransaction.findAll({
        where: { userId },
        attributes: [
          'transactionType',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
          [sequelize.fn('SUM', sequelize.col('amount')), 'total']
        ],
        group: ['transactionType']
      });

      const summary = {
        currentBalance: user.currentPoints,
        totalEarned: 0,
        totalSpent: 0,
        transactionCounts: {
          credit: 0,
          debit: 0
        }
      };

      transactions.forEach(tx => {
        const count = parseInt(tx.dataValues.count);
        const total = parseInt(tx.dataValues.total) || 0;
        
        if (tx.transactionType === 'credit') {
          summary.totalEarned = total;
          summary.transactionCounts.credit = count;
        } else {
          summary.totalSpent = total;
          summary.transactionCounts.debit = count;
        }
      });

      return summary;
    } catch (error) {
      console.error('Error getting user point summary:', error);
      throw error;
    }
  }

  /**
   * Check if user has completed specific activity today
   * @param {number} userId - User ID
   * @param {string} activityCode - Activity code
   * @returns {boolean} Has completed today
   */
  async hasCompletedActivityToday(userId, activityCode) {
    try {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

      const count = await PointTransaction.count({
        where: {
          userId,
          activityType: activityCode,
          status: 'completed',
          created_at: {
            [sequelize.Op.gte]: startOfDay,
            [sequelize.Op.lt]: endOfDay
          }
        }
      });

      return count > 0;
    } catch (error) {
      console.error('Error checking daily activity completion:', error);
      return false;
    }
  }

  /**
   * Get available activities for user
   * @param {number} userId - User ID
   * @returns {array} Available activities
   */
  async getAvailableActivitiesForUser(userId) {
    try {
      const activities = await PointActivity.findActiveActivities();
      const availableActivities = [];

      for (const activity of activities) {
        const canEarn = await activity.canUserEarn(userId);
        availableActivities.push({
          id: activity.id,
          code: activity.activityCode,
          name: activity.activityName,
          description: activity.description,
          points: activity.pointsReward,
          dailyLimit: activity.dailyLimit,
          totalLimit: activity.totalLimit,
          canEarn: canEarn.canEarn,
          reason: canEarn.reason
        });
      }

      return availableActivities;
    } catch (error) {
      console.error('Error getting available activities:', error);
      throw error;
    }
  }
}

module.exports = new PointService();