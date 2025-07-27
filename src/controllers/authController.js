const authService = require('../services/authService');
const { 
  successResponse, 
  errorResponse, 
  asyncHandler,
  HTTP_STATUS,
  SUCCESS_CODES,
  ERROR_CODES 
} = require('../utils/response');
const { logSecurityEvent } = require('../utils/logger');

class AuthController {
  /**
   * Register new user
   */
  register = asyncHandler(async (req, res) => {
    const { username, email, phoneNumber, password } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;

    try {
      const result = await authService.register({
        username,
        email,
        phoneNumber,
        password
      });

      logSecurityEvent('user_registration_success', {
        userId: result.user.id,
        username: result.user.username,
        email: result.user.email,
        ipAddress,
        requiresVerification: true
      });

      res.status(HTTP_STATUS.CREATED.code).json(
        successResponse(
          result.message,
          {
            user: result.user,
            requiresEmailVerification: true
          },
          null,
          SUCCESS_CODES.USER_CREATED
        )
      );
    } catch (error) {
      logSecurityEvent('user_registration_failed', {
        username,
        email,
        error: error.message,
        ipAddress
      });

      if (error.message.includes('already exists')) {
        return res.status(HTTP_STATUS.CONFLICT.code).json(
          errorResponse(error.message, ERROR_CODES.RESOURCE_ALREADY_EXISTS)
        );
      }

      res.status(HTTP_STATUS.BAD_REQUEST.code).json(
        errorResponse(error.message, ERROR_CODES.VALIDATION_ERROR)
      );
    }
  });

  /**
   * Login user
   */
  login = asyncHandler(async (req, res) => {
    const { identifier, password } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');

    try {
      const result = await authService.login(identifier, password, ipAddress);

      // Set secure HTTP-only cookie for refresh token
      res.cookie('refreshToken', result.tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      res.status(HTTP_STATUS.OK.code).json(
        successResponse(
          'Login successful',
          {
            user: result.user,
            accessToken: result.tokens.accessToken,
            dailyLoginBonus: result.dailyLoginBonus || null
          },
          null,
          SUCCESS_CODES.LOGIN_SUCCESS
        )
      );
    } catch (error) {
      logSecurityEvent('login_failed', {
        identifier,
        error: error.message,
        ipAddress,
        userAgent
      });

      if (error.message.includes('locked')) {
        return res.status(HTTP_STATUS.UNAUTHORIZED.code).json(
          errorResponse(error.message, ERROR_CODES.ACCOUNT_LOCKED)
        );
      }

      if (error.message.includes('verify your email')) {
        return res.status(HTTP_STATUS.UNAUTHORIZED.code).json(
          errorResponse(error.message, ERROR_CODES.EMAIL_NOT_VERIFIED)
        );
      }

      if (error.message.includes('deactivated')) {
        return res.status(HTTP_STATUS.UNAUTHORIZED.code).json(
          errorResponse(
            'Your account has been deactivated. For more information about your account status, please contact: support@sijago.ai', 
            ERROR_CODES.ACCOUNT_DISABLED,
            { 
              supportContact: 'support@sijago.ai',
              contactReason: 'Account deactivated - requires support assistance'
            }
          )
        );
      }

      res.status(HTTP_STATUS.UNAUTHORIZED.code).json(
        errorResponse('Invalid credentials', ERROR_CODES.INVALID_CREDENTIALS)
      );
    }
  });

  /**
   * Refresh access token
   */
  refreshToken = asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    const cookieRefreshToken = req.cookies?.refreshToken;
    const tokenToUse = refreshToken || cookieRefreshToken;

    if (!tokenToUse) {
      return res.status(HTTP_STATUS.UNAUTHORIZED.code).json(
        errorResponse('Refresh token required', ERROR_CODES.MISSING_TOKEN)
      );
    }

    try {
      const result = await authService.refreshToken(tokenToUse);

      // Update refresh token cookie
      res.cookie('refreshToken', result.tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      res.status(HTTP_STATUS.OK.code).json(
        successResponse(
          'Token refreshed successfully',
          {
            user: result.user,
            accessToken: result.tokens.accessToken
          },
          null,
          SUCCESS_CODES.TOKEN_REFRESHED
        )
      );
    } catch (error) {
      // Clear invalid refresh token cookie
      res.clearCookie('refreshToken');

      res.status(HTTP_STATUS.UNAUTHORIZED.code).json(
        errorResponse('Invalid refresh token', ERROR_CODES.INVALID_TOKEN)
      );
    }
  });

  /**
   * Logout user
   */
  logout = asyncHandler(async (req, res) => {
    try {
      console.log('🚪 Logout request for user:', req.user.id);
      
      // authService.logout now handles token version increment internally
      await authService.logout(req.user);

      // Clear refresh token cookie
      res.clearCookie('refreshToken');

      res.status(HTTP_STATUS.OK.code).json(
        successResponse(
          'Logout successful. All tokens have been invalidated.',
          null,
          null,
          SUCCESS_CODES.LOGOUT_SUCCESS
        )
      );
    } catch (error) {
      console.log('❌ Logout failed:', error.message);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR.code).json(
        errorResponse('Logout failed', ERROR_CODES.INTERNAL_ERROR)
      );
    }
  });

  /**
   * Change password
   */
  changePassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    try {
      await authService.changePassword(req.user, currentPassword, newPassword);

      res.status(HTTP_STATUS.OK.code).json(
        successResponse(
          'Password changed successfully',
          null,
          null,
          SUCCESS_CODES.PASSWORD_CHANGED
        )
      );
    } catch (error) {
      if (error.message.includes('incorrect')) {
        return res.status(HTTP_STATUS.BAD_REQUEST.code).json(
          errorResponse(error.message, ERROR_CODES.INVALID_CREDENTIALS)
        );
      }

      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR.code).json(
        errorResponse('Password change failed', ERROR_CODES.INTERNAL_ERROR)
      );
    }
  });

  /**
   * Get current user profile (Enhanced)
   */
  getProfile = asyncHandler(async (req, res) => {
    try {
      // Get user with additional computed fields
      const user = req.user;
      
      // Create enhanced profile data
      const profileData = {
        ...user.toSafeJSON(),
        // Add computed fields
        isLocked: user.isLocked(),
        canEarnPoints: user.canEarnPoints(),
        accountAge: Math.floor((new Date() - user.createdAt) / (1000 * 60 * 60 * 24)), // days
        // Add verification status
        verificationStatus: {
          email: user.isVerified,
          twoFactor: user.twoFactorEnabled
        },
        // Add account metrics
        metrics: {
          totalPoints: user.currentPoints,
          lastLogin: user.lastLogin,
          memberSince: user.createdAt
        }
      };

      logSecurityEvent('profile_accessed', {
        userId: user.id,
        accessTime: new Date()
      });

      res.status(HTTP_STATUS.OK.code).json(
        successResponse(
          'Profile retrieved successfully',
          { user: profileData }
        )
      );
    } catch (error) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR.code).json(
        errorResponse('Failed to retrieve profile', ERROR_CODES.INTERNAL_ERROR)
      );
    }
  });

  /**
   * Update user profile (Enhanced)
   */
  updateProfile = asyncHandler(async (req, res) => {
    const { username, email, phoneNumber, profilePicture } = req.body;
    const updateData = {};

    // Only include fields that are provided
    if (username) updateData.username = username.toLowerCase();
    if (email) updateData.email = email.toLowerCase();
    if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;
    if (profilePicture !== undefined) updateData.profilePicture = profilePicture;

    try {
      // Check for duplicate username/email if they're being updated
      if (updateData.username || updateData.email) {
        const User = require('../models/User');
        const existingUser = await User.findOne({
          where: {
            [User.sequelize.Sequelize.Op.and]: [
              { id: { [User.sequelize.Sequelize.Op.ne]: req.user.id } },
              {
                [User.sequelize.Sequelize.Op.or]: [
                  updateData.username ? { username: updateData.username } : null,
                  updateData.email ? { email: updateData.email } : null
                ].filter(Boolean)
              }
            ]
          }
        });

        if (existingUser) {
          const field = existingUser.username === updateData.username ? 'username' : 'email';
          return res.status(HTTP_STATUS.CONFLICT.code).json(
            errorResponse(`This ${field} is already taken`, ERROR_CODES.RESOURCE_ALREADY_EXISTS)
          );
        }
      }

      // If email is being updated, mark as unverified and send verification
      if (updateData.email && updateData.email !== req.user.email) {
        updateData.isVerified = false;
        updateData.emailVerifiedAt = null;
        
        // Generate new verification token
        const verificationToken = req.user.generateEmailVerificationToken();
        updateData.emailVerificationToken = req.user.emailVerificationToken;
        updateData.emailVerificationExpires = req.user.emailVerificationExpires;
        updateData.emailVerificationSentAt = req.user.emailVerificationSentAt;
        
        // Send verification email to new address
        try {
          const emailService = require('../services/emailService');
          const tempUser = { ...req.user.toJSON(), ...updateData };
          await emailService.sendEmailVerification(tempUser, verificationToken);
        } catch (emailError) {
          logSecurityEvent('email_verification_send_failed', {
            userId: req.user.id,
            newEmail: updateData.email,
            error: emailError.message
          });
        }
      }

      await req.user.update(updateData);

      // Create enhanced response data
      const responseData = {
        ...req.user.toSafeJSON(),
        isLocked: req.user.isLocked(),
        canEarnPoints: req.user.canEarnPoints(),
        accountAge: Math.floor((new Date() - req.user.createdAt) / (1000 * 60 * 60 * 24))
      };

      logSecurityEvent('profile_updated', {
        userId: req.user.id,
        updatedFields: Object.keys(updateData),
        emailChanged: !!updateData.email
      });

      res.status(HTTP_STATUS.OK.code).json(
        successResponse(
          updateData.email ? 
            'Profile updated successfully. Please verify your new email address.' : 
            'Profile updated successfully',
          { 
            user: responseData,
            emailVerificationRequired: !!updateData.email
          },
          null,
          SUCCESS_CODES.PROFILE_UPDATED
        )
      );
    } catch (error) {
      res.status(HTTP_STATUS.BAD_REQUEST.code).json(
        errorResponse(error.message, ERROR_CODES.VALIDATION_ERROR)
      );
    }
  });

  /**
   * Google OAuth callback
   */
  googleCallback = asyncHandler(async (req, res) => {
    const user = req.user;
    
    if (!user) {
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_failed`);
    }

    try {
      // Generate tokens for the authenticated user
      const tokens = authService.generateTokens(user);
      
      // Save refresh token
      await user.setRefreshToken(tokens.refreshToken);

      // Set secure cookie
      res.cookie('refreshToken', tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      // Redirect to frontend with access token
      res.redirect(`${process.env.FRONTEND_URL}/oauth/success?token=${tokens.accessToken}`);
    } catch (error) {
      logSecurityEvent('google_oauth_callback_error', {
        userId: user.id,
        error: error.message
      });
      
      res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_callback_failed`);
    }
  });

  /**
   * Verify email address
   */
  verifyEmail = asyncHandler(async (req, res) => {
    const { token, email } = req.query;

    if (!token || !email) {
      return res.status(HTTP_STATUS.BAD_REQUEST.code).json(
        errorResponse('Token and email are required', ERROR_CODES.MISSING_REQUIRED_FIELD)
      );
    }

    try {
      const result = await authService.verifyEmail(token, email);

      res.status(HTTP_STATUS.OK.code).json(
        successResponse(
          result.message,
          {
            user: result.user,
            alreadyVerified: result.alreadyVerified || false,
            pointsAwarded: result.pointsAwarded || null
          },
          null,
          SUCCESS_CODES.EMAIL_VERIFIED
        )
      );
    } catch (error) {
      if (error.message.includes('expired')) {
        return res.status(HTTP_STATUS.BAD_REQUEST.code).json(
          errorResponse(error.message, ERROR_CODES.TOKEN_EXPIRED)
        );
      }

      if (error.message.includes('Invalid')) {
        return res.status(HTTP_STATUS.BAD_REQUEST.code).json(
          errorResponse(error.message, ERROR_CODES.INVALID_TOKEN)
        );
      }

      res.status(HTTP_STATUS.BAD_REQUEST.code).json(
        errorResponse(error.message, ERROR_CODES.VALIDATION_ERROR)
      );
    }
  });

  /**
   * Resend email verification
   */
  resendEmailVerification = asyncHandler(async (req, res) => {
    const { email } = req.body;

    if (!email) {
      return res.status(HTTP_STATUS.BAD_REQUEST.code).json(
        errorResponse('Email is required', ERROR_CODES.MISSING_REQUIRED_FIELD)
      );
    }

    try {
      const result = await authService.resendEmailVerification(email);

      res.status(HTTP_STATUS.OK.code).json(
        successResponse(
          result.message,
          null,
          null,
          SUCCESS_CODES.EMAIL_VERIFICATION_SENT
        )
      );
    } catch (error) {
      if (error.message.includes('wait')) {
        return res.status(HTTP_STATUS.TOO_MANY_REQUESTS.code).json(
          errorResponse(error.message, ERROR_CODES.RATE_LIMIT_EXCEEDED)
        );
      }

      res.status(HTTP_STATUS.BAD_REQUEST.code).json(
        errorResponse(error.message, ERROR_CODES.VALIDATION_ERROR)
      );
    }
  });

  /**
   * Get user profile by ID (Own profile or Admin access)
   */
  getUserProfileById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const requestingUserId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    // Check if user is accessing their own profile or is admin
    if (!isAdmin && parseInt(id) !== requestingUserId) {
      logSecurityEvent('unauthorized_profile_access_attempt', {
        requestingUserId,
        targetUserId: id,
        ipAddress: req.ip
      });
      
      return res.status(HTTP_STATUS.FORBIDDEN.code).json(
        errorResponse('Access denied. You can only view your own profile.', ERROR_CODES.ACCESS_DENIED)
      );
    }

    try {
      const User = require('../models/User');
      const user = await User.findByPk(id, {
        attributes: { exclude: ['passwordHash', 'refreshTokenHash', 'twoFactorSecret', 'emailVerificationToken'] },
        paranoid: false // Include soft deleted users for admin
      });

      if (!user) {
        return res.status(HTTP_STATUS.NOT_FOUND.code).json(
          errorResponse('User not found', ERROR_CODES.RESOURCE_NOT_FOUND)
        );
      }

      // For regular users viewing their own profile, ensure account is active
      if (!isAdmin && !user.isActive) {
        return res.status(HTTP_STATUS.FORBIDDEN.code).json(
          errorResponse('Account is deactivated', ERROR_CODES.ACCOUNT_DISABLED)
        );
      }

      // Create profile data based on access level
      let profileData = user.toJSON();
      
      // For non-admin users viewing their own profile, hide admin-only fields
      if (!isAdmin) {
        delete profileData.loginAttempts;
        delete profileData.lockedUntil;
        delete profileData.tokenVersion;
        delete profileData.deletedAt;
        delete profileData.emailVerificationToken;
        delete profileData.emailVerificationExpires;
        delete profileData.emailVerificationSentAt;
      }

      // Add computed fields
      profileData.isLocked = user.isLocked();
      profileData.canEarnPoints = user.canEarnPoints();
      profileData.accountAge = Math.floor((new Date() - user.createdAt) / (1000 * 60 * 60 * 24));

      // Add verification status
      profileData.verificationStatus = {
        email: user.isVerified,
        twoFactor: user.twoFactorEnabled
      };

      // Add account metrics
      profileData.metrics = {
        totalPoints: user.currentPoints,
        lastLogin: user.lastLogin,
        memberSince: user.createdAt
      };

      logSecurityEvent('profile_accessed_by_id', {
        targetUserId: id,
        accessedBy: requestingUserId,
        isAdminAccess: isAdmin,
        isOwnProfile: parseInt(id) === requestingUserId
      });

      res.status(HTTP_STATUS.OK.code).json(
        successResponse(
          isAdmin && parseInt(id) !== requestingUserId ? 
            'User profile retrieved successfully (Admin access)' : 
            'Your profile retrieved successfully',
          { user: profileData }
        )
      );
    } catch (error) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR.code).json(
        errorResponse('Failed to retrieve profile', ERROR_CODES.INTERNAL_ERROR)
      );
    }
  });

  /**
   * Get public user profile by ID (Limited public information)
   */
  getPublicProfile = asyncHandler(async (req, res) => {
    const { id } = req.params;

    try {
      const User = require('../models/User');
      const user = await User.findByPk(id, {
        attributes: [
          'id', 
          'username', 
          'profilePicture', 
          'createdAt',
          'isActive',
          'isVerified'
        ]
      });

      if (!user || !user.isActive || !user.isVerified) {
        return res.status(HTTP_STATUS.NOT_FOUND.code).json(
          errorResponse('User not found or profile not public', ERROR_CODES.RESOURCE_NOT_FOUND)
        );
      }

      // Create limited public profile data (no sensitive information)
      const publicProfile = {
        id: user.id,
        username: user.username,
        profilePicture: user.profilePicture,
        memberSince: user.createdAt,
        isVerified: user.isVerified,
        accountAge: Math.floor((new Date() - user.createdAt) / (1000 * 60 * 60 * 24)) // days
      };

      // Log public profile access (optional, for analytics)
      logSecurityEvent('public_profile_accessed', {
        targetUserId: id,
        accessorIp: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.status(HTTP_STATUS.OK.code).json(
        successResponse(
          'Public profile retrieved successfully',
          { user: publicProfile }
        )
      );
    } catch (error) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR.code).json(
        errorResponse('Failed to retrieve public profile', ERROR_CODES.INTERNAL_ERROR)
      );
    }
  });
}

module.exports = new AuthController();