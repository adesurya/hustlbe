const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  username: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    validate: {
      len: [3, 50],
      is: /^[a-zA-Z0-9_]+$/
    }
  },
  email: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true,
      len: [5, 100]
    }
  },
  phoneNumber: {
    type: DataTypes.STRING(20),
    allowNull: true,
    field: 'phone_number',
    validate: {
      is: /^[\+]?[1-9][\d]{0,15}$/
    }
  },
  passwordHash: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'password_hash'
  },
  role: {
    type: DataTypes.ENUM('admin', 'user'),
    defaultValue: 'user'
  },
  googleId: {
    type: DataTypes.STRING(255),
    allowNull: true,
    unique: true,
    field: 'google_id'
  },
  profilePicture: {
    type: DataTypes.STRING(500),
    allowNull: true,
    field: 'profile_picture'
  },
  isVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_verified'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active'
  },
  loginAttempts: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'login_attempts'
  },
  lockedUntil: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'locked_until'
  },
  lastLogin: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'last_login'
  },
  passwordChangedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'password_changed_at'
  },
  emailVerifiedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'email_verified_at'
  },
  twoFactorSecret: {
    type: DataTypes.STRING(32),
    allowNull: true,
    field: 'two_factor_secret'
  },
  twoFactorEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'two_factor_enabled'
  },
  currentPoints: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'current_points',
    validate: {
      min: 0,
      isInt: true
    }
  },
  emailVerificationToken: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'email_verification_token'
  },
  emailVerificationExpires: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'email_verification_expires'
  },
  emailVerificationSentAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'email_verification_sent_at'
  },
  refreshTokenHash: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'refresh_token_hash'
  },
  // Token version field for invalidating tokens
  tokenVersion: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'token_version',
    comment: 'Incremented on logout/password change to invalidate old tokens'
  }
}, {
  tableName: 'users',
  timestamps: true,
  // FIXED: Use the actual database column names
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  paranoid: true,
  deletedAt: 'deleted_at',
  // Ensure proper field mapping for ordering
  defaultScope: {},
  scopes: {},
  hooks: {
    beforeCreate: async (user) => {
      if (user.passwordHash) {
        user.passwordHash = await bcrypt.hash(user.passwordHash, 12);
      }
    },
    beforeUpdate: async (user) => {
      if (user.changed('passwordHash') && user.passwordHash) {
        user.passwordHash = await bcrypt.hash(user.passwordHash, 12);
        user.passwordChangedAt = new Date(); // Ensure it's a Date object
      }
    },
    afterFind: (result) => {
      // Ensure date fields are proper Date objects
      if (result) {
        const users = Array.isArray(result) ? result : [result];
        users.forEach(user => {
          if (user && user.dataValues) {
            // Handle various date field formats
            const dateFields = ['passwordChangedAt', 'emailVerifiedAt', 'lastLogin', 'lockedUntil', 'createdAt', 'updatedAt'];
            dateFields.forEach(field => {
              if (user.dataValues[field] && typeof user.dataValues[field] === 'string') {
                user.dataValues[field] = new Date(user.dataValues[field]);
              }
            });
          }
        });
      }
    }
  }
});

// Instance methods
User.prototype.comparePassword = async function(password) {
  if (!this.passwordHash) return false;
  return bcrypt.compare(password, this.passwordHash);
};

// ADD: Missing method that authService.js expects
User.prototype.validatePassword = async function(password) {
  return this.comparePassword(password);
};

User.prototype.isLocked = function() {
  return this.lockedUntil && this.lockedUntil > new Date();
};

User.prototype.incrementLoginAttempts = async function() {
  const maxAttempts = parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5;
  const lockTime = parseInt(process.env.ACCOUNT_LOCK_TIME) || 2 * 60 * 60 * 1000; // 2 hours

  this.loginAttempts += 1;

  if (this.loginAttempts >= maxAttempts && !this.isLocked()) {
    this.lockedUntil = new Date(Date.now() + lockTime);
  }

  return this.save();
};

User.prototype.resetLoginAttempts = async function() {
  this.loginAttempts = 0;
  this.lockedUntil = null;
  this.lastLogin = new Date();
  return this.save();
};

// Method to invalidate all tokens by incrementing version
User.prototype.invalidateAllTokens = async function(reason = 'logout') {
  this.tokenVersion = (this.tokenVersion || 0) + 1;
  this.refreshTokenHash = null; // Also clear refresh token
  
  console.log(`🔄 Invalidating all tokens for user ${this.id}. New token version: ${this.tokenVersion}. Reason: ${reason}`);
  
  return this.save();
};

User.prototype.toSafeJSON = function() {
  const values = Object.assign({}, this.get());
  delete values.passwordHash;
  delete values.refreshTokenHash;
  delete values.twoFactorSecret;
  delete values.emailVerificationToken;
  delete values.tokenVersion; // Don't expose token version to client
  return values;
};

User.prototype.canEarnPoints = function() {
  return this.isActive && this.isVerified;
};

User.prototype.addPoints = async function(amount, transaction = null) {
  const options = transaction ? { transaction } : {};
  this.currentPoints += amount;
  return this.save(options);
};

User.prototype.deductPoints = async function(amount, transaction = null) {
  if (this.currentPoints < amount) {
    throw new Error('Insufficient points balance');
  }
  
  const options = transaction ? { transaction } : {};
  this.currentPoints -= amount;
  return this.save(options);
};

// Email verification methods
User.prototype.generateEmailVerificationToken = function() {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  this.emailVerificationToken = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
  this.emailVerificationExpires = expires;
  this.emailVerificationSentAt = new Date();

  return token;
};

User.prototype.validateEmailVerificationToken = function(token) {
  if (!token || !this.emailVerificationToken || !this.emailVerificationExpires) {
    return false;
  }

  if (new Date() > this.emailVerificationExpires) {
    return false;
  }

  const hashedToken = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');

  return hashedToken === this.emailVerificationToken;
};

User.prototype.isEmailVerificationExpired = function() {
  return this.emailVerificationExpires && new Date() > this.emailVerificationExpires;
};

User.prototype.markEmailAsVerified = async function() {
  this.isVerified = true;
  this.emailVerifiedAt = new Date();
  this.emailVerificationToken = null;
  this.emailVerificationExpires = null;
  return this.save();
};

User.prototype.canResendVerificationEmail = function() {
  if (!this.emailVerificationSentAt) {
    return true;
  }

  const waitTime = 2 * 60 * 1000; // 2 minutes
  return new Date() - this.emailVerificationSentAt > waitTime;
};

// Refresh token methods
User.prototype.setRefreshToken = async function(refreshToken) {
  this.refreshTokenHash = await bcrypt.hash(refreshToken, 10);
  return this.save();
};

User.prototype.validateRefreshToken = async function(refreshToken) {
  if (!this.refreshTokenHash || !refreshToken) {
    return false;
  }
  return bcrypt.compare(refreshToken, this.refreshTokenHash);
};

// Static methods
User.findByEmail = function(email) {
  return this.findOne({ where: { email } });
};

User.findByUsername = function(username) {
  return this.findOne({ where: { username } });
};

// Method that authService.js expects
User.findByEmailOrUsername = function(identifier) {
  const lowerIdentifier = identifier.toLowerCase().trim();
  
  return this.findOne({
    where: {
      [sequelize.Sequelize.Op.or]: [
        { email: lowerIdentifier },
        { username: lowerIdentifier }
      ]
    }
  });
};

User.findByGoogleId = function(googleId) {
  return this.findOne({ where: { googleId } });
};

User.findByEmailVerificationToken = function(token) {
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
  
  return this.findOne({ 
    where: { 
      emailVerificationToken: hashedToken,
      emailVerificationExpires: {
        [sequelize.Sequelize.Op.gt]: new Date()
      }
    }
  });
};

User.getUsersWithPoints = function(options = {}) {
  const {
    page = 1,
    limit = 20,
    minPoints = 0,
    orderBy = 'current_points',
    orderDirection = 'DESC'
  } = options;

  return this.findAndCountAll({
    where: {
      currentPoints: {
        [sequelize.Sequelize.Op.gte]: minPoints
      },
      isActive: true
    },
    attributes: ['id', 'username', 'email', 'currentPoints', 'created_at'],
    order: [[orderBy, orderDirection]],
    limit: parseInt(limit),
    offset: (parseInt(page) - 1) * parseInt(limit)
  });
};

User.getTopPointUsers = function(limit = 10) {
  return this.findAll({
    where: {
      currentPoints: {
        [sequelize.Sequelize.Op.gt]: 0
      },
      isActive: true
    },
    attributes: ['id', 'username', 'email', 'currentPoints'],
    order: [['current_points', 'DESC']],
    limit: parseInt(limit)
  });
};

User.getTotalPointsInSystem = async function() {
  const result = await this.sum('currentPoints', {
    where: {
      isActive: true
    }
  });
  
  return result || 0;
};

module.exports = User;