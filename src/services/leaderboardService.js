const User = require('../models/User');
const PointTransaction = require('../models/PointTransaction');
const { sequelize } = require('../config/database');
const { Op } = require('sequelize');

class LeaderboardService {
  /**
   * Get daily leaderboard (top 10 users based on points earned on specific date)
   * @param {Date} date - Target date
   * @returns {Array} Leaderboard data
   */
  async getDailyLeaderboard(date = new Date()) {
    try {
      const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

      const query = `
        SELECT 
          u.id,
          u.username,
          u.email,
          u.profile_picture,
          COALESCE(SUM(CASE WHEN pt.transaction_type = 'credit' THEN pt.amount ELSE 0 END), 0) as daily_points,
          RANK() OVER (ORDER BY COALESCE(SUM(CASE WHEN pt.transaction_type = 'credit' THEN pt.amount ELSE 0 END), 0) DESC) as rank_position
        FROM users u
        LEFT JOIN point_transactions pt ON u.id = pt.user_id 
          AND pt.status = 'completed'
          AND pt.created_at >= :startOfDay 
          AND pt.created_at < :endOfDay
        WHERE u.is_active = 1 
          AND u.is_verified = 1
        GROUP BY u.id, u.username, u.email, u.profile_picture
        HAVING daily_points > 0
        ORDER BY daily_points DESC, u.username ASC
        LIMIT 10
      `;

      const results = await sequelize.query(query, {
        replacements: { 
          startOfDay: startOfDay, 
          endOfDay: endOfDay 
        },
        type: sequelize.QueryTypes.SELECT
      });

      return {
        type: 'daily',
        date: date.toISOString().split('T')[0],
        total_participants: results.length,
        leaderboard: results.map((user, index) => ({
          rank: index + 1,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            profile_picture: user.profile_picture
          },
          points: parseInt(user.daily_points),
          badge: this.getBadge(index + 1)
        }))
      };
    } catch (error) {
      console.error('Error getting daily leaderboard:', error);
      throw error;
    }
  }

  /**
   * Get monthly leaderboard (top 10 users based on total points earned in specific month)
   * @param {number} year - Target year
   * @param {number} month - Target month (1-12)
   * @returns {Array} Leaderboard data
   */
  async getMonthlyLeaderboard(year = new Date().getFullYear(), month = new Date().getMonth() + 1) {
    try {
      const startOfMonth = new Date(year, month - 1, 1);
      const endOfMonth = new Date(year, month, 1);

      const query = `
        SELECT 
          u.id,
          u.username,
          u.email,
          u.profile_picture,
          COALESCE(SUM(CASE WHEN pt.transaction_type = 'credit' THEN pt.amount ELSE 0 END), 0) as monthly_points,
          RANK() OVER (ORDER BY COALESCE(SUM(CASE WHEN pt.transaction_type = 'credit' THEN pt.amount ELSE 0 END), 0) DESC) as rank_position
        FROM users u
        LEFT JOIN point_transactions pt ON u.id = pt.user_id 
          AND pt.status = 'completed'
          AND pt.created_at >= :startOfMonth 
          AND pt.created_at < :endOfMonth
        WHERE u.is_active = 1 
          AND u.is_verified = 1
        GROUP BY u.id, u.username, u.email, u.profile_picture
        HAVING monthly_points > 0
        ORDER BY monthly_points DESC, u.username ASC
        LIMIT 10
      `;

      const results = await sequelize.query(query, {
        replacements: { 
          startOfMonth: startOfMonth, 
          endOfMonth: endOfMonth 
        },
        type: sequelize.QueryTypes.SELECT
      });

      return {
        type: 'monthly',
        year: year,
        month: month,
        month_name: new Date(year, month - 1).toLocaleString('en-US', { month: 'long' }),
        total_participants: results.length,
        leaderboard: results.map((user, index) => ({
          rank: index + 1,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            profile_picture: user.profile_picture
          },
          points: parseInt(user.monthly_points),
          badge: this.getBadge(index + 1)
        }))
      };
    } catch (error) {
      console.error('Error getting monthly leaderboard:', error);
      throw error;
    }
  }

  /**
   * Get all-time leaderboard (top 10 users based on current_points)
   * @returns {Array} Leaderboard data
   */
  async getAllTimeLeaderboard() {
    try {
      const users = await User.findAll({
        where: {
          isActive: true,
          isVerified: true,
          currentPoints: {
            [Op.gt]: 0
          }
        },
        attributes: ['id', 'username', 'email', 'profile_picture', 'current_points'],
        order: [
          ['current_points', 'DESC'],
          ['username', 'ASC']
        ],
        limit: 10
      });

      return {
        type: 'all_time',
        total_participants: users.length,
        leaderboard: users.map((user, index) => ({
          rank: index + 1,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            profile_picture: user.profile_picture
          },
          points: user.current_points,
          badge: this.getBadge(index + 1)
        }))
      };
    } catch (error) {
      console.error('Error getting all-time leaderboard:', error);
      throw error;
    }
  }

  /**
   * Get user's daily ranking
   * @param {number} userId - User ID
   * @param {Date} date - Target date
   * @returns {Object} User ranking data
   */
  async getUserDailyRanking(userId, date = new Date()) {
    try {
      const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

      const query = `
        SELECT 
          u.id,
          u.username,
          u.email,
          u.profile_picture,
          COALESCE(SUM(CASE WHEN pt.transaction_type = 'credit' THEN pt.amount ELSE 0 END), 0) as daily_points,
          RANK() OVER (ORDER BY COALESCE(SUM(CASE WHEN pt.transaction_type = 'credit' THEN pt.amount ELSE 0 END), 0) DESC) as rank_position
        FROM users u
        LEFT JOIN point_transactions pt ON u.id = pt.user_id 
          AND pt.status = 'completed'
          AND pt.created_at >= :startOfDay 
          AND pt.created_at < :endOfDay
        WHERE u.is_active = 1 AND u.is_verified = 1
        GROUP BY u.id, u.username, u.email, u.profile_picture
        HAVING u.id = :userId
      `;

      const [userRank] = await sequelize.query(query, {
        replacements: { 
          userId: userId,
          startOfDay: startOfDay, 
          endOfDay: endOfDay 
        },
        type: sequelize.QueryTypes.SELECT
      });

      // Get total participants count
      const totalQuery = `
        SELECT COUNT(DISTINCT u.id) as total_participants
        FROM users u
        LEFT JOIN point_transactions pt ON u.id = pt.user_id 
          AND pt.status = 'completed'
          AND pt.created_at >= :startOfDay 
          AND pt.created_at < :endOfDay
        WHERE u.is_active = 1 AND u.is_verified = 1
        GROUP BY u.id
        HAVING COALESCE(SUM(CASE WHEN pt.transaction_type = 'credit' THEN pt.amount ELSE 0 END), 0) > 0
      `;

      const totalResult = await sequelize.query(totalQuery, {
        replacements: { 
          startOfDay: startOfDay, 
          endOfDay: endOfDay 
        },
        type: sequelize.QueryTypes.SELECT
      });

      if (!userRank) {
        return {
          type: 'daily',
          date: date.toISOString().split('T')[0],
          user_ranking: null,
          message: 'No points earned on this date'
        };
      }

      return {
        type: 'daily',
        date: date.toISOString().split('T')[0],
        user_ranking: {
          rank: parseInt(userRank.rank_position),
          user: {
            id: userRank.id,
            username: userRank.username,
            email: userRank.email,
            profile_picture: userRank.profile_picture
          },
          points: parseInt(userRank.daily_points),
          total_participants: totalResult.length,
          badge: this.getBadge(parseInt(userRank.rank_position))
        }
      };
    } catch (error) {
      console.error('Error getting user daily ranking:', error);
      throw error;
    }
  }

  /**
   * Get user's monthly ranking
   * @param {number} userId - User ID
   * @param {number} year - Target year
   * @param {number} month - Target month
   * @returns {Object} User ranking data
   */
  async getUserMonthlyRanking(userId, year = new Date().getFullYear(), month = new Date().getMonth() + 1) {
    try {
      const startOfMonth = new Date(year, month - 1, 1);
      const endOfMonth = new Date(year, month, 1);

      const query = `
        SELECT 
          u.id,
          u.username,
          u.email,
          u.profile_picture,
          COALESCE(SUM(CASE WHEN pt.transaction_type = 'credit' THEN pt.amount ELSE 0 END), 0) as monthly_points,
          RANK() OVER (ORDER BY COALESCE(SUM(CASE WHEN pt.transaction_type = 'credit' THEN pt.amount ELSE 0 END), 0) DESC) as rank_position
        FROM users u
        LEFT JOIN point_transactions pt ON u.id = pt.user_id 
          AND pt.status = 'completed'
          AND pt.created_at >= :startOfMonth 
          AND pt.created_at < :endOfMonth
        WHERE u.is_active = 1 AND u.is_verified = 1
        GROUP BY u.id, u.username, u.email, u.profile_picture
        HAVING u.id = :userId
      `;

      const [userRank] = await sequelize.query(query, {
        replacements: { 
          userId: userId,
          startOfMonth: startOfMonth, 
          endOfMonth: endOfMonth 
        },
        type: sequelize.QueryTypes.SELECT
      });

      // Get total participants count
      const totalQuery = `
        SELECT COUNT(DISTINCT u.id) as total_participants
        FROM users u
        LEFT JOIN point_transactions pt ON u.id = pt.user_id 
          AND pt.status = 'completed'
          AND pt.created_at >= :startOfMonth 
          AND pt.created_at < :endOfMonth
        WHERE u.is_active = 1 AND u.is_verified = 1
        GROUP BY u.id
        HAVING COALESCE(SUM(CASE WHEN pt.transaction_type = 'credit' THEN pt.amount ELSE 0 END), 0) > 0
      `;

      const totalResult = await sequelize.query(totalQuery, {
        replacements: { 
          startOfMonth: startOfMonth, 
          endOfMonth: endOfMonth 
        },
        type: sequelize.QueryTypes.SELECT
      });

      if (!userRank) {
        return {
          type: 'monthly',
          year: year,
          month: month,
          month_name: new Date(year, month - 1).toLocaleString('en-US', { month: 'long' }),
          user_ranking: null,
          message: 'No points earned in this month'
        };
      }

      return {
        type: 'monthly',
        year: year,
        month: month,
        month_name: new Date(year, month - 1).toLocaleString('en-US', { month: 'long' }),
        user_ranking: {
          rank: parseInt(userRank.rank_position),
          user: {
            id: userRank.id,
            username: userRank.username,
            email: userRank.email,
            profile_picture: userRank.profile_picture
          },
          points: parseInt(userRank.monthly_points),
          total_participants: totalResult.length,
          badge: this.getBadge(parseInt(userRank.rank_position))
        }
      };
    } catch (error) {
      console.error('Error getting user monthly ranking:', error);
      throw error;
    }
  }

  /**
   * Get user's all-time ranking
   * @param {number} userId - User ID
   * @returns {Object} User ranking data
   */
  async getUserAllTimeRanking(userId) {
    try {
      const query = `
        SELECT 
          u.id,
          u.username,
          u.email,
          u.profile_picture,
          u.current_points,
          RANK() OVER (ORDER BY u.current_points DESC) as rank_position
        FROM users u
        WHERE u.is_active = 1 AND u.is_verified = 1 AND u.id = :userId
      `;

      const [userRank] = await sequelize.query(query, {
        replacements: { userId: userId },
        type: sequelize.QueryTypes.SELECT
      });

      // Get total participants count
      const totalUsers = await User.count({
        where: {
          isActive: true,
          isVerified: true,
          currentPoints: {
            [Op.gt]: 0
          }
        }
      });

      if (!userRank) {
        return {
          type: 'all_time',
          user_ranking: null,
          message: 'User not found or no points earned'
        };
      }

      return {
        type: 'all_time',
        user_ranking: {
          rank: parseInt(userRank.rank_position),
          user: {
            id: userRank.id,
            username: userRank.username,
            email: userRank.email,
            profile_picture: userRank.profile_picture
          },
          points: userRank.current_points,
          total_participants: totalUsers,
          badge: this.getBadge(parseInt(userRank.rank_position))
        }
      };
    } catch (error) {
      console.error('Error getting user all-time ranking:', error);
      throw error;
    }
  }

  /**
   * Get comprehensive leaderboard data (all types + user rankings)
   * @param {number} userId - User ID
   * @param {Date} date - Target date for daily
   * @param {number} year - Target year for monthly
   * @param {number} month - Target month for monthly
   * @returns {Object} Comprehensive data
   */
  async getComprehensiveLeaderboard(userId, date = new Date(), year = new Date().getFullYear(), month = new Date().getMonth() + 1) {
    try {
      const [
        dailyLeaderboard,
        monthlyLeaderboard,
        allTimeLeaderboard,
        userDailyRank,
        userMonthlyRank,
        userAllTimeRank
      ] = await Promise.all([
        this.getDailyLeaderboard(date),
        this.getMonthlyLeaderboard(year, month),
        this.getAllTimeLeaderboard(),
        this.getUserDailyRanking(userId, date),
        this.getUserMonthlyRanking(userId, year, month),
        this.getUserAllTimeRanking(userId)
      ]);

      return {
        leaderboards: {
          daily: dailyLeaderboard,
          monthly: monthlyLeaderboard,
          all_time: allTimeLeaderboard
        },
        user_rankings: {
          daily: userDailyRank.user_ranking,
          monthly: userMonthlyRank.user_ranking,
          all_time: userAllTimeRank.user_ranking
        },
        metadata: {
          generated_at: new Date().toISOString(),
          target_date: date.toISOString().split('T')[0],
          target_month: `${year}-${month.toString().padStart(2, '0')}`
        }
      };
    } catch (error) {
      console.error('Error getting comprehensive leaderboard:', error);
      throw error;
    }
  }

  /**
   * Get leaderboard statistics (Admin only)
   * @returns {Object} Statistics data
   */
  async getLeaderboardStatistics() {
    try {
      const today = new Date();
      const currentMonth = today.getMonth() + 1;
      const currentYear = today.getFullYear();

      const [
        totalActiveUsers,
        usersWithPoints,
        dailyParticipants,
        monthlyParticipants,
        topDailyPoints,
        topMonthlyPoints,
        topAllTimePoints
      ] = await Promise.all([
        User.count({ where: { isActive: true, isVerified: true } }),
        User.count({ where: { isActive: true, isVerified: true, currentPoints: { [Op.gt]: 0 } } }),
        this.getDailyParticipantsCount(today),
        this.getMonthlyParticipantsCount(currentYear, currentMonth),
        this.getTopPoints('daily', today),
        this.getTopPoints('monthly', new Date(currentYear, currentMonth - 1)),
        this.getTopPoints('all_time')
      ]);

      return {
        overview: {
          total_active_users: totalActiveUsers,
          users_with_points: usersWithPoints,
          participation_rate: totalActiveUsers > 0 ? ((usersWithPoints / totalActiveUsers) * 100).toFixed(2) : 0
        },
        current_period: {
          daily_participants: dailyParticipants,
          monthly_participants: monthlyParticipants,
          daily_top_score: topDailyPoints,
          monthly_top_score: topMonthlyPoints,
          all_time_top_score: topAllTimePoints
        },
        generated_at: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error getting leaderboard statistics:', error);
      throw error;
    }
  }

  /**
   * Helper method to get badge based on rank
   * @param {number} rank - User rank
   * @returns {string} Badge name
   */
  getBadge(rank) {
    switch (rank) {
      case 1:
        return '🥇 Gold';
      case 2:
        return '🥈 Silver';
      case 3:
        return '🥉 Bronze';
      case 4:
      case 5:
        return '🏆 Top 5';
      case 6:
      case 7:
      case 8:
      case 9:
      case 10:
        return '⭐ Top 10';
      default:
        return '🎯 Participant';
    }
  }

  /**
   * Helper method to get daily participants count
   */
  async getDailyParticipantsCount(date) {
    const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    const result = await sequelize.query(`
      SELECT COUNT(DISTINCT u.id) as count
      FROM users u
      INNER JOIN point_transactions pt ON u.id = pt.user_id 
      WHERE pt.status = 'completed'
        AND pt.transaction_type = 'credit'
        AND pt.created_at >= :startOfDay 
        AND pt.created_at < :endOfDay
        AND u.is_active = 1 
        AND u.is_verified = 1
    `, {
      replacements: { startOfDay, endOfDay },
      type: sequelize.QueryTypes.SELECT
    });

    return result[0]?.count || 0;
  }

  /**
   * Helper method to get monthly participants count
   */
  async getMonthlyParticipantsCount(year, month) {
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 1);

    const result = await sequelize.query(`
      SELECT COUNT(DISTINCT u.id) as count
      FROM users u
      INNER JOIN point_transactions pt ON u.id = pt.user_id 
      WHERE pt.status = 'completed'
        AND pt.transaction_type = 'credit'
        AND pt.created_at >= :startOfMonth 
        AND pt.created_at < :endOfMonth
        AND u.is_active = 1 
        AND u.is_verified = 1
    `, {
      replacements: { startOfMonth, endOfMonth },
      type: sequelize.QueryTypes.SELECT
    });

    return result[0]?.count || 0;
  }

  /**
   * Helper method to get top points for different periods
   */
  async getTopPoints(type, date = null) {
    try {
      let query;
      let replacements = {};

      switch (type) {
        case 'daily':
          const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
          const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
          query = `
            SELECT COALESCE(SUM(CASE WHEN pt.transaction_type = 'credit' THEN pt.amount ELSE 0 END), 0) as top_points
            FROM users u
            LEFT JOIN point_transactions pt ON u.id = pt.user_id 
              AND pt.status = 'completed'
              AND pt.created_at >= :startOfDay 
              AND pt.created_at < :endOfDay
            WHERE u.is_active = 1 AND u.is_verified = 1
            GROUP BY u.id
            ORDER BY top_points DESC
            LIMIT 1
          `;
          replacements = { startOfDay, endOfDay };
          break;

        case 'monthly':
          const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
          const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 1);
          query = `
            SELECT COALESCE(SUM(CASE WHEN pt.transaction_type = 'credit' THEN pt.amount ELSE 0 END), 0) as top_points
            FROM users u
            LEFT JOIN point_transactions pt ON u.id = pt.user_id 
              AND pt.status = 'completed'
              AND pt.created_at >= :startOfMonth 
              AND pt.created_at < :endOfMonth
            WHERE u.is_active = 1 AND u.is_verified = 1
            GROUP BY u.id
            ORDER BY top_points DESC
            LIMIT 1
          `;
          replacements = { startOfMonth, endOfMonth };
          break;

        case 'all_time':
        default:
          query = `
            SELECT current_points as top_points
            FROM users
            WHERE is_active = 1 AND is_verified = 1
            ORDER BY current_points DESC
            LIMIT 1
          `;
          break;
      }

      const result = await sequelize.query(query, {
        replacements,
        type: sequelize.QueryTypes.SELECT
      });

      return result[0]?.top_points || 0;
    } catch (error) {
      console.error('Error getting top points:', error);
      return 0;
    }
  }
}

module.exports = new LeaderboardService();