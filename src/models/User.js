const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { sequelize } = require('../config/database');

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
      isAlphanumeric: true,
      notEmpty: true
    }
  },
  email: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true,
      len: [5, 100],
      notEmpty: true
    }
  },
  phoneNumber: {
    type: DataTypes.STRING(20),
    allowNull: true,
    field: 'phone_number',
    validate: {
      is: /^[+]?[\d\s\-()]+$/
    }
  },
  passwordHash: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'password_hash'
  },
  role: {
    type: DataTypes.ENUM('admin', 'user'),
    defaultValue: 'user',
    allowNull: false
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
    field: 'profile_picture',
    validate: {
      isUrl: true
    }
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
  refreshTokenHash: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'refresh_token_hash'
  }
}, {
  tableName: 'users',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  hooks: {
    beforeCreate: async (user) => {
      if (user.passwordHash) {
        user.passwordHash = await bcrypt.hash(user.passwordHash, parseInt(process.env.BCRYPT_ROUNDS) || 12);
        user.passwordChangedAt = new Date();
      }
    },
    beforeUpdate: async (user) => {
      if (user.changed('passwordHash')) {
        user.passwordHash = await bcrypt.hash(user.passwordHash, parseInt(process.env.BCRYPT_ROUNDS) || 12);
        user.passwordChangedAt = new Date();
      }
    }
  }
});

// Instance methods
User.prototype.validatePassword = async function(password) {
  if (!this.passwordHash) return false;
  return bcrypt.compare(password, this.passwordHash);
};

User.prototype.isLocked = function() {
  return !!(this.lockedUntil && this.lockedUntil > Date.now());
};

User.prototype.incrementLoginAttempts = async function() {
  const maxAttempts = parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5;
  const lockoutTime = parseInt(process.env.LOCKOUT_TIME) || 30 * 60 * 1000; // 30 minutes
  
  if (this.lockedUntil && this.lockedUntil < Date.now()) {
    return this.update({
      loginAttempts: 1,
      lockedUntil: null
    });
  }
  
  const updates = { loginAttempts: this.loginAttempts + 1 };
  
  if (this.loginAttempts + 1 >= maxAttempts && !this.isLocked()) {
    updates.lockedUntil = new Date(Date.now() + lockoutTime);
  }
  
  return this.update(updates);
};

User.prototype.resetLoginAttempts = async function() {
  return this.update({
    loginAttempts: 0,
    lockedUntil: null,
    lastLogin: new Date()
  });
};

User.prototype.generateRefreshToken = function() {
  return crypto.randomBytes(32).toString('hex');
};

User.prototype.setRefreshToken = async function(token) {
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  return this.update({ refreshTokenHash: hash });
};

User.prototype.validateRefreshToken = function(token) {
  if (!this.refreshTokenHash) return false;
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  return hash === this.refreshTokenHash;
};

User.prototype.generateEmailVerificationToken = function() {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  
  this.emailVerificationToken = crypto.createHash('sha256').update(token).digest('hex');
  this.emailVerificationExpires = expires;
  this.emailVerificationSentAt = new Date();
  
  return token; // Return plain token for email
};

User.prototype.validateEmailVerificationToken = function(token) {
  if (!this.emailVerificationToken || !this.emailVerificationExpires) {
    return false;
  }
  
  // Check if token has expired
  if (this.emailVerificationExpires < new Date()) {
    return false;
  }
  
  // Hash the provided token and compare
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
  return hashedToken === this.emailVerificationToken;
};

User.prototype.markEmailAsVerified = async function() {
  return this.update({
    isVerified: true,
    emailVerifiedAt: new Date(),
    emailVerificationToken: null,
    emailVerificationExpires: null
  });
};

User.prototype.isEmailVerificationExpired = function() {
  if (!this.emailVerificationExpires) return true;
  return this.emailVerificationExpires < new Date();
};

User.prototype.toSafeJSON = function() {
  const values = Object.assign({}, this.get());
  delete values.passwordHash;
  delete values.refreshTokenHash;
  delete values.twoFactorSecret;
  delete values.loginAttempts;
  delete values.lockedUntil;
  delete values.emailVerificationToken;
  return values;
};

// Static methods
User.findByEmailOrUsername = function(identifier) {
  return this.findOne({
    where: {
      [sequelize.Sequelize.Op.or]: [
        { email: identifier.toLowerCase() },
        { username: identifier.toLowerCase() }
      ]
    }
  });
};

User.findByGoogleId = function(googleId) {
  return this.findOne({
    where: { googleId }
  });
};

module.exports = User;