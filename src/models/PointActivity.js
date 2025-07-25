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
    field: 'activity_code',
    validate: {
      len: [2, 50],
      isUppercase: true,
      is: /^[A-Z_]+$/
    }
  },
  activityName: {
    type: DataTypes.STRING(100),
    allowNull: false,
    field: 'activity_name',
    validate: {
      len: [2, 100],
      notEmpty: true
    }
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
      min: 1,
      isInt: true
    }
  },
  totalLimit: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'total_limit',
    validate: {
      min: 1,
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
  updatedAt: 'updated_at'
});

// Instance methods
PointActivity.prototype.isValidNow = function() {
  const now = new Date();
  
  if (!this.isActive) return false;
  if (this.validFrom && this.validFrom > now) return false;
  if (this.validUntil && this.validUntil < now) return false;
  
  return true;
};

PointActivity.prototype.canUserEarn = async function(userId) {
  if (!this.isValidNow()) {
    return { canEarn: false, reason: 'Activity is not active or not within valid period' };
  }

  const PointTransaction = require('./PointTransaction');
  
  // Check daily limit
  if (this.dailyLimit) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayCount = await PointTransaction.count({
      where: {
        userId,
        activityType: this.activityCode,
        status: 'completed',
        createdAt: {
          [sequelize.Sequelize.Op.gte]: today,
          [sequelize.Sequelize.Op.lt]: tomorrow
        }
      }
    });

    if (todayCount >= this.dailyLimit) {
      return { 
        canEarn: false, 
        reason: `Daily limit of ${this.dailyLimit} reached for this activity`,
        remainingToday: 0
      };
    }
  }

  // Check total limit
  if (this.totalLimit) {
    const totalCount = await PointTransaction.count({
      where: {
        userId,
        activityType: this.activityCode,
        status: 'completed'
      }
    });

    if (totalCount >= this.totalLimit) {
      return { 
        canEarn: false, 
        reason: `Total limit of ${this.totalLimit} reached for this activity`,
        remainingTotal: 0
      };
    }
  }

  return { 
    canEarn: true,
    remainingToday: this.dailyLimit ? this.dailyLimit - (todayCount || 0) : null,
    remainingTotal: this.totalLimit ? this.totalLimit - (totalCount || 0) : null
  };
};

// Static methods
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
    order: [['activityName', 'ASC']]
  });
};

PointActivity.findByCode = function(activityCode) {
  return this.findOne({
    where: { activityCode: activityCode.toUpperCase() }
  });
};

module.exports = PointActivity;