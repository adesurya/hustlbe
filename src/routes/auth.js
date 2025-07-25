const express = require('express');
const { body } = require('express-validator');
const passport = require('passport');
const authController = require('../controllers/authController');
const { 
  authenticateToken, 
  verifyRefreshToken 
} = require('../middleware/auth');
const {
  validateSignup,
  validateLogin,
  validatePasswordChange,
  validateProfileUpdate,
  validateRefreshToken,
  handleValidationErrors
} = require('../middleware/validation');
const {
  authLimiter,
  loginLimiter,
  authSpeedLimiter
} = require('../config/security');

const router = express.Router();

// Apply rate limiting to all auth routes
router.use(authLimiter);
router.use(authSpeedLimiter);

/**
 * @route   POST /api/auth/register
 * @desc    Register new user
 * @access  Public
 */
router.post('/register', validateSignup, authController.register);

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login', loginLimiter, validateLogin, authController.login);

/**
 * @route   POST /api/auth/refresh-token
 * @desc    Refresh access token
 * @access  Public
 */
router.post('/refresh-token', validateRefreshToken, authController.refreshToken);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post('/logout', authenticateToken, authController.logout);

/**
 * @route   POST /api/auth/change-password
 * @desc    Change user password
 * @access  Private
 */
router.post('/change-password', 
  authenticateToken, 
  validatePasswordChange, 
  authController.changePassword
);

/**
 * @route   GET /api/auth/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/profile', authenticateToken, authController.getProfile);

/**
 * @route   PUT /api/auth/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/profile', 
  authenticateToken, 
  validateProfileUpdate, 
  authController.updateProfile
);

/**
 * @route   GET /api/auth/verify-email
 * @desc    Verify user email address
 * @access  Public
 */
router.get('/verify-email', authController.verifyEmail);

/**
 * @route   POST /api/auth/resend-verification
 * @desc    Resend email verification
 * @access  Public
 */
router.post('/resend-verification', 
  body('email').isEmail().withMessage('Valid email is required'),
  handleValidationErrors,
  authController.resendEmailVerification
);

/**
 * @route   POST /api/auth/verify-email
 * @desc    Verify user email (legacy endpoint for authenticated users)
 * @access  Private
 */
router.post('/verify-email', authenticateToken, authController.verifyEmail);

// Google OAuth routes
/**
 * @route   GET /api/auth/google
 * @desc    Initiate Google OAuth
 * @access  Public
 */
router.get('/google',
  passport.authenticate('google', { 
    scope: ['profile', 'email'],
    prompt: 'select_account'
  })
);

/**
 * @route   GET /api/auth/google/callback
 * @desc    Google OAuth callback
 * @access  Public
 */
router.get('/google/callback',
  passport.authenticate('google', { 
    failureRedirect: `${process.env.FRONTEND_URL}/login?error=oauth_failed`,
    session: false
  }),
  authController.googleCallback
);

module.exports = router;