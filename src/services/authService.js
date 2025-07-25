const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const emailService = require('./emailService');
const { logAuthAttempt, logSecurityEvent } = require('../utils/logger');

class AuthService {
  /**
   * Generate JWT tokens
   * @param {object} user - User object
   * @returns {object} Access and refresh tokens
   */
  generateTokens(user) {
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      iat: Math.floor(Date.now() / 1000)
    };

    const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRE || '24h',
      algorithm: 'HS256'
    });

    const refreshToken = jwt.sign(
      { userId: user.id },
      process.env.JWT_REFRESH_SECRET,
      {
        expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d',
        algorithm: 'HS256'
      }
    );

    return { accessToken, refreshToken };
  }

  /**
   * Register new user
   * @param {object} userData - User registration data
   * @returns {object} Created user and tokens
   */
  async register(userData) {
    const { username, email, phoneNumber, password } = userData;

    try {
      // Check if user already exists
      const existingUser = await User.findOne({
        where: {
          [User.sequelize.Sequelize.Op.or]: [
            { email: email.toLowerCase() },
            { username: username.toLowerCase() }
          ]
        }
      });

      if (existingUser) {
        const field = existingUser.email === email.toLowerCase() ? 'email' : 'username';
        throw new Error(`User with this ${field} already exists`);
      }

      // Create new user (unverified)
      const user = await User.create({
        username: username.toLowerCase(),
        email: email.toLowerCase(),
        phoneNumber,
        passwordHash: password, // Will be hashed by the model hook
        role: 'user',
        isVerified: false,
        isActive: true
      });

      // Generate email verification token
      const verificationToken = user.generateEmailVerificationToken();
      await user.save();

      // Send verification email
      try {
        await emailService.sendEmailVerification(user, verificationToken);
      } catch (emailError) {
        logSecurityEvent('email_verification_send_failed', {
          userId: user.id,
          email: user.email,
          error: emailError.message
        });
        
        // Don't fail registration if email sending fails
        // User can resend verification later
      }

      logAuthAttempt('register', true, {
        userId: user.id,
        username: user.username,
        email: user.email,
        requiresVerification: true
      });

      return {
        user: user.toSafeJSON(),
        message: 'Registration successful. Please check your email to verify your account before logging in.'
      };
    } catch (error) {
      logAuthAttempt('register', false, {
        username,
        email,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Login user
   * @param {string} identifier - Username or email
   * @param {string} password - User password
   * @param {string} ipAddress - Client IP address
   * @returns {object} User and tokens
   */
  async login(identifier, password, ipAddress) {
    try {
      // Find user by email or username
      const user = await User.findByEmailOrUsername(identifier);

      if (!user) {
        logSecurityEvent('login_attempt_invalid_user', {
          identifier,
          ipAddress
        });
        throw new Error('Invalid credentials');
      }

      // Check if account is locked
      if (user.isLocked()) {
        logSecurityEvent('login_attempt_locked_account', {
          userId: user.id,
          ipAddress,
          lockedUntil: user.lockedUntil
        });
        throw new Error('Account is temporarily locked due to too many failed login attempts');
      }

      // Check if account is active
      if (!user.isActive) {
        logSecurityEvent('login_attempt_inactive_account', {
          userId: user.id,
          ipAddress
        });
        throw new Error('Account has been deactivated');
      }

      // Check if email is verified
      if (!user.isVerified) {
        logSecurityEvent('login_attempt_unverified_email', {
          userId: user.id,
          ipAddress
        });
        throw new Error('Please verify your email address before logging in. Check your inbox for verification instructions.');
      }

      // Validate password
      const isPasswordValid = await user.validatePassword(password);

      if (!isPasswordValid) {
        // Increment login attempts
        await user.incrementLoginAttempts();
        
        logSecurityEvent('login_attempt_invalid_password', {
          userId: user.id,
          ipAddress,
          loginAttempts: user.loginAttempts + 1
        });
        
        throw new Error('Invalid credentials');
      }

      // Reset login attempts on successful login
      await user.resetLoginAttempts();

      // Generate tokens
      const tokens = this.generateTokens(user);

      // Save refresh token hash
      await user.setRefreshToken(tokens.refreshToken);

      logAuthAttempt('login', true, {
        userId: user.id,
        ipAddress
      });

      return {
        user: user.toSafeJSON(),
        tokens
      };
    } catch (error) {
      logAuthAttempt('login', false, {
        identifier,
        ipAddress,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Refresh access token
   * @param {string} refreshToken - Refresh token
   * @returns {object} New tokens
   */
  async refreshToken(refreshToken) {
    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

      // Find user
      const user = await User.findByPk(decoded.userId);

      if (!user || !user.isActive) {
        throw new Error('Invalid refresh token');
      }

      // Validate refresh token
      if (!user.validateRefreshToken(refreshToken)) {
        logSecurityEvent('invalid_refresh_token_used', {
          userId: user.id
        });
        throw new Error('Invalid refresh token');
      }

      // Generate new tokens
      const tokens = this.generateTokens(user);

      // Save new refresh token hash
      await user.setRefreshToken(tokens.refreshToken);

      logAuthAttempt('token_refresh', true, {
        userId: user.id
      });

      return {
        user: user.toSafeJSON(),
        tokens
      };
    } catch (error) {
      logAuthAttempt('token_refresh', false, {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Logout user
   * @param {object} user - User object
   * @returns {boolean} Success status
   */
  async logout(user) {
    try {
      // Clear refresh token
      await user.update({ refreshTokenHash: null });

      logAuthAttempt('logout', true, {
        userId: user.id
      });

      return true;
    } catch (error) {
      logAuthAttempt('logout', false, {
        userId: user.id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Change user password
   * @param {object} user - User object
   * @param {string} currentPassword - Current password
   * @param {string} newPassword - New password
   * @returns {boolean} Success status
   */
  async changePassword(user, currentPassword, newPassword) {
    try {
      // Validate current password
      const isCurrentPasswordValid = await user.validatePassword(currentPassword);

      if (!isCurrentPasswordValid) {
        logSecurityEvent('password_change_invalid_current', {
          userId: user.id
        });
        throw new Error('Current password is incorrect');
      }

      // Update password
      await user.update({
        passwordHash: newPassword, // Will be hashed by the model hook
        refreshTokenHash: null // Invalidate all refresh tokens
      });

      logAuthAttempt('password_change', true, {
        userId: user.id
      });

      return true;
    } catch (error) {
      logAuthAttempt('password_change', false, {
        userId: user.id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Verify JWT token
   * @param {string} token - JWT token
   * @returns {object} Decoded token or null
   */
  verifyToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      return null;
    }
  }

  /**
   * Generate password reset token
   * @param {object} user - User object
   * @returns {string} Reset token
   */
  generatePasswordResetToken(user) {
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    
    // Store reset token hash in user record (you may want to add this field to the User model)
    // user.passwordResetToken = resetTokenHash;
    // user.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    
    return resetToken;
  }

  /**
   * Verify email address
   * @param {string} token - Verification token
   * @param {string} email - User email
   * @returns {object} Success message
   */
  async verifyEmail(token, email) {
    try {
      const user = await User.findOne({
        where: { 
          email: email.toLowerCase(),
          isActive: true
        }
      });

      if (!user) {
        throw new Error('Invalid verification request');
      }

      if (user.isVerified) {
        return {
          message: 'Email is already verified. You can now log in to your account.',
          alreadyVerified: true
        };
      }

      if (!user.validateEmailVerificationToken(token)) {
        logSecurityEvent('invalid_email_verification_token', {
          userId: user.id,
          email: user.email
        });
        
        if (user.isEmailVerificationExpired()) {
          throw new Error('Verification link has expired. Please request a new verification email.');
        }
        
        throw new Error('Invalid verification token');
      }

      // Mark email as verified
      await user.markEmailAsVerified();

      // Send welcome email
      try {
        await emailService.sendWelcomeEmail(user);
      } catch (emailError) {
        // Don't fail verification if welcome email fails
        logSecurityEvent('welcome_email_send_failed', {
          userId: user.id,
          error: emailError.message
        });
      }

      logAuthAttempt('email_verification', true, {
        userId: user.id,
        email: user.email
      });

      return {
        message: 'Email verified successfully! You can now log in to your account.',
        user: user.toSafeJSON()
      };
    } catch (error) {
      logAuthAttempt('email_verification', false, {
        email,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Resend email verification
   * @param {string} email - User email
   * @returns {object} Success message
   */
  async resendEmailVerification(email) {
    try {
      const user = await User.findOne({
        where: { 
          email: email.toLowerCase(),
          isActive: true
        }
      });

      if (!user) {
        // Don't reveal if email exists for security
        return {
          message: 'If an account with this email exists and is not verified, a verification email has been sent.'
        };
      }

      if (user.isVerified) {
        return {
          message: 'Email is already verified. You can log in to your account.'
        };
      }

      if (!user.canResendVerificationEmail()) {
        throw new Error('Please wait before requesting another verification email. Check your spam folder.');
      }

      // Generate new verification token
      const verificationToken = user.generateEmailVerificationToken();
      await user.save();

      // Send verification email
      await emailService.sendEmailVerification(user, verificationToken);

      logAuthAttempt('email_verification_resent', true, {
        userId: user.id,
        email: user.email
      });

      return {
        message: 'Verification email has been sent. Please check your inbox and spam folder.'
      };
    } catch (error) {
      logAuthAttempt('email_verification_resent', false, {
        email,
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = new AuthService();