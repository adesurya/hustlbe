const User = require('../models/User');
const { 
  successResponse, 
  errorResponse, 
  asyncHandler,
  HTTP_STATUS,
  SUCCESS_CODES,
  ERROR_CODES 
} = require('../utils/response');
const { logSecurityEvent } = require('../utils/logger');
const { Op } = require('sequelize');

class UserController {
  /**
   * Get all users (Admin only)
   * @route GET /api/v1/users
   */
  getAllUsers = asyncHandler(async (req, res) => {
    const { 
      page = 1, 
      limit = 20, 
      search = '', 
      role = '',
      status = '',
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const whereClause = {};

    // Search filter
    if (search) {
      whereClause[Op.or] = [
        { username: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } }
      ];
    }

    // Role filter
    if (role && ['admin', 'user'].includes(role)) {
      whereClause.role = role;
    }

    // Status filter
    if (status) {
      if (status === 'active') {
        whereClause.isActive = true;
      } else if (status === 'inactive') {
        whereClause.isActive = false;
      } else if (status === 'verified') {
        whereClause.isVerified = true;
      } else if (status === 'unverified') {
        whereClause.isVerified = false;
      }
    }

    try {
      const { count, rows: users } = await User.findAndCountAll({
        where: whereClause,
        attributes: { exclude: ['passwordHash', 'refreshTokenHash', 'twoFactorSecret', 'emailVerificationToken'] },
        order: [[sortBy, sortOrder.toUpperCase()]],
        limit: parseInt(limit),
        offset,
        paranoid: false // Include soft deleted users
      });

      const totalPages = Math.ceil(count / parseInt(limit));

      logSecurityEvent('admin_users_list_accessed', {
        adminId: req.user.id,
        filters: { search, role, status, sortBy, sortOrder },
        resultCount: users.length
      });

      res.status(HTTP_STATUS.OK.code).json(
        successResponse(
          'Users retrieved successfully',
          {
            users: users.map(user => ({
              ...user.toJSON(),
              // Add computed fields safely
              isLocked: user.isLocked ? user.isLocked() : false,
              canEarnPoints: user.canEarnPoints ? user.canEarnPoints() : false,
              accountAge: Math.floor((new Date() - user.createdAt) / (1000 * 60 * 60 * 24)) // days
            })),
            pagination: {
              currentPage: parseInt(page),
              totalPages,
              totalUsers: count,
              hasNext: parseInt(page) < totalPages,
              hasPrev: parseInt(page) > 1
            }
          }
        )
      );
    } catch (error) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR.code).json(
        errorResponse('Failed to retrieve users', ERROR_CODES.INTERNAL_ERROR)
      );
    }
  });

  /**
   * Get user by ID (Admin or own profile)
   * @route GET /api/v1/users/:id
   */
  getUserById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const requestingUserId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    // Check if user is accessing their own profile or is admin
    if (!isAdmin && parseInt(id) !== requestingUserId) {
      return res.status(HTTP_STATUS.FORBIDDEN.code).json(
        errorResponse('Access denied. You can only view your own profile.', ERROR_CODES.ACCESS_DENIED)
      );
    }

    try {
      const user = await User.findByPk(id, {
        attributes: { exclude: ['passwordHash', 'refreshTokenHash', 'twoFactorSecret', 'emailVerificationToken'] },
        paranoid: false // Include soft deleted users for admin
      });

      if (!user) {
        return res.status(HTTP_STATUS.NOT_FOUND.code).json(
          errorResponse('User not found', ERROR_CODES.RESOURCE_NOT_FOUND)
        );
      }

      // For non-admin users, hide sensitive admin fields
      let userData = user.toJSON();
      if (!isAdmin) {
        delete userData.loginAttempts;
        delete userData.lockedUntil;
        delete userData.tokenVersion;
        delete userData.deletedAt;
      }

      // Add computed fields safely
      userData.isLocked = user.isLocked ? user.isLocked() : false;
      userData.canEarnPoints = user.canEarnPoints ? user.canEarnPoints() : false;
      userData.accountAge = Math.floor((new Date() - user.createdAt) / (1000 * 60 * 60 * 24));

      logSecurityEvent('user_profile_accessed', {
        accessedUserId: id,
        accessedBy: requestingUserId,
        isAdminAccess: isAdmin
      });

      res.status(HTTP_STATUS.OK.code).json(
        successResponse(
          'User profile retrieved successfully',
          { user: userData }
        )
      );
    } catch (error) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR.code).json(
        errorResponse('Failed to retrieve user', ERROR_CODES.INTERNAL_ERROR)
      );
    }
  });

  /**
   * Create new user (Admin only)
   * @route POST /api/v1/users
   */
  createUser = asyncHandler(async (req, res) => {
    const { 
      username, 
      email, 
      phoneNumber, 
      password, 
      role = 'user',
      isVerified = false,
      isActive = true,
      currentPoints = 0
    } = req.body;

    try {
      // Check if user already exists
      const existingUser = await User.findOne({
        where: {
          [Op.or]: [
            { email: email.toLowerCase() },
            { username: username.toLowerCase() }
          ]
        },
        paranoid: false
      });

      if (existingUser) {
        const field = existingUser.email === email.toLowerCase() ? 'email' : 'username';
        return res.status(HTTP_STATUS.CONFLICT.code).json(
          errorResponse(`User with this ${field} already exists`, ERROR_CODES.RESOURCE_ALREADY_EXISTS)
        );
      }

      // Create new user
      const user = await User.create({
        username: username.toLowerCase(),
        email: email.toLowerCase(),
        phoneNumber,
        passwordHash: password, // Will be hashed by model hook
        role,
        isVerified,
        isActive,
        currentPoints,
        tokenVersion: 0
      });

      logSecurityEvent('admin_user_created', {
        adminId: req.user.id,
        createdUserId: user.id,
        createdUserEmail: user.email,
        assignedRole: role
      });

      res.status(HTTP_STATUS.CREATED.code).json(
        successResponse(
          'User created successfully',
          { user: user.toSafeJSON ? user.toSafeJSON() : user.toJSON() },
          null,
          SUCCESS_CODES.USER_CREATED
        )
      );
    } catch (error) {
      res.status(HTTP_STATUS.BAD_REQUEST.code).json(
        errorResponse(error.message, ERROR_CODES.VALIDATION_ERROR)
      );
    }
  });

  /**
   * Update user (Admin only)
   * @route PUT /api/v1/users/:id
   */
  updateUser = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updateData = req.body;

    // Remove sensitive fields that shouldn't be updated directly
    delete updateData.passwordHash;
    delete updateData.refreshTokenHash;
    delete updateData.tokenVersion;
    delete updateData.emailVerificationToken;

    try {
      const user = await User.findByPk(id);

      if (!user) {
        return res.status(HTTP_STATUS.NOT_FOUND.code).json(
          errorResponse('User not found', ERROR_CODES.RESOURCE_NOT_FOUND)
        );
      }

      // Check for duplicate username/email if they're being updated
      if (updateData.username || updateData.email) {
        const existingUser = await User.findOne({
          where: {
            [Op.and]: [
              { id: { [Op.ne]: id } },
              {
                [Op.or]: [
                  updateData.username ? { username: updateData.username.toLowerCase() } : null,
                  updateData.email ? { email: updateData.email.toLowerCase() } : null
                ].filter(Boolean)
              }
            ]
          },
          paranoid: false
        });

        if (existingUser) {
          const field = existingUser.username === updateData.username?.toLowerCase() ? 'username' : 'email';
          return res.status(HTTP_STATUS.CONFLICT.code).json(
            errorResponse(`This ${field} is already taken`, ERROR_CODES.RESOURCE_ALREADY_EXISTS)
          );
        }
      }

      // Prepare update data
      const cleanUpdateData = {};
      const allowedFields = [
        'username', 'email', 'phoneNumber', 'role', 'profilePicture',
        'isVerified', 'isActive', 'currentPoints', 'twoFactorEnabled'
      ];

      allowedFields.forEach(field => {
        if (updateData[field] !== undefined) {
          if (field === 'username' || field === 'email') {
            cleanUpdateData[field] = updateData[field].toLowerCase();
          } else {
            cleanUpdateData[field] = updateData[field];
          }
        }
      });

      await user.update(cleanUpdateData);

      logSecurityEvent('admin_user_updated', {
        adminId: req.user.id,
        updatedUserId: user.id,
        updatedFields: Object.keys(cleanUpdateData)
      });

      res.status(HTTP_STATUS.OK.code).json(
        successResponse(
          'User updated successfully',
          { user: user.toSafeJSON ? user.toSafeJSON() : user.toJSON() },
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
   * Soft delete user (Admin only)
   * @route DELETE /api/v1/users/:id
   */
  deleteUser = asyncHandler(async (req, res) => {
    const { id } = req.params;

    try {
      const user = await User.findByPk(id);

      if (!user) {
        return res.status(HTTP_STATUS.NOT_FOUND.code).json(
          errorResponse('User not found', ERROR_CODES.RESOURCE_NOT_FOUND)
        );
      }

      // Prevent admin from deleting themselves
      if (parseInt(id) === req.user.id) {
        return res.status(HTTP_STATUS.BAD_REQUEST.code).json(
          errorResponse('You cannot delete your own account', ERROR_CODES.INVALID_OPERATION)
        );
      }

      // Soft delete
      await user.destroy();

      logSecurityEvent('admin_user_deleted', {
        adminId: req.user.id,
        deletedUserId: user.id,
        deletedUserEmail: user.email
      });

      res.status(HTTP_STATUS.OK.code).json(
        successResponse(
          'User deleted successfully',
          null,
          null,
          SUCCESS_CODES.RESOURCE_DELETED
        )
      );
    } catch (error) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR.code).json(
        errorResponse('Failed to delete user', ERROR_CODES.INTERNAL_ERROR)
      );
    }
  });

  /**
   * Restore deleted user (Admin only)
   * @route PATCH /api/v1/users/:id/restore
   */
  restoreUser = asyncHandler(async (req, res) => {
    const { id } = req.params;

    try {
      const user = await User.findByPk(id, { paranoid: false });

      if (!user) {
        return res.status(HTTP_STATUS.NOT_FOUND.code).json(
          errorResponse('User not found', ERROR_CODES.RESOURCE_NOT_FOUND)
        );
      }

      if (!user.deletedAt) {
        return res.status(HTTP_STATUS.BAD_REQUEST.code).json(
          errorResponse('User is not deleted', ERROR_CODES.INVALID_OPERATION)
        );
      }

      await user.restore();

      logSecurityEvent('admin_user_restored', {
        adminId: req.user.id,
        restoredUserId: user.id,
        restoredUserEmail: user.email
      });

      res.status(HTTP_STATUS.OK.code).json(
        successResponse(
          'User restored successfully',
          { user: user.toSafeJSON ? user.toSafeJSON() : user.toJSON() }
        )
      );
    } catch (error) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR.code).json(
        errorResponse('Failed to restore user', ERROR_CODES.INTERNAL_ERROR)
      );
    }
  });

  /**
   * Reset user password (Admin only)
   * @route PATCH /api/v1/users/:id/reset-password
   */
  resetUserPassword = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 8) {
      return res.status(HTTP_STATUS.BAD_REQUEST.code).json(
        errorResponse('New password must be at least 8 characters long', ERROR_CODES.VALIDATION_ERROR)
      );
    }

    try {
      const user = await User.findByPk(id);

      if (!user) {
        return res.status(HTTP_STATUS.NOT_FOUND.code).json(
          errorResponse('User not found', ERROR_CODES.RESOURCE_NOT_FOUND)
        );
      }

      // Update password and invalidate all tokens
      await user.update({
        passwordHash: newPassword // Will be hashed by model hook
      });

      // Invalidate all user tokens
      if (user.invalidateAllTokens) {
        await user.invalidateAllTokens('admin_password_reset');
      }

      logSecurityEvent('admin_password_reset', {
        adminId: req.user.id,
        targetUserId: user.id,
        targetUserEmail: user.email
      });

      res.status(HTTP_STATUS.OK.code).json(
        successResponse(
          'Password reset successfully. User will need to log in again.',
          null,
          null,
          SUCCESS_CODES.PASSWORD_CHANGED
        )
      );
    } catch (error) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR.code).json(
        errorResponse('Failed to reset password', ERROR_CODES.INTERNAL_ERROR)
      );
    }
  });

  /**
   * Unlock user account (Admin only)
   * @route PATCH /api/v1/users/:id/unlock
   */
  unlockUser = asyncHandler(async (req, res) => {
    const { id } = req.params;

    try {
      const user = await User.findByPk(id);

      if (!user) {
        return res.status(HTTP_STATUS.NOT_FOUND.code).json(
          errorResponse('User not found', ERROR_CODES.RESOURCE_NOT_FOUND)
        );
      }

      if (!user.isLocked || !user.isLocked()) {
        return res.status(HTTP_STATUS.BAD_REQUEST.code).json(
          errorResponse('User account is not locked', ERROR_CODES.INVALID_OPERATION)
        );
      }

      if (user.resetLoginAttempts) {
        await user.resetLoginAttempts();
      } else {
        // Fallback if method doesn't exist
        await user.update({
          loginAttempts: 0,
          lockedUntil: null
        });
      }

      logSecurityEvent('admin_user_unlocked', {
        adminId: req.user.id,
        unlockedUserId: user.id,
        unlockedUserEmail: user.email
      });

      res.status(HTTP_STATUS.OK.code).json(
        successResponse(
          'User account unlocked successfully',
          { user: user.toSafeJSON ? user.toSafeJSON() : user.toJSON() }
        )
      );
    } catch (error) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR.code).json(
        errorResponse('Failed to unlock user', ERROR_CODES.INTERNAL_ERROR)
      );
    }
  });

  /**
   * Toggle user status (activate/deactivate) (Admin only)
   * @route PATCH /api/v1/users/:id/toggle-status
   */
  toggleUserStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;

    try {
      const user = await User.findByPk(id);

      if (!user) {
        return res.status(HTTP_STATUS.NOT_FOUND.code).json(
          errorResponse('User not found', ERROR_CODES.RESOURCE_NOT_FOUND)
        );
      }

      // Prevent admin from deactivating themselves
      if (parseInt(id) === req.user.id) {
        return res.status(HTTP_STATUS.BAD_REQUEST.code).json(
          errorResponse('You cannot deactivate your own account', ERROR_CODES.INVALID_OPERATION)
        );
      }

      const newStatus = !user.isActive;
      await user.update({ isActive: newStatus });

      // If deactivating, invalidate all tokens
      if (!newStatus && user.invalidateAllTokens) {
        await user.invalidateAllTokens('admin_account_deactivated');
      }

      logSecurityEvent('admin_user_status_toggled', {
        adminId: req.user.id,
        targetUserId: user.id,
        targetUserEmail: user.email,
        newStatus: newStatus ? 'active' : 'inactive'
      });

      res.status(HTTP_STATUS.OK.code).json(
        successResponse(
          `User ${newStatus ? 'activated' : 'deactivated'} successfully`,
          { user: user.toSafeJSON ? user.toSafeJSON() : user.toJSON() }
        )
      );
    } catch (error) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR.code).json(
        errorResponse('Failed to toggle user status', ERROR_CODES.INTERNAL_ERROR)
      );
    }
  });

  /**
   * Ban user (Deactivate account) (Admin only)
   * @route PATCH /api/v1/users/:id/ban
   */
  banUser = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { reason = 'Account banned by administrator', notifyUser = true } = req.body;

    try {
      const user = await User.findByPk(id);

      if (!user) {
        return res.status(HTTP_STATUS.NOT_FOUND.code).json(
          errorResponse('User not found', ERROR_CODES.RESOURCE_NOT_FOUND)
        );
      }

      // Prevent admin from banning themselves
      if (parseInt(id) === req.user.id) {
        return res.status(HTTP_STATUS.BAD_REQUEST.code).json(
          errorResponse('You cannot ban your own account', ERROR_CODES.INVALID_OPERATION)
        );
      }

      // Check if user is already banned
      if (!user.isActive) {
        return res.status(HTTP_STATUS.BAD_REQUEST.code).json(
          errorResponse('User is already banned', ERROR_CODES.INVALID_OPERATION)
        );
      }

      // Ban the user (deactivate account)
      await user.update({
        isActive: false,
        lockedUntil: null, // Clear any temporary locks since this is permanent
        loginAttempts: 0   // Reset login attempts
      });

      // Invalidate all user tokens to force immediate logout
      if (user.invalidateAllTokens) {
        await user.invalidateAllTokens('account_banned');
      }

      // Send notification email if requested
      if (notifyUser) {
        try {
          const emailService = require('../services/emailService');
          await emailService.sendAccountBannedNotification(user, reason);
        } catch (emailError) {
          console.error('Failed to send ban notification email:', emailError);
          // Don't fail the ban operation if email fails
        }
      }

      logSecurityEvent('admin_user_banned', {
        adminId: req.user.id,
        bannedUserId: user.id,
        bannedUserEmail: user.email,
        reason: reason,
        notificationSent: notifyUser
      });

      res.status(HTTP_STATUS.OK.code).json(
        successResponse(
          'User has been banned successfully',
          {
            user: user.toSafeJSON ? user.toSafeJSON() : user.toJSON(),
            bannedAt: new Date(),
            reason: reason,
            notificationSent: notifyUser,
            supportContact: 'support@sijago.ai'
          }
        )
      );
    } catch (error) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR.code).json(
        errorResponse('Failed to ban user', ERROR_CODES.INTERNAL_ERROR)
      );
    }
  });

  /**
   * Unban user (Reactivate account) (Admin only)
   * @route PATCH /api/v1/users/:id/unban
   */
  unbanUser = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { reason = 'Account reactivated by administrator', notifyUser = true } = req.body;

    try {
      const user = await User.findByPk(id);

      if (!user) {
        return res.status(HTTP_STATUS.NOT_FOUND.code).json(
          errorResponse('User not found', ERROR_CODES.RESOURCE_NOT_FOUND)
        );
      }

      // Check if user is actually banned
      if (user.isActive) {
        return res.status(HTTP_STATUS.BAD_REQUEST.code).json(
          errorResponse('User is not banned', ERROR_CODES.INVALID_OPERATION)
        );
      }

      // Unban the user (reactivate account)
      await user.update({
        isActive: true,
        loginAttempts: 0,
        lockedUntil: null
      });

      // Send notification email if requested
      if (notifyUser) {
        try {
          const emailService = require('../services/emailService');
          await emailService.sendAccountReactivatedNotification(user, reason);
        } catch (emailError) {
          console.error('Failed to send reactivation notification email:', emailError);
          // Don't fail the unban operation if email fails
        }
      }

      logSecurityEvent('admin_user_unbanned', {
        adminId: req.user.id,
        unbannedUserId: user.id,
        unbannedUserEmail: user.email,
        reason: reason,
        notificationSent: notifyUser
      });

      res.status(HTTP_STATUS.OK.code).json(
        successResponse(
          'User has been unbanned successfully',
          {
            user: user.toSafeJSON ? user.toSafeJSON() : user.toJSON(),
            unbannedAt: new Date(),
            reason: reason,
            notificationSent: notifyUser
          }
        )
      );
    } catch (error) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR.code).json(
        errorResponse('Failed to unban user', ERROR_CODES.INTERNAL_ERROR)
      );
    }
  });

  /**
   * Get banned users list (Admin only) - FIXED WITH RAW QUERY
   * @route GET /api/v1/users/banned
   */
  getBannedUsers = asyncHandler(async (req, res) => {
    const { 
      page = 1, 
      limit = 20, 
      search = '',
      sortBy = 'updated_at',
      sortOrder = 'DESC'
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    try {
      const { sequelize } = require('../config/database');
      
      // Build WHERE clause for search
      let searchClause = '';
      let replacements = { isActive: false, limit: parseInt(limit), offset: offset };
      
      if (search) {
        searchClause = 'AND (username LIKE :search OR email LIKE :search)';
        replacements.search = `%${search}%`;
      }

      // Build ORDER BY clause - ensure valid column names
      const validSortColumns = ['id', 'username', 'email', 'created_at', 'updated_at', 'is_active'];
      const safeSortBy = validSortColumns.includes(sortBy) ? sortBy : 'updated_at';
      const safeSortOrder = ['ASC', 'DESC'].includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';

      // Count query
      const countQuery = `
        SELECT COUNT(*) as total 
        FROM users 
        WHERE deleted_at IS NULL 
        AND is_active = :isActive
        ${searchClause}
      `;

      // Data query - using actual database column names
      const dataQuery = `
        SELECT 
          id, 
          username, 
          email, 
          phone_number as phoneNumber,
          role,
          google_id as googleId,
          profile_picture as profilePicture,
          is_verified as isVerified,
          is_active as isActive,
          login_attempts as loginAttempts,
          locked_until as lockedUntil,
          last_login as lastLogin,
          password_changed_at as passwordChangedAt,
          email_verified_at as emailVerifiedAt,
          two_factor_enabled as twoFactorEnabled,
          current_points as currentPoints,
          created_at as createdAt,
          updated_at as updatedAt
        FROM users 
        WHERE deleted_at IS NULL 
        AND is_active = :isActive
        ${searchClause}
        ORDER BY ${safeSortBy} ${safeSortOrder}
        LIMIT :limit OFFSET :offset
      `;

      // Execute queries
      const [countResult] = await sequelize.query(countQuery, {
        replacements,
        type: sequelize.QueryTypes.SELECT
      });

      const users = await sequelize.query(dataQuery, {
        replacements,
        type: sequelize.QueryTypes.SELECT
      });

      const totalBannedUsers = countResult.total;
      const totalPages = Math.ceil(totalBannedUsers / parseInt(limit));

      logSecurityEvent('admin_banned_users_list_accessed', {
        adminId: req.user.id,
        filters: { search, sortBy: safeSortBy, sortOrder: safeSortOrder },
        resultCount: users.length
      });

      res.status(HTTP_STATUS.OK.code).json(
        successResponse(
          'Banned users retrieved successfully',
          {
            bannedUsers: users.map(user => ({
              ...user,
              // Add computed fields
              accountAge: Math.floor((new Date() - new Date(user.createdAt)) / (1000 * 60 * 60 * 24)),
              bannedDuration: Math.floor((new Date() - new Date(user.updatedAt)) / (1000 * 60 * 60 * 24)),
              // Convert date strings to proper dates
              createdAt: new Date(user.createdAt),
              updatedAt: new Date(user.updatedAt),
              lastLogin: user.lastLogin ? new Date(user.lastLogin) : null,
              lockedUntil: user.lockedUntil ? new Date(user.lockedUntil) : null,
              passwordChangedAt: user.passwordChangedAt ? new Date(user.passwordChangedAt) : null,
              emailVerifiedAt: user.emailVerifiedAt ? new Date(user.emailVerifiedAt) : null
            })),
            pagination: {
              currentPage: parseInt(page),
              totalPages,
              totalBannedUsers,
              hasNext: parseInt(page) < totalPages,
              hasPrev: parseInt(page) > 1
            },
            supportContact: 'support@sijago.ai'
          }
        )
      );
    } catch (error) {
      console.error('getBannedUsers error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR.code).json(
        errorResponse('Failed to retrieve banned users', ERROR_CODES.INTERNAL_ERROR)
      );
    }
  });

  /**
   * Check ban status for a user (Admin only) - FIXED WITH RAW QUERY
   * @route GET /api/v1/users/:id/ban-status
   */
  getUserBanStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;

    try {
      const { sequelize } = require('../config/database');
      
      // Use raw query to avoid field mapping issues
      const query = `
        SELECT 
          id, 
          username, 
          email, 
          is_active as isActive, 
          created_at as createdAt,
          updated_at as updatedAt
        FROM users 
        WHERE deleted_at IS NULL 
        AND id = :userId
      `;

      const [user] = await sequelize.query(query, {
        replacements: { userId: id },
        type: sequelize.QueryTypes.SELECT
      });

      if (!user) {
        return res.status(HTTP_STATUS.NOT_FOUND.code).json(
          errorResponse('User not found', ERROR_CODES.RESOURCE_NOT_FOUND)
        );
      }

      const banStatus = {
        userId: user.id,
        username: user.username,
        email: user.email,
        isBanned: !user.isActive,
        isActive: user.isActive,
        accountCreated: new Date(user.createdAt),
        lastStatusChange: new Date(user.updatedAt),
        supportContact: 'support@sijago.ai'
      };

      if (!user.isActive) {
        banStatus.bannedDuration = Math.floor((new Date() - new Date(user.updatedAt)) / (1000 * 60 * 60 * 24));
        banStatus.message = 'Account is currently banned. For more information about your account status, please contact: support@sijago.ai';
      }

      res.status(HTTP_STATUS.OK.code).json(
        successResponse(
          'User ban status retrieved successfully',
          { banStatus }
        )
      );
    } catch (error) {
      console.error('getUserBanStatus error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR.code).json(
        errorResponse('Failed to retrieve ban status', ERROR_CODES.INTERNAL_ERROR)
      );
    }
  });

  /**
   * Get user statistics (Admin only)
   * @route GET /api/v1/users/statistics
   */
  getUserStatistics = asyncHandler(async (req, res) => {
    try {
      const { sequelize } = require('../config/database');
      
      // Use raw queries to avoid field mapping issues
      const queries = [
        // Total users
        'SELECT COUNT(*) as count FROM users WHERE deleted_at IS NULL',
        // Active users
        'SELECT COUNT(*) as count FROM users WHERE deleted_at IS NULL AND is_active = true',
        // Verified users
        'SELECT COUNT(*) as count FROM users WHERE deleted_at IS NULL AND is_verified = true',
        // Admin users
        'SELECT COUNT(*) as count FROM users WHERE deleted_at IS NULL AND role = "admin"',
        // Locked users
        'SELECT COUNT(*) as count FROM users WHERE deleted_at IS NULL AND locked_until > NOW()',
        // Users registered this month
        `SELECT COUNT(*) as count FROM users 
         WHERE deleted_at IS NULL 
         AND created_at >= DATE_FORMAT(NOW(), '%Y-%m-01')`,
        // Deleted users
        'SELECT COUNT(*) as count FROM users WHERE deleted_at IS NOT NULL',
        // Banned users (inactive but not deleted)
        'SELECT COUNT(*) as count FROM users WHERE deleted_at IS NULL AND is_active = false'
      ];

      const results = await Promise.all(
        queries.map(query => 
          sequelize.query(query, { type: sequelize.QueryTypes.SELECT })
            .then(result => result[0].count)
        )
      );

      const statistics = {
        totalUsers: results[0],
        activeUsers: results[1],
        verifiedUsers: results[2],
        adminUsers: results[3],
        lockedUsers: results[4],
        newUsersThisMonth: results[5],
        deletedUsers: results[6],
        bannedUsers: results[7],
        inactiveUsers: results[0] - results[1],
        unverifiedUsers: results[0] - results[2],
        regularUsers: results[0] - results[3]
      };

      res.status(HTTP_STATUS.OK.code).json(
        successResponse(
          'User statistics retrieved successfully',
          { statistics }
        )
      );
    } catch (error) {
      console.error('getUserStatistics error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR.code).json(
        errorResponse('Failed to retrieve statistics', ERROR_CODES.INTERNAL_ERROR)
      );
    }
  });
}

module.exports = new UserController();