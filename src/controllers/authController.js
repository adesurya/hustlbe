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
            accessToken: result.tokens.accessToken
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
          errorResponse(error.message, ERROR_CODES.ACCOUNT_DISABLED)
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
      await authService.logout(req.user);

      // Clear refresh token cookie
      res.clearCookie('refreshToken');

      res.status(HTTP_STATUS.OK.code).json(
        successResponse(
          'Logout successful',
          null,
          null,
          SUCCESS_CODES.LOGOUT_SUCCESS
        )
      );
    } catch (error) {
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
   * Get current user profile
   */
  getProfile = asyncHandler(async (req, res) => {
    res.status(HTTP_STATUS.OK.code).json(
      successResponse(
        'Profile retrieved successfully',
        { user: req.user.toSafeJSON() }
      )
    );
  });

  /**
   * Update user profile
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

      await req.user.update(updateData);

      res.status(HTTP_STATUS.OK.code).json(
        successResponse(
          'Profile updated successfully',
          { user: req.user.toSafeJSON() },
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
            alreadyVerified: result.alreadyVerified || false
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
}

module.exports = new AuthController();