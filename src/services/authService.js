const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const emailService = require('./emailService');
const pointService = require('./pointService'); // Add point service
const { logAuthAttempt, logSecurityEvent } = require('../utils/logger');

class AuthService {
  /**
   * Generate JWT tokens with token version
   * @param {object} user - User object
   * @returns {object} Access and refresh tokens
   */
  generateTokens(user) {
    // Ensure tokenVersion is a number, default to 0 if null/undefined
    const currentTokenVersion = user.tokenVersion !== null && user.tokenVersion !== undefined ? user.tokenVersion : 0;
    
    console.log('🔐 Generating tokens for user:', {
      userId: user.id,
      currentTokenVersion: currentTokenVersion,
      userTokenVersion: user.tokenVersion,
      userTokenVersionType: typeof user.tokenVersion
    });

    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      tokenVersion: currentTokenVersion, // Explicitly include token version
      iat: Math.floor(Date.now() / 1000)
    };

    console.log('🔐 Token payload:', payload);

    const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRE || '15m',
      algorithm: 'HS256'
    });

    const refreshToken = jwt.sign(
      { 
        userId: user.id,
        tokenVersion: currentTokenVersion // Also include in refresh token
      },
      process.env.JWT_REFRESH_SECRET,
      {
        expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d',
        algorithm: 'HS256'
      }
    );

    // Debug: Verify the tokens contain tokenVersion
    try {
      const decodedAccess = jwt.decode(accessToken);
      const decodedRefresh = jwt.decode(refreshToken);
      
      console.log('🔍 Generated token verification:', {
        accessTokenVersion: decodedAccess.tokenVersion,
        refreshTokenVersion: decodedRefresh.tokenVersion,
        expectedVersion: currentTokenVersion,
        accessTokenVersionType: typeof decodedAccess.tokenVersion,
        refreshTokenVersionType: typeof decodedRefresh.tokenVersion
      });
      
      // Additional check - verify token can be decoded properly
      if (decodedAccess.tokenVersion === undefined) {
        console.error('❌ CRITICAL: Access token tokenVersion is undefined!');
        console.error('❌ User object:', JSON.stringify(user.toJSON(), null, 2));
        console.error('❌ Payload:', JSON.stringify(payload, null, 2));
      }
      
    } catch (error) {
      console.error('❌ Token decode error:', error);
    }

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

      // Create new user (unverified) with explicit tokenVersion
      const user = await User.create({
        username: username.toLowerCase(),
        email: email.toLowerCase(),
        phoneNumber,
        passwordHash: password, // Will be hashed by the model hook
        role: 'user',
        isVerified: false,
        isActive: true,
        tokenVersion: 0 // Explicitly set initial token version
      });

      // Reload user to ensure all fields are populated
      await user.reload();

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
      }

      logAuthAttempt('register', true, {
        userId: user.id,
        username: user.username,
        email: user.email,
        requiresVerification: true,
        tokenVersion: user.tokenVersion
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
   * Login user with daily login bonus
   * @param {string} identifier - Username or email
   * @param {string} password - User password
   * @param {string} ipAddress - Client IP address
   * @returns {object} User and tokens
   */
  async login(identifier, password, ipAddress) {
    try {
      console.log('🔍 Login attempt:', { identifier, ipAddress });
      
      // Find user by email or username
      let user = await User.findByEmailOrUsername(identifier);
      console.log('👤 User found:', user ? `ID: ${user.id}, Email: ${user.email}, Username: ${user.username}, TokenVersion: ${user.tokenVersion}` : 'No user found');

      if (!user) {
        logSecurityEvent('login_attempt_invalid_user', {
          identifier,
          ipAddress
        });
        throw new Error('Invalid credentials');
      }

      // Ensure tokenVersion is not null - fix if needed
      if (user.tokenVersion === null || user.tokenVersion === undefined) {
        console.log('🔧 Fixing null tokenVersion for user:', user.id);
        await user.update({ tokenVersion: 0 });
        // Reload user to get fresh data
        await user.reload();
        console.log('🔧 Fixed tokenVersion:', user.tokenVersion);
      }

      // Check if account is locked
      if (user.isLocked()) {
        console.log('🔒 Account is locked until:', user.lockedUntil);
        logSecurityEvent('login_attempt_locked_account', {
          userId: user.id,
          ipAddress,
          lockedUntil: user.lockedUntil
        });
        throw new Error('Account is temporarily locked due to too many failed login attempts');
      }

      // Check if account is active
      if (!user.isActive) {
        console.log('❌ Account is not active');
        logSecurityEvent('login_attempt_inactive_account', {
          userId: user.id,
          ipAddress
        });
        throw new Error('Account has been deactivated');
      }

      // Check if email is verified
      if (!user.isVerified) {
        console.log('📧 Email is not verified');
        logSecurityEvent('login_attempt_unverified_email', {
          userId: user.id,
          ipAddress
        });
        throw new Error('Please verify your email address before logging in. Check your inbox for verification instructions.');
      }

      // Validate password
      console.log('🔐 Validating password...');
      const isPasswordValid = await user.validatePassword(password);
      console.log('🔐 Password validation result:', isPasswordValid);

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

      // IMPORTANT: Reload user again to ensure we have the latest tokenVersion
      await user.reload();
      console.log('🔄 User reloaded before token generation. TokenVersion:', user.tokenVersion);

      // Generate tokens with current token version
      const tokens = this.generateTokens(user);

      // Save refresh token hash
      await user.setRefreshToken(tokens.refreshToken);

      // NEW: Award daily login points (if eligible)
      let dailyLoginResult = null;
      try {
        console.log('🎯 Checking daily login bonus eligibility...');
        const hasLoggedInToday = await pointService.hasCompletedActivityToday(user.id, 'DAILY_LOGIN');
        
        if (!hasLoggedInToday) {
          console.log('🎁 User eligible for daily login bonus');
          dailyLoginResult = await pointService.awardDailyLoginPoints(user.id);
          console.log('🎁 Daily login result:', dailyLoginResult);
        } else {
          console.log('⏰ User already received daily login bonus today');
        }
      } catch (pointError) {
        console.error('❌ Error awarding daily login points:', pointError);
        // Don't throw error - login should still succeed even if points fail
        logSecurityEvent('daily_login_points_error', {
          userId: user.id,
          error: pointError.message
        });
      }

      logAuthAttempt('login', true, {
        userId: user.id,
        ipAddress,
        tokenVersion: user.tokenVersion,
        dailyLoginBonus: dailyLoginResult?.awarded || false
      });

      console.log('✅ Login successful for user:', user.id, 'with token version:', user.tokenVersion);

      const response = {
        user: user.toSafeJSON(),
        tokens
      };

      // Add daily login bonus info to response if awarded
      if (dailyLoginResult?.awarded) {
        response.dailyLoginBonus = {
          awarded: true,
          points: dailyLoginResult.points,
          message: dailyLoginResult.message
        };
      }

      return response;
    } catch (error) {
      console.log('❌ Login failed:', error.message);
      logAuthAttempt('login', false, {
        identifier,
        ipAddress,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Refresh access token with version validation
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

      // Ensure tokenVersion is not null
      if (user.tokenVersion === null || user.tokenVersion === undefined) {
        await user.update({ tokenVersion: 0 });
        await user.reload();
      }

      // Check token version - if different, refresh token is invalid
      const userTokenVersion = user.tokenVersion || 0;
      const decodedTokenVersion = decoded.tokenVersion || 0;
      
      if (decodedTokenVersion !== userTokenVersion) {
        logSecurityEvent('invalid_refresh_token_version', {
          userId: user.id,
          decodedVersion: decodedTokenVersion,
          currentVersion: userTokenVersion
        });
        throw new Error('Invalid refresh token - please log in again');
      }

      // Validate refresh token
      if (!user.validateRefreshToken(refreshToken)) {
        logSecurityEvent('invalid_refresh_token_used', {
          userId: user.id
        });
        throw new Error('Invalid refresh token');
      }

      // Generate new tokens with current token version
      const tokens = this.generateTokens(user);

      // Save new refresh token hash
      await user.setRefreshToken(tokens.refreshToken);

      logAuthAttempt('token_refresh', true, {
        userId: user.id,
        tokenVersion: user.tokenVersion
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
   * Logout user by invalidating all tokens
   * @param {object} user - User object
   * @returns {boolean} Success status
   */
  async logout(user) {
    try {
      // Invalidate all tokens by incrementing token version
      await user.invalidateAllTokens('logout');

      logAuthAttempt('logout', true, {
        userId: user.id,
        newTokenVersion: user.tokenVersion
      });

      console.log('✅ Logout successful for user:', user.id, 'New token version:', user.tokenVersion);

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
   * Change user password and invalidate all tokens
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
      });

      // Invalidate all tokens by incrementing token version
      await user.invalidateAllTokens('password_change');

      logAuthAttempt('password_change', true, {
        userId: user.id,
        newTokenVersion: user.tokenVersion
      });

      console.log('✅ Password changed for user:', user.id, 'New token version:', user.tokenVersion);

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
    
    return resetToken;
  }

  /**
   * Verify email address with point reward
   * @param {string} token - Verification token
   * @param {string} email - User email
   * @returns {object} Success message with point info
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

      // NEW: Award points for email verification
      let pointsResult = null;
      try {
        console.log('🎯 Awarding email verification points...');
        pointsResult = await pointService.awardEmailVerificationPoints(user.id);
        console.log('🎁 Email verification points result:', pointsResult);
      } catch (pointError) {
        console.error('❌ Error awarding email verification points:', pointError);
        // Don't throw error - verification should still succeed even if points fail
        logSecurityEvent('email_verification_points_error', {
          userId: user.id,
          error: pointError.message
        });
      }

      // Send welcome email
      try {
        await emailService.sendWelcomeEmail(user);
      } catch (emailError) {
        logSecurityEvent('welcome_email_send_failed', {
          userId: user.id,
          error: emailError.message
        });
      }

      logAuthAttempt('email_verification', true, {
        userId: user.id,
        email: user.email,
        pointsAwarded: pointsResult?.awarded || false
      });

      const response = {
        message: 'Email verified successfully! You can now log in to your account.',
        user: user.toSafeJSON()
      };

      // Add points info to response if awarded
      if (pointsResult?.awarded) {
        response.pointsAwarded = {
          points: pointsResult.points,
          message: pointsResult.message,
          newBalance: pointsResult.newBalance
        };
      }

      return response;
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