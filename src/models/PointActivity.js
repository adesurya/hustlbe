const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PointActivity = sequelize.define('PointActivity', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  activityCode: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    field: 'activity_code'
  },
  activityName: {
    type: DataTypes.STRING(100),
    allowNull: false,
    field: 'activity_name'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  pointsReward: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'points_reward',
    validate: {
      min: 0,
      isInt: true
    }
  },
  dailyLimit: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'daily_limit',
    validate: {
      min: 0,
      isInt: true
    }
  },
  totalLimit: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'total_limit',
    validate: {
      min: 0,
      isInt: true
    }
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active'
  },
  validFrom: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'valid_from'
  },
  validUntil: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'valid_until'
  },
  createdBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'created_by',
    references: {
      model: 'users',
      key: 'id'
    }
  }
}, {
  tableName: 'point_activities',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  paranoid: true,
  deletedAt: 'deleted_at'
});

// Instance methods
PointActivity.prototype.isValidNow = function() {
  const now = new Date();
  
  if (!this.isActive) {
    return false;
  }
  
  if (this.validFrom && now < this.validFrom) {
    return false;
  }
  
  if (this.validUntil && now > this.validUntil) {
    return false;
  }
  
  return true;
};

PointActivity.prototype.canUserEarn = async function(userId) {
  const PointTransaction = require('./PointTransaction');
  
  if (!this.isValidNow()) {
    return {
      canEarn: false,
      reason: 'Activity is not currently active'
    };
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

  // Check daily limit
  if (this.dailyLimit) {
    const todayTransactions = await PointTransaction.count({
      where: {
        userId,
        activityType: this.activityCode,
        status: 'completed',
        created_at: {
          [sequelize.Sequelize.Op.gte]: today,
          [sequelize.Sequelize.Op.lt]: tomorrow
        }
      }
    });

    if (todayTransactions >= this.dailyLimit) {
      return {
        canEarn: false,
        reason: `Daily limit of ${this.dailyLimit} reached for this activity`
      };
    }
  }

  // Check total limit
  if (this.totalLimit) {
    const totalTransactions = await PointTransaction.count({
      where: {
        userId,
        activityType: this.activityCode,
        status: 'completed'
      }
    });

    if (totalTransactions >= this.totalLimit) {
      return {
        canEarn: false,
        reason: `Total limit of ${this.totalLimit} reached for this activity`
      };
    }
  }

  return {
    canEarn: true,
    reason: null
  };
};

// Static methods
PointActivity.findByCode = function(activityCode) {
  return this.findOne({
    where: { activityCode }
  });
};

PointActivity.findActiveActivities = function() {
  const now = new Date();
  
  return this.findAll({
    where: {
      isActive: true,
      [sequelize.Sequelize.Op.or]: [
        { validFrom: null },
        { validFrom: { [sequelize.Sequelize.Op.lte]: now } }
      ],
      [sequelize.Sequelize.Op.or]: [
        { validUntil: null },
        { validUntil: { [sequelize.Sequelize.Op.gte]: now } }
      ]
    },
    order: [['activity_name', 'ASC']]
  });
};

PointActivity.getActivityStatistics = async function() {
  const PointTransaction = require('./PointTransaction');
  
  const stats = await sequelize.query(`
    SELECT 
      pa.id,
      pa.activity_code,
      pa.activity_name,
      pa.points_reward,
      pa.daily_limit,
      pa.total_limit,
      pa.is_active,
      COUNT(pt.id) as usage_count,
      SUM(CASE WHEN pt.status = 'completed' THEN pt.amount ELSE 0 END) as total_points_awarded,
      COUNT(DISTINCT pt.user_id) as unique_users
    FROM point_activities pa
    LEFT JOIN point_transactions pt ON pa.activity_code = pt.activity_type
    GROUP BY pa.id, pa.activity_code, pa.activity_name, pa.points_reward, pa.daily_limit, pa.total_limit, pa.is_active
    ORDER BY total_points_awarded DESC
  `, {
    type: sequelize.QueryTypes.SELECT
  });

  return stats;
};

module.exports = PointActivity;