const express = require('express');
const { body } = require('express-validator');
const passport = require('passport');
const authController = require('../controllers/authController');
const { 
  authenticateToken, 
  verifyRefreshToken,
  optionalAuth
} = require('../middleware/auth');

// Simple fallback validation
const handleValidationErrors = (req, res, next) => next();
const basicValidation = [handleValidationErrors];

// Import validation functions with fallbacks
let validateSignup = basicValidation;
let validateLogin = basicValidation;
let validatePasswordChange = basicValidation;
let validateProfileUpdate = basicValidation;
let validateRefreshToken = basicValidation;
let validateProfileAccess = basicValidation;

try {
  const validationModule = require('../middleware/validation');
  if (validationModule.validateSignup) validateSignup = validationModule.validateSignup;
  if (validationModule.validateLogin) validateLogin = validationModule.validateLogin;
  if (validationModule.validatePasswordChange) validatePasswordChange = validationModule.validatePasswordChange;
  if (validationModule.validateProfileUpdate) validateProfileUpdate = validationModule.validateProfileUpdate;
  if (validationModule.validateRefreshToken) validateRefreshToken = validationModule.validateRefreshToken;
  if (validationModule.validateProfileAccess) validateProfileAccess = validationModule.validateProfileAccess;
  if (validationModule.handleValidationErrors) handleValidationErrors = validationModule.handleValidationErrors;
} catch (error) {
  console.warn('⚠️ Validation middleware not found, using basic validation');
}

// Simple fallback limiters
const noOpLimiter = (req, res, next) => next();
let authLimiter = noOpLimiter;
let loginLimiter = noOpLimiter;
let authSpeedLimiter = noOpLimiter;

try {
  const securityConfig = require('../config/security');
  if (securityConfig.authLimiter) authLimiter = securityConfig.authLimiter;
  if (securityConfig.loginLimiter) loginLimiter = securityConfig.loginLimiter;
  if (securityConfig.authSpeedLimiter) authSpeedLimiter = securityConfig.authSpeedLimiter;
} catch (error) {
  console.warn('⚠️ Security config not found, using no-op limiters');
}

const router = express.Router();

// Apply rate limiting to all auth routes
router.use(authLimiter);
router.use(authSpeedLimiter);

// Simple fallback handler function
const notImplementedHandler = (methodName) => {
  return (req, res) => {
    res.status(501).json({
      success: false,
      message: `${methodName} method not implemented in authController`,
      code: 'METHOD_NOT_IMPLEMENTED',
      hint: `Please implement ${methodName} method in authController`
    });
  };
};

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
 * @route   GET /api/auth/profile/:id
 * @desc    Get user profile by ID (Own profile or Admin access)
 * @access  Private (Own profile or Admin)
 */
router.get('/profile/:id', 
  authenticateToken,
  validateProfileAccess,
  authController.getUserProfileById || notImplementedHandler('getUserProfileById')
);

/**
 * @route   GET /api/auth/public-profile/:id
 * @desc    Get limited public user profile by ID
 * @access  Public (Limited information only)
 */
router.get('/public-profile/:id', 
  validateProfileAccess,
  authController.getPublicProfile || notImplementedHandler('getPublicProfile')
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

// Development/Debug endpoints (only in development)
if (process.env.NODE_ENV !== 'production') {
  /**
   * @route   GET /api/v1/auth/debug-email
   * @desc    Debug email service status (Development only)
   * @access  Public
   */
  router.get('/debug-email', (req, res) => {
    try {
      const emailService = require('../services/emailService');
      const status = emailService.getStatus();
      
      res.json({
        success: true,
        message: 'Email service debug information',
        ...status,
        environment: {
          NODE_ENV: process.env.NODE_ENV,
          BASE_URL: process.env.BASE_URL,
          FRONTEND_URL: process.env.FRONTEND_URL
        },
        actions: {
          reinitialize: 'POST /api/v1/auth/reinit-email',
          testConnection: 'POST /api/v1/auth/test-connection',
          testEmail: 'POST /api/v1/auth/test-email'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Email service not available',
        error: error.message
      });
    }
  });

  /**
   * @route   POST /api/v1/auth/reinit-email
   * @desc    Reinitialize email service (Development only)
   * @access  Public
   */
  router.post('/reinit-email', (req, res) => {
    try {
      console.log('🔄 Manual email service reinitialization requested...');
      const emailService = require('../services/emailService');
      const status = emailService.reinitialize();
      
      res.json({
        success: true,
        message: 'Email service reinitialized',
        ...status,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Failed to reinitialize email service:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to reinitialize email service',
        error: error.message
      });
    }
  });

  /**
   * @route   POST /api/v1/auth/test-connection
   * @desc    Test Mailjet connection only (Development only)
   * @access  Public
   */
  router.post('/test-connection', async (req, res) => {
    try {
      console.log('🔍 Manual connection test requested...');
      const emailService = require('../services/emailService');
      const connectionTest = await emailService.testConnection();
      
      if (connectionTest.success) {
        res.json({
          success: true,
          message: '✅ Mailjet connection test successful',
          ...connectionTest,
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(500).json({
          success: false,
          message: '❌ Mailjet connection test failed',
          ...connectionTest,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('❌ Connection test error:', error);
      res.status(500).json({
        success: false,
        message: 'Connection test encountered an error',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  /**
   * @route   POST /api/v1/auth/test-email
   * @desc    Test Mailjet email configuration (Development only)
   * @access  Public
   */
  router.post('/test-email', async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({
          success: false,
          message: 'Email is required for testing'
        });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid email format'
        });
      }

      const emailService = require('../services/emailService');
      
      // Get current email service status
      const status = emailService.getStatus();
      console.log('📧 Current email service status:', status);
      
      // Show current configuration
      const config = {
        provider: status.provider,
        hasTransporter: status.hasTransporter,
        lastError: status.lastError,
        mailjetApiKey: process.env.MAILJET_API_KEY ? 
          `${process.env.MAILJET_API_KEY.substring(0, 8)}...` : 
          'Not configured',
        mailjetSecretKey: process.env.MAILJET_SECRET_KEY ? 'Configured' : 'Not configured',
        fromEmail: process.env.FROM_EMAIL || 'Not configured',
        appName: process.env.APP_NAME || 'Secure Node.js Backend',
        baseUrl: process.env.BASE_URL || 'http://localhost:3000'
      };

      console.log('📧 Current configuration:', config);
      
      // If service is in error state, suggest reinitialization
      if (status.provider === 'error' || !status.hasTransporter) {
        return res.status(500).json({
          success: false,
          message: `Email service is not properly initialized (provider: ${status.provider})`,
          config,
          error: {
            message: status.lastError || 'Email transporter not available',
            provider: status.provider
          },
          troubleshooting: {
            immediate_steps: [
              '1. Check server console for detailed error messages',
              '2. Try reinitialization: POST /api/v1/auth/reinit-email',
              '3. Verify environment variables are correctly set',
              '4. Restart the server if needed'
            ],
            verification_steps: [
              '1. Verify MAILJET_API_KEY is correct in .env',
              '2. Verify MAILJET_SECRET_KEY is correct in .env', 
              '3. Check FROM_EMAIL uses a verified domain in Mailjet',
              '4. Ensure your Mailjet account is active',
              '5. Check server internet connection'
            ]
          }
        });
      }

      // Test Mailjet connection first
      console.log('🔍 Testing Mailjet connection...');
      const connectionTest = await emailService.testConnection();
      
      if (!connectionTest.success) {
        return res.status(500).json({
          success: false,
          message: `Mailjet connection failed: ${connectionTest.error}`,
          config,
          error: {
            message: connectionTest.error || 'Unknown error',
            code: connectionTest.code,
            provider: connectionTest.provider,
            suggestion: connectionTest.suggestion || 'Check your Mailjet credentials'
          },
          troubleshooting: {
            steps: [
              '1. Verify MAILJET_API_KEY is correct in .env',
              '2. Verify MAILJET_SECRET_KEY is correct in .env', 
              '3. Check FROM_EMAIL uses a verified domain in Mailjet',
              '4. Ensure your Mailjet account is active',
              '5. Check server internet connection',
              '6. Try reinitializing: POST /api/v1/auth/reinit-email'
            ]
          }
        });
      }

      // Create test user object
      const testUser = {
        id: 999,
        username: 'testuser',
        email: email
      };

      // Generate test verification token
      const testToken = 'test-verification-token-' + Date.now();

      console.log(`📧 Sending test verification email to: ${email}`);
      console.log(`📧 Using provider: ${status.provider}`);
      console.log(`📧 From email: ${process.env.FROM_EMAIL}`);
      
      // Send test email using the same method as registration
      const emailSent = await emailService.sendEmailVerification(testUser, testToken);
      
      if (emailSent) {
        res.json({
          success: true,
          message: '✅ Test email sent successfully via Mailjet!',
          details: {
            recipient: email,
            sender: process.env.FROM_EMAIL,
            provider: status.provider,
            timestamp: new Date().toISOString(),
            testVerificationUrl: `${process.env.BASE_URL || 'http://localhost:3000'}/api/v1/auth/verify-email?token=${testToken}&email=${encodeURIComponent(email)}`
          },
          config: {
            provider: status.provider,
            fromEmail: process.env.FROM_EMAIL,
            appName: process.env.APP_NAME
          },
          instructions: [
            '1. Check your inbox and spam folder',
            '2. The test email contains a verification link',
            '3. Email should arrive within 1-2 minutes',
            '4. If not received, check Mailjet dashboard for delivery status'
          ]
        });
      } else {
        res.status(500).json({
          success: false,
          message: '❌ Failed to send test email via Mailjet',
          details: {
            recipient: email,
            provider: status.provider,
            timestamp: new Date().toISOString()
          },
          config,
          troubleshooting: {
            checkLogs: 'Review server console for detailed error messages',
            verifyConfig: 'Ensure all Mailjet configuration is correct',
            mailjetDashboard: 'Check Mailjet dashboard for account status',
            reinitialize: 'Try POST /api/v1/auth/reinit-email',
            contactSupport: 'Contact Mailjet support if issues persist'
          }
        });
      }
      
    } catch (error) {
      console.error('❌ Test email endpoint error:', error);
      
      res.status(500).json({
        success: false,
        message: 'Test email endpoint encountered an error',
        error: {
          message: error.message,
          code: error.code || 'UNKNOWN_ERROR',
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        },
        timestamp: new Date().toISOString(),
        suggestions: [
          'Check server logs for detailed error information',
          'Verify .env file contains correct Mailjet credentials',
          'Ensure Mailjet account is active and not suspended',
          'Try reinitializing email service: POST /api/v1/auth/reinit-email'
        ]
      });
    }
  });
}

module.exports = router;