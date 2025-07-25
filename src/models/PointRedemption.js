const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PointRedemption = sequelize.define('PointRedemption', {
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
  pointsRedeemed: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'points_redeemed',
    validate: {
      min: 1,
      isInt: true
    }
  },
  redemptionType: {
    type: DataTypes.STRING(50),
    allowNull: false,
    field: 'redemption_type'
  },
  redemptionValue: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true,
    field: 'redemption_value'
  },
  redemptionDetails: {
    type: DataTypes.JSON,
    allowNull: true,
    field: 'redemption_details'
  },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected', 'completed', 'cancelled'),
    defaultValue: 'pending'
  },
  requestedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'requested_at'
  },
  processedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'processed_at'
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
  adminNotes: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'admin_notes'
  },
  transactionId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'transaction_id',
    references: {
      model: 'point_transactions',
      key: 'id'
    }
  }
}, {
  tableName: 'point_redemptions',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// Instance methods
PointRedemption.prototype.approve = async function(adminId, adminNotes = null) {
  const PointTransaction = require('./PointTransaction');
  const User = require('./User');

  if (this.status !== 'pending') {
    throw new Error('Only pending redemptions can be approved');
  }

  // Get user's current points
  const user = await User.findByPk(this.userId);
  if (!user) {
    throw new Error('User not found');
  }

  if (user.currentPoints < this.pointsRedeemed) {
    throw new Error('User has insufficient points for this redemption');
  }

  const transaction = await sequelize.transaction();

  try {
    // Create debit transaction
    const pointTransaction = await PointTransaction.create({
      userId: this.userId,
      transactionType: 'debit',
      amount: this.pointsRedeemed,
      balanceBefore: user.currentPoints,
      activityType: 'REDEMPTION',
      activityDescription: `Points redeemed for ${this.redemptionType}`,
      referenceId: this.id.toString(),
      referenceType: 'redemption',
      processedBy: adminId,
      metadata: {
        redemptionType: this.redemptionType,
        redemptionDetails: this.redemptionDetails
      }
    }, { transaction });

    // Update redemption status
    await this.update({
      status: 'approved',
      processedAt: new Date(),
      processedBy: adminId,
      adminNotes,
      transactionId: pointTransaction.id
    }, { transaction });

    await transaction.commit();
    return this;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

PointRedemption.prototype.reject = async function(adminId, adminNotes) {
  if (this.status !== 'pending') {
    throw new Error('Only pending redemptions can be rejected');
  }

  return this.update({
    status: 'rejected',
    processedAt: new Date(),
    processedBy: adminId,
    adminNotes
  });
};

PointRedemption.prototype.cancel = async function() {
  if (!['pending', 'approved'].includes(this.status)) {
    throw new Error('Only pending or approved redemptions can be cancelled');
  }

  const updates = {
    status: 'cancelled',
    processedAt: new Date()
  };

  // If redemption was approved, we need to refund the points
  if (this.status === 'approved' && this.transactionId) {
    const PointTransaction = require('./PointTransaction');
    const User = require('./User');

    const user = await User.findByPk(this.userId);
    if (user) {
      // Create credit transaction to refund points
      await PointTransaction.create({
        userId: this.userId,
        transactionType: 'credit',
        amount: this.pointsRedeemed,
        balanceBefore: user.currentPoints,
        activityType: 'REFUND',
        activityDescription: `Points refunded from cancelled redemption`,
        referenceId: this.id.toString(),
        referenceType: 'redemption_refund',
        metadata: {
          originalRedemptionId: this.id,
          redemptionType: this.redemptionType
        }
      });
    }
  }

  return this.update(updates);
};

// Static methods
PointRedemption.getUserRedemptions = function(userId, options = {}) {
  const {
    page = 1,
    limit = 20,
    status,
    redemptionType
  } = options;

  const whereClause = { userId };
  
  if (status) {
    whereClause.status = status;
  }
  
  if (redemptionType) {
    whereClause.redemptionType = redemptionType;
  }

  return this.findAndCountAll({
    where: whereClause,
    order: [['requestedAt', 'DESC']],
    limit: parseInt(limit),
    offset: (parseInt(page) - 1) * parseInt(limit)
  });
};

PointRedemption.getAllRedemptions = function(options = {}) {
  const {
    page = 1,
    limit = 20,
    status,
    redemptionType,
    userId
  } = options;

  const whereClause = {};
  
  if (status) {
    whereClause.status = status;
  }
  
  if (redemptionType) {
    whereClause.redemptionType = redemptionType;
  }
  
  if (userId) {
    whereClause.userId = userId;
  }

  const User = require('./User');

  return this.findAndCountAll({
    where: whereClause,
    include: [{
      model: User,
      as: 'user',
      attributes: ['id', 'username', 'email']
    }],
    order: [['requestedAt', 'DESC']],
    limit: parseInt(limit),
    offset: (parseInt(page) - 1) * parseInt(limit)
  });
};

module.exports = PointRedemption;