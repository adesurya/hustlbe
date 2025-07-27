const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PointTransaction = sequelize.define('PointTransaction', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'user_id',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  transactionType: {
    type: DataTypes.ENUM('credit', 'debit'),
    allowNull: false,
    field: 'transaction_type'
  },
  amount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 1,
      isInt: true
    }
  },
  balanceBefore: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'balance_before',
    validate: {
      min: 0,
      isInt: true
    }
  },
  balanceAfter: {
    type: DataTypes.VIRTUAL,
    get() {
      const balance = this.balanceBefore;
      const amount = this.amount;
      const type = this.transactionType;
      
      if (type === 'credit') {
        return balance + amount;
      } else {
        return balance - amount;
      }
    }
  },
  activityType: {
    type: DataTypes.STRING(50),
    allowNull: false,
    field: 'activity_type'
  },
  activityDescription: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'activity_description'
  },
  referenceId: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'reference_id'
  },
  referenceType: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'reference_type'
  },
  status: {
    type: DataTypes.ENUM('pending', 'completed', 'failed', 'cancelled'),
    defaultValue: 'completed'
  },
  processedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'processed_by',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  processedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'processed_at',
    defaultValue: DataTypes.NOW
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Additional data related to the transaction'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Administrative notes about the transaction'
  }
}, {
  tableName: 'point_transactions',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      fields: ['user_id']
    },
    {
      fields: ['activity_type']
    },
    {
      fields: ['transaction_type']
    },
    {
      fields: ['status']
    },
    {
      fields: ['created_at']
    },
    {
      fields: ['user_id', 'activity_type']
    },
    {
      fields: ['user_id', 'created_at']
    }
  ]
});

// Instance methods
PointTransaction.prototype.toSafeJSON = function() {
  const values = Object.assign({}, this.get());
  
  // Include the virtual balanceAfter field
  values.balanceAfter = this.balanceAfter;
  
  return values;
};

// Static methods
PointTransaction.getUserTransactions = function(userId, options = {}) {
  const {
    page = 1,
    limit = 20,
    transactionType,
    activityType,
    status = 'completed',
    startDate,
    endDate
  } = options;

  const whereClause = { 
    userId,
    status: status || 'completed'
  };
  
  if (transactionType) {
    whereClause.transactionType = transactionType;
  }
  
  if (activityType) {
    whereClause.activityType = activityType;
  }
  
  if (startDate || endDate) {
    whereClause.created_at = {};
    if (startDate) {
      whereClause.created_at[sequelize.Sequelize.Op.gte] = new Date(startDate);
    }
    if (endDate) {
      whereClause.created_at[sequelize.Sequelize.Op.lte] = new Date(endDate);
    }
  }

  return this.findAndCountAll({
    where: whereClause,
    order: [['created_at', 'DESC']],
    limit: parseInt(limit),
    offset: (parseInt(page) - 1) * parseInt(limit)
  });
};

PointTransaction.getUserPointsSummary = async function(userId) {
  const creditResult = await this.findOne({
    where: { 
      userId, 
      transactionType: 'credit',
      status: 'completed'
    },
    attributes: [
      [sequelize.fn('SUM', sequelize.col('amount')), 'totalCredits'],
      [sequelize.fn('COUNT', sequelize.col('id')), 'creditCount']
    ]
  });

  const debitResult = await this.findOne({
    where: { 
      userId, 
      transactionType: 'debit',
      status: 'completed'
    },
    attributes: [
      [sequelize.fn('SUM', sequelize.col('amount')), 'totalDebits'],
      [sequelize.fn('COUNT', sequelize.col('id')), 'debitCount']
    ]
  });

  const totalCredits = parseInt(creditResult?.dataValues?.totalCredits) || 0;
  const totalDebits = parseInt(debitResult?.dataValues?.totalDebits) || 0;
  const creditCount = parseInt(creditResult?.dataValues?.creditCount) || 0;
  const debitCount = parseInt(debitResult?.dataValues?.debitCount) || 0;

  return {
    totalEarned: totalCredits,
    totalSpent: totalDebits,
    netBalance: totalCredits - totalDebits,
    totalTransactions: creditCount + debitCount,
    creditTransactions: creditCount,
    debitTransactions: debitCount
  };
};

PointTransaction.getActivityStatistics = async function(activityType = null, options = {}) {
  const {
    startDate,
    endDate,
    status = 'completed'
  } = options;

  const whereClause = { status };
  
  if (activityType) {
    whereClause.activityType = activityType;
  }
  
  if (startDate || endDate) {
    whereClause.created_at = {};
    if (startDate) {
      whereClause.created_at[sequelize.Sequelize.Op.gte] = new Date(startDate);
    }
    if (endDate) {
      whereClause.created_at[sequelize.Sequelize.Op.lte] = new Date(endDate);
    }
  }

  const stats = await this.findAll({
    where: whereClause,
    attributes: [
      'activity_type',
      'transaction_type',
      [sequelize.fn('COUNT', sequelize.col('id')), 'transaction_count'],
      [sequelize.fn('SUM', sequelize.col('amount')), 'total_amount'],
      [sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.col('user_id'))), 'unique_users']
    ],
    group: ['activity_type', 'transaction_type'],
    order: [['activity_type', 'ASC'], ['transaction_type', 'ASC']]
  });

  return stats;
};

PointTransaction.getSystemStatistics = async function(options = {}) {
  const {
    startDate,
    endDate,
    status = 'completed'
  } = options;

  const whereClause = { status };
  
  if (startDate || endDate) {
    whereClause.created_at = {};
    if (startDate) {
      whereClause.created_at[sequelize.Sequelize.Op.gte] = new Date(startDate);
    }
    if (endDate) {
      whereClause.created_at[sequelize.Sequelize.Op.lte] = new Date(endDate);
    }
  }

  const [totalStats, activityStats] = await Promise.all([
    this.findOne({
      where: whereClause,
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('id')), 'totalTransactions'],
        [sequelize.fn('SUM', 
          sequelize.literal("CASE WHEN transaction_type = 'credit' THEN amount ELSE 0 END")
        ), 'totalPointsAwarded'],
        [sequelize.fn('SUM', 
          sequelize.literal("CASE WHEN transaction_type = 'debit' THEN amount ELSE 0 END")
        ), 'totalPointsRedeemed'],
        [sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.col('user_id'))), 'activeUsers']
      ]
    }),
    
    this.findAll({
      where: whereClause,
      attributes: [
        'activity_type',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('amount')), 'total'],
        [sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.col('user_id'))), 'users']
      ],
      group: ['activity_type'],
      order: [[sequelize.fn('SUM', sequelize.col('amount')), 'DESC']]
    })
  ]);

  return {
    overview: {
      totalTransactions: parseInt(totalStats?.dataValues?.totalTransactions) || 0,
      totalPointsAwarded: parseInt(totalStats?.dataValues?.totalPointsAwarded) || 0,
      totalPointsRedeemed: parseInt(totalStats?.dataValues?.totalPointsRedeemed) || 0,
      activeUsers: parseInt(totalStats?.dataValues?.activeUsers) || 0,
      netPointsInCirculation: (parseInt(totalStats?.dataValues?.totalPointsAwarded) || 0) - (parseInt(totalStats?.dataValues?.totalPointsRedeemed) || 0)
    },
    byActivity: activityStats.map(stat => ({
      activityType: stat.activity_type,
      transactionCount: parseInt(stat.dataValues.count),
      totalPoints: parseInt(stat.dataValues.total),
      uniqueUsers: parseInt(stat.dataValues.users)
    }))
  };
};

module.exports = PointTransaction;