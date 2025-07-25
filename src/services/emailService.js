const nodemailer = require('nodemailer');
const { logSystemError, logUserAction } = require('../utils/logger');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  /**
   * Initialize email transporter
   */
  initializeTransporter() {
    try {
      if (process.env.NODE_ENV === 'test') {
        // Use test account for testing
        this.transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          auth: {
            user: 'test@example.com',
            pass: 'test'
          }
        });
        return;
      }

      // Check if SMTP configuration is provided
      if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.warn('Email configuration not found. Email features will be disabled.');
        this.transporter = null;
        return;
      }

      // Production/Development configuration
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: false, // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        },
        tls: {
          rejectUnauthorized: false
        }
      });

      console.log('Email transporter initialized successfully');
    } catch (error) {
      console.error('Failed to initialize email transporter:', error.message);
      this.transporter = null;
    }
  }

  /**
   * Send email verification
   * @param {object} user - User object
   * @param {string} token - Verification token
   * @returns {boolean} Success status
   */
  async sendEmailVerification(user, token) {
    try {
      // Check if transporter is available
      if (!this.transporter) {
        console.warn('Email transporter not available. Skipping email verification.');
        return false;
      }

      const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
      const verificationUrl = `${baseUrl}/api/v1/auth/verify-email?token=${token}&email=${encodeURIComponent(user.email)}`;
      
      const mailOptions = {
        from: {
          name: process.env.APP_NAME || 'Secure Node.js Backend',
          address: process.env.SMTP_USER || 'noreply@example.com'
        },
        to: user.email,
        subject: 'Email Verification Required',
        html: this.generateEmailVerificationTemplate(user, verificationUrl),
        text: this.generateEmailVerificationText(user, verificationUrl)
      };

      const info = await this.transporter.sendMail(mailOptions);
      
      logUserAction('email_verification_sent', user.id, {
        email: user.email,
        messageId: info.messageId
      });

      return true;
    } catch (error) {
      logSystemError(error, {
        context: 'send_email_verification',
        userId: user.id,
        email: user.email
      });
      
      // Don't throw error, just return false to allow registration to continue
      console.error('Failed to send verification email:', error.message);
      return false;
    }
  }

  /**
   * Send welcome email after verification
   * @param {object} user - User object
   * @returns {boolean} Success status
   */
  async sendWelcomeEmail(user) {
    try {
      // Check if transporter is available
      if (!this.transporter) {
        console.warn('Email transporter not available. Skipping welcome email.');
        return false;
      }

      const mailOptions = {
        from: {
          name: process.env.APP_NAME || 'Secure Node.js Backend',
          address: process.env.SMTP_USER || 'noreply@example.com'
        },
        to: user.email,
        subject: 'Welcome! Your Email Has Been Verified',
        html: this.generateWelcomeEmailTemplate(user),
        text: this.generateWelcomeEmailText(user)
      };

      const info = await this.transporter.sendMail(mailOptions);
      
      logUserAction('welcome_email_sent', user.id, {
        email: user.email,
        messageId: info.messageId
      });

      return true;
    } catch (error) {
      logSystemError(error, {
        context: 'send_welcome_email',
        userId: user.id,
        email: user.email
      });
      
      // Don't throw error for welcome email as it's not critical
      console.error('Failed to send welcome email:', error.message);
      return false;
    }
  }

  /**
   * Generate HTML template for email verification
   * @param {object} user - User object
   * @param {string} verificationUrl - Verification URL
   * @returns {string} HTML template
   */
  generateEmailVerificationTemplate(user, verificationUrl) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Email Verification</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
        .button:hover { background: #5a67d8; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        .security-note { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔐 Email Verification Required</h1>
        <p>Welcome to ${process.env.APP_NAME || 'Secure Node.js Backend'}!</p>
    </div>
    
    <div class="content">
        <h2>Hello ${user.username}!</h2>
        
        <p>Thank you for registering with us. To complete your registration and secure your account, please verify your email address by clicking the button below:</p>
        
        <div style="text-align: center;">
            <a href="${verificationUrl}" class="button">✅ Verify Email Address</a>
        </div>
        
        <div class="security-note">
            <h3>🔒 Security Information:</h3>
            <ul>
                <li>This verification link will expire in <strong>24 hours</strong></li>
                <li>You cannot log in until your email is verified</li>
                <li>If you didn't create this account, please ignore this email</li>
            </ul>
        </div>
        
        <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
        <p style="word-break: break-all; background: #e9ecef; padding: 10px; border-radius: 5px; font-family: monospace;">
            ${verificationUrl}
        </p>
        
        <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
        
        <p>Best regards,<br>
        <strong>${process.env.APP_NAME || 'Secure Node.js Backend'} Team</strong></p>
    </div>
    
    <div class="footer">
        <p>This email was sent to ${user.email}. If you did not request this verification, please ignore this email.</p>
        <p>&copy; ${new Date().getFullYear()} ${process.env.APP_NAME || 'Secure Node.js Backend'}. All rights reserved.</p>
    </div>
</body>
</html>`;
  }

  /**
   * Generate plain text template for email verification
   * @param {object} user - User object
   * @param {string} verificationUrl - Verification URL
   * @returns {string} Plain text template
   */
  generateEmailVerificationText(user, verificationUrl) {
    return `
Email Verification Required

Hello ${user.username}!

Thank you for registering with ${process.env.APP_NAME || 'Secure Node.js Backend'}. To complete your registration and secure your account, please verify your email address by visiting the following link:

${verificationUrl}

Security Information:
- This verification link will expire in 24 hours
- You cannot log in until your email is verified
- If you didn't create this account, please ignore this email

If you have any questions or need assistance, please contact our support team.

Best regards,
${process.env.APP_NAME || 'Secure Node.js Backend'} Team

This email was sent to ${user.email}. If you did not request this verification, please ignore this email.

© ${new Date().getFullYear()} ${process.env.APP_NAME || 'Secure Node.js Backend'}. All rights reserved.
`;
  }

  /**
   * Generate HTML template for welcome email
   * @param {object} user - User object
   * @returns {string} HTML template
   */
  generateWelcomeEmailTemplate(user) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome!</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        .feature-list { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🎉 Welcome to ${process.env.APP_NAME || 'Secure Node.js Backend'}!</h1>
        <p>Your email has been successfully verified!</p>
    </div>
    
    <div class="content">
        <h2>Hello ${user.username}!</h2>
        
        <p>Congratulations! Your email address has been successfully verified and your account is now active. You can now enjoy full access to all our features.</p>
        
        <div class="feature-list">
            <h3>🚀 What you can do now:</h3>
            <ul>
                <li>✅ Login to your account</li>
                <li>🛍️ Browse our products and categories</li>
                <li>👤 Update your profile information</li>
                <li>🔒 Enjoy secure access to all features</li>
            </ul>
        </div>
        
        <p>If you have any questions or need assistance, our support team is here to help.</p>
        
        <p>Thank you for joining us!</p>
        
        <p>Best regards,<br>
        <strong>${process.env.APP_NAME || 'Secure Node.js Backend'} Team</strong></p>
    </div>
    
    <div class="footer">
        <p>&copy; ${new Date().getFullYear()} ${process.env.APP_NAME || 'Secure Node.js Backend'}. All rights reserved.</p>
    </div>
</body>
</html>`;
  }

  /**
   * Generate plain text template for welcome email
   * @param {object} user - User object
   * @returns {string} Plain text template
   */
  generateWelcomeEmailText(user) {
    return `
Welcome to ${process.env.APP_NAME || 'Secure Node.js Backend'}!

Hello ${user.username}!

Congratulations! Your email address has been successfully verified and your account is now active. You can now enjoy full access to all our features.

What you can do now:
- Login to your account
- Browse our products and categories
- Update your profile information
- Enjoy secure access to all features

If you have any questions or need assistance, our support team is here to help.

Thank you for joining us!

Best regards,
${process.env.APP_NAME || 'Secure Node.js Backend'} Team

© ${new Date().getFullYear()} ${process.env.APP_NAME || 'Secure Node.js Backend'}. All rights reserved.
`;
  }

  /**
   * Test email configuration
   * @returns {boolean} Success status
   */
  async testConnection() {
    try {
      if (!this.transporter) {
        console.warn('Email transporter not available');
        return false;
      }
      
      await this.transporter.verify();
      console.log('Email connection test successful');
      return true;
    } catch (error) {
      logSystemError(error, { context: 'email_test_connection' });
      console.error('Email connection test failed:', error.message);
      return false;
    }
  }
}

module.exports = new EmailService();