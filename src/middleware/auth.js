const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { createResponse } = require('../utils/response');
const winston = require('winston');

// Verify JWT token
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
    
    // Check if user still exists
    const user = await User.findByPk(decoded.userId);
    if (!user) {
      return res.status(401).json(
        createResponse(false, 'User no longer exists', null, 'USER_NOT_FOUND')
      );
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json(
        createResponse(false, 'Account has been deactivated', null, 'ACCOUNT_DEACTIVATED')
      );
    }

    // Check if password was changed after token was issued
    if (user.passwordChangedAt && decoded.iat < parseInt(user.passwordChangedAt.getTime() / 1000, 10)) {
      return res.status(401).json(
        createResponse(false, 'Password recently changed. Please log in again.', null, 'PASSWORD_CHANGED')
      );
    }

    // Add user to request object
    req.user = user;
    next();
  } catch (error) {
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
    
    if (user && user.isActive) {
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

// Verify refresh token
const verifyRefreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json(
        createResponse(false, 'Refresh token required', null, 'MISSING_REFRESH_TOKEN')
      );
    }

    // Verify refresh token format
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    
    // Find user and validate refresh token
    const user = await User.findByPk(decoded.userId);
    if (!user || !user.validateRefreshToken(refreshToken)) {
      return res.status(401).json(
        createResponse(false, 'Invalid refresh token', null, 'INVALID_REFRESH_TOKEN')
      );
    }

    req.user = user;
    req.refreshToken = refreshToken;
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