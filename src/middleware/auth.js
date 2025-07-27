const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { createResponse } = require('../utils/response');
const winston = require('winston');

// Verify JWT token with token version validation
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json(
        createResponse(false, 'Access token required', null, 'MISSING_TOKEN')
      );
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('🔍 Token decoded:', { 
      userId: decoded.userId, 
      tokenVersion: decoded.tokenVersion, 
      iat: decoded.iat, 
      exp: decoded.exp 
    });
    
    // Check if user still exists
    const user = await User.findByPk(decoded.userId);
    if (!user) {
      console.log('❌ User not found:', decoded.userId);
      return res.status(401).json(
        createResponse(false, 'User no longer exists', null, 'USER_NOT_FOUND')
      );
    }

    console.log('👤 Current user:', { 
      id: user.id, 
      tokenVersion: user.tokenVersion, 
      isActive: user.isActive 
    });

    // Check if user is active
    if (!user.isActive) {
      console.log('❌ Account deactivated for user:', user.id);
      return res.status(401).json(
        createResponse(false, 'Account has been deactivated', null, 'ACCOUNT_DEACTIVATED')
      );
    }

    // MAIN CHECK: Validate token version
    const userTokenVersion = user.tokenVersion || 0;
    const decodedTokenVersion = decoded.tokenVersion || 0;
    
    // If user has null tokenVersion, fix it
    if (user.tokenVersion === null || user.tokenVersion === undefined) {
      console.log('🔧 Fixing null tokenVersion for user:', user.id);
      try {
        await user.update({ tokenVersion: 0 });
        await user.reload();
      } catch (updateError) {
        console.error('❌ Failed to update tokenVersion:', updateError);
      }
    }
    
    if (decodedTokenVersion !== userTokenVersion) {
      console.log('❌ Token version mismatch:', {
        decodedVersion: decodedTokenVersion,
        currentVersion: userTokenVersion,
        userId: user.id,
        originalDecodedVersion: decoded.tokenVersion,
        originalUserVersion: user.tokenVersion
      });
      
      winston.warn(`Token version mismatch for user ${user.id}. Token: ${decodedTokenVersion}, Current: ${userTokenVersion}`);
      
      return res.status(401).json(
        createResponse(false, 'Token has been invalidated. Please log in again.', null, 'TOKEN_INVALIDATED')
      );
    }

    // Additional check: Password change validation (backup security)
    if (user.passwordChangedAt) {
      let passwordChangedTimestamp;
      
      // Handle both Date object and string
      if (user.passwordChangedAt instanceof Date) {
        passwordChangedTimestamp = parseInt(user.passwordChangedAt.getTime() / 1000, 10);
      } else if (typeof user.passwordChangedAt === 'string') {
        passwordChangedTimestamp = parseInt(new Date(user.passwordChangedAt).getTime() / 1000, 10);
      } else {
        // If it's already a timestamp
        passwordChangedTimestamp = parseInt(user.passwordChangedAt, 10);
      }
      
      if (decoded.iat < passwordChangedTimestamp) {
        console.log('❌ Password changed after token issued:', {
          tokenIat: decoded.iat,
          passwordChangedAt: passwordChangedTimestamp,
          passwordChangedAtRaw: user.passwordChangedAt
        });
        return res.status(401).json(
          createResponse(false, 'Password recently changed. Please log in again.', null, 'PASSWORD_CHANGED')
        );
      }
    }

    console.log('✅ Token validation successful for user:', user.id);

    // Add user to request object
    req.user = user;
    next();
  } catch (error) {
    console.log('❌ Token verification error:', error.message);
    winston.error('Token verification error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json(
        createResponse(false, 'Invalid token', null, 'INVALID_TOKEN')
      );
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json(
        createResponse(false, 'Token expired', null, 'TOKEN_EXPIRED')
      );
    }

    return res.status(500).json(
      createResponse(false, 'Authentication error', null, 'AUTH_ERROR')
    );
  }
};

// Authorize roles
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json(
        createResponse(false, 'Authentication required', null, 'AUTH_REQUIRED')
      );
    }

    if (!roles.includes(req.user.role)) {
      winston.warn(`Unauthorized access attempt by user ${req.user.id} with role ${req.user.role}`);
      return res.status(403).json(
        createResponse(false, 'Insufficient permissions', null, 'INSUFFICIENT_PERMISSIONS')
      );
    }

    next();
  };
};

// Optional authentication (for public endpoints that can work with or without auth)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.userId);
    
    // Check token version for optional auth too
    if (user && user.isActive && decoded.tokenVersion === (user.tokenVersion || 0)) {
      req.user = user;
    } else {
      req.user = null;
    }
    
    next();
  } catch (error) {
    // Don't throw error for optional auth, just set user to null
    req.user = null;
    next();
  }
};

// Check if user owns resource or is admin
const checkOwnershipOrAdmin = (resourceUserIdField = 'userId') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json(
        createResponse(false, 'Authentication required', null, 'AUTH_REQUIRED')
      );
    }

    // Admin can access everything
    if (req.user.role === 'admin') {
      return next();
    }

    // Check ownership
    const resourceUserId = req.params[resourceUserIdField] || req.body[resourceUserIdField];
    if (req.user.id.toString() !== resourceUserId?.toString()) {
      return res.status(403).json(
        createResponse(false, 'Access denied. You can only access your own resources.', null, 'ACCESS_DENIED')
      );
    }

    next();
  };
};

// Verify refresh token with token version
const verifyRefreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    const cookieRefreshToken = req.cookies?.refreshToken;
    const tokenToUse = refreshToken || cookieRefreshToken;

    if (!tokenToUse) {
      return res.status(401).json(
        createResponse(false, 'Refresh token required', null, 'MISSING_REFRESH_TOKEN')
      );
    }

    // Verify refresh token format
    const decoded = jwt.verify(tokenToUse, process.env.JWT_REFRESH_SECRET);
    
    // Find user and validate refresh token
    const user = await User.findByPk(decoded.userId);
    if (!user) {
      return res.status(401).json(
        createResponse(false, 'Invalid refresh token', null, 'INVALID_REFRESH_TOKEN')
      );
    }

    // Check token version
    if (decoded.tokenVersion !== (user.tokenVersion || 0)) {
      winston.warn(`Refresh token version mismatch for user ${user.id}. Token: ${decoded.tokenVersion}, Current: ${user.tokenVersion}`);
      return res.status(401).json(
        createResponse(false, 'Refresh token has been invalidated', null, 'REFRESH_TOKEN_INVALIDATED')
      );
    }

    // Validate refresh token hash
    if (!user.validateRefreshToken(tokenToUse)) {
      return res.status(401).json(
        createResponse(false, 'Invalid refresh token', null, 'INVALID_REFRESH_TOKEN')
      );
    }

    req.user = user;
    req.refreshToken = tokenToUse;
    next();
  } catch (error) {
    winston.error('Refresh token verification error:', error);
    return res.status(401).json(
      createResponse(false, 'Invalid refresh token', null, 'INVALID_REFRESH_TOKEN')
    );
  }
};

module.exports = {
  authenticateToken,
  authorizeRoles,
  optionalAuth,
  checkOwnershipOrAdmin,
  verifyRefreshToken
};