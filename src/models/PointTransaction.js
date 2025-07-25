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
    defaultValue: 0,
    field: 'balance_before',
    validate: {
      min: 0,
      isInt: true
    }
  },
  balanceAfter: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'balance_after',
    validate: {
      min: 0,
      isInt: true
    }
  },
  activityType: {
    type: DataTypes.STRING(50),
    allowNull: false,
    field: 'activity_type'
  },
  activityDescription: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'activity_description'
  },
  referenceId: {
    type: DataTypes.STRING(100),
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
  metadata: {
    type: DataTypes.JSON,
    allowNull: true
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'expires_at'
  }
}, {
  tableName: 'point_transactions',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  hooks: {
    beforeCreate: (transaction) => {
      // Calculate balance after based on transaction type
      if (transaction.transactionType === 'credit') {
        transaction.balanceAfter = transaction.balanceBefore + transaction.amount;
      } else if (transaction.transactionType === 'debit') {
        transaction.balanceAfter = transaction.balanceBefore - transaction.amount;
        
        // Ensure balance doesn't go negative
        if (transaction.balanceAfter < 0) {
          throw new Error('Insufficient points balance');
        }
      }
    }
  }
});

// Instance methods
PointTransaction.prototype.toSafeJSON = function() {
  const values = Object.assign({}, this.get());
  
  // Format for display
  values.formattedAmount = this.transactionType === 'credit' 
    ? `+${this.amount}` 
    : `-${this.amount}`;
    
  return values;
};

// Static methods
PointTransaction.getUserTransactionHistory = function(userId, options = {}) {
  const {
    page = 1,
    limit = 20,
    activityType,
    transactionType,
    startDate,
    endDate
  } = options;

  const whereClause = { userId };
  
  if (activityType) {
    whereClause.activityType = activityType;
  }
  
  if (transactionType) {
    whereClause.transactionType = transactionType;
  }
  
  if (startDate || endDate) {
    whereClause.createdAt = {};
    if (startDate) whereClause.createdAt[sequelize.Sequelize.Op.gte] = startDate;
    if (endDate) whereClause.createdAt[sequelize.Sequelize.Op.lte] = endDate;
  }

  return this.findAndCountAll({
    where: whereClause,
    order: [['createdAt', 'DESC']],
    limit: parseInt(limit),
    offset: (parseInt(page) - 1) * parseInt(limit)
  });
};

PointTransaction.getUserPointsSummary = async function(userId) {
  const [totalEarned, totalSpent, currentBalance] = await Promise.all([
    // Total points earned (credit)
    this.sum('amount', {
      where: {
        userId,
        transactionType: 'credit',
        status: 'completed'
      }
    }),
    
    // Total points spent (debit)
    this.sum('amount', {
      where: {
        userId,
        transactionType: 'debit',
        status: 'completed'
      }
    }),
    
    // Current balance (latest balance_after)
    this.findOne({
      where: { userId, status: 'completed' },
      order: [['createdAt', 'DESC']],
      attributes: ['balanceAfter']
    })
  ]);

  return {
    totalEarned: totalEarned || 0,
    totalSpent: totalSpent || 0,
    currentBalance: currentBalance ? currentBalance.balanceAfter : 0,
    netPoints: (totalEarned || 0) - (totalSpent || 0)
  };
};

PointTransaction.getSystemPointsStatistics = async function() {
  const [totalPointsIssued, totalPointsRedeemed, activeUsers, topEarners] = await Promise.all([
    // Total points issued
    this.sum('amount', {
      where: {
        transactionType: 'credit',
        status: 'completed'
      }
    }),
    
    // Total points redeemed
    this.sum('amount', {
      where: {
        transactionType: 'debit',
        status: 'completed'
      }
    }),
    
    // Active users with points
    this.count({
      distinct: true,
      col: 'userId',
      where: {
        status: 'completed'
      }
    }),
    
    // Top point earners
    sequelize.query(`
      SELECT 
        u.id, u.username, u.email,
        SUM(CASE WHEN pt.transaction_type = 'credit' THEN pt.amount ELSE 0 END) as total_earned,
        u.current_points
      FROM users u
      LEFT JOIN point_transactions pt ON u.id = pt.user_id AND pt.status = 'completed'
      GROUP BY u.id, u.username, u.email, u.current_points
      HAVING total_earned > 0
      ORDER BY total_earned DESC
      LIMIT 10
    `, {
      type: sequelize.QueryTypes.SELECT
    })
  ]);

  return {
    totalPointsIssued: totalPointsIssued || 0,
    totalPointsRedeemed: totalPointsRedeemed || 0,
    totalPointsInCirculation: (totalPointsIssued || 0) - (totalPointsRedeemed || 0),
    activeUsers: activeUsers || 0,
    topEarners
  };
};

module.exports = PointTransaction;