const nodemailer = require('nodemailer');
const { logSystemError, logUserAction } = require('../utils/logger');

class EmailService {
  constructor() {
    this.transporter = null;
    this.provider = 'none';
    this.lastError = null;
    this.appName = process.env.APP_NAME || 'Secure Node.js Backend';
    this.fromEmail = process.env.FROM_EMAIL;
    this.baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    
    // Debug nodemailer import
    console.log('🔍 Checking nodemailer import...');
    console.log('   nodemailer type:', typeof nodemailer);
    console.log('   createTransport type:', typeof nodemailer.createTransport);
    console.log('   nodemailer methods:', Object.keys(nodemailer));
    
    this.initializeTransporter();
  }

  /**
   * Initialize email transporter - FIXED ALL REFERENCES
   */
  initializeTransporter() {
    console.log('🔧 Starting email transporter initialization...');
    
    try {
      // FIXED: Check for createTransport (not createTransporter)
      if (!nodemailer || typeof nodemailer.createTransport !== 'function') {
        const error = `Nodemailer import issue. Type: ${typeof nodemailer}, createTransport: ${typeof nodemailer?.createTransport}`;
        console.error('❌', error);
        console.log('Available nodemailer methods:', Object.keys(nodemailer || {}));
        this.lastError = error;
        this.provider = 'error';
        return;
      }

      // Debug environment variables
      console.log('🔍 Environment check:');
      console.log(`   NODE_ENV: ${process.env.NODE_ENV}`);
      console.log(`   MAILJET_API_KEY: ${process.env.MAILJET_API_KEY ? 'SET (' + process.env.MAILJET_API_KEY.substring(0, 8) + '...)' : 'NOT SET'}`);
      console.log(`   MAILJET_SECRET_KEY: ${process.env.MAILJET_SECRET_KEY ? 'SET (' + process.env.MAILJET_SECRET_KEY.substring(0, 8) + '...)' : 'NOT SET'}`);
      console.log(`   FROM_EMAIL: ${process.env.FROM_EMAIL || 'NOT SET'}`);
      console.log(`   APP_NAME: ${process.env.APP_NAME || 'NOT SET'}`);

      if (process.env.NODE_ENV === 'test') {
        console.log('🧪 Test environment detected, using Ethereal email...');
        // FIXED: Use createTransport
        this.transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          auth: {
            user: 'test@example.com',
            pass: 'test'
          }
        });
        this.provider = 'test';
        console.log('✅ Test email transporter initialized');
        return;
      }

      // Validate required environment variables
      if (!process.env.MAILJET_API_KEY) {
        const error = 'MAILJET_API_KEY environment variable is not set';
        console.error('❌', error);
        this.lastError = error;
        this.provider = 'error';
        return;
      }

      if (!process.env.MAILJET_SECRET_KEY) {
        const error = 'MAILJET_SECRET_KEY environment variable is not set';
        console.error('❌', error);
        this.lastError = error;
        this.provider = 'error';
        return;
      }

      if (!process.env.FROM_EMAIL) {
        const error = 'FROM_EMAIL environment variable is not set';
        console.error('❌', error);
        this.lastError = error;
        this.provider = 'error';
        return;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(process.env.FROM_EMAIL)) {
        const error = `FROM_EMAIL has invalid format: ${process.env.FROM_EMAIL}`;
        console.error('❌', error);
        this.lastError = error;
        this.provider = 'error';
        return;
      }

      console.log('✅ All required environment variables are set');
      console.log('🔧 Creating Mailjet transporter...');

      // Mailjet SMTP configuration
      const transporterConfig = {
        host: 'in-v3.mailjet.com',
        port: 587,
        secure: false, // Use STARTTLS
        auth: {
          user: process.env.MAILJET_API_KEY,
          pass: process.env.MAILJET_SECRET_KEY
        },
        tls: {
          rejectUnauthorized: false
        },
        // Connection pooling and performance settings
        pool: true,
        maxConnections: 1,
        maxMessages: 100,
        rateLimit: 10, // Max 10 emails per second
        debug: process.env.NODE_ENV === 'development',
        logger: process.env.NODE_ENV === 'development'
      };

      console.log('📧 Transporter config:');
      console.log(`   Host: ${transporterConfig.host}`);
      console.log(`   Port: ${transporterConfig.port}`);
      console.log(`   Secure: ${transporterConfig.secure}`);
      console.log(`   Auth User: ${transporterConfig.auth.user.substring(0, 8)}...`);
      console.log(`   Pool: ${transporterConfig.pool}`);

      // FIXED: Use createTransport (correct method name)
      console.log('🔧 Calling nodemailer.createTransport...');
      this.transporter = nodemailer.createTransport(transporterConfig);
      this.provider = 'mailjet';
      this.lastError = null;

      console.log('✅ Mailjet transporter created successfully');
      console.log(`📧 Provider: ${this.provider}`);
      console.log(`📧 From Email: ${process.env.FROM_EMAIL}`);
      console.log(`📧 App Name: ${process.env.APP_NAME}`);

      // Quick verification (non-blocking)
      console.log('🔍 Testing transporter verification...');
      this.transporter.verify()
        .then(() => {
          console.log('✅ Mailjet connection verified successfully');
        })
        .catch((error) => {
          console.warn('⚠️ Connection verification failed (but transporter created):', error.message);
          // Don't change provider status here
        });
      
    } catch (error) {
      console.error('❌ Failed to initialize email transporter:', error);
      console.error('   Error details:', {
        message: error.message,
        code: error.code,
        stack: error.stack
      });
      
      this.transporter = null;
      this.provider = 'error';
      this.lastError = error.message;
    }
  }

  /**
   * Get detailed status information - FIXED PROPERTIES
   */
  getStatus() {
    return {
      provider: this.provider,
      hasTransporter: !!this.transporter,
      lastError: this.lastError,
      nodemailerInfo: {
        imported: !!nodemailer,
        type: typeof nodemailer,
        // FIXED: Check createTransport (not createTransporter)
        createTransportType: typeof nodemailer?.createTransport,
        version: this.getNodemailerVersion(),
        availableMethods: nodemailer ? Object.keys(nodemailer) : []
      },
      config: {
        mailjetApiKey: process.env.MAILJET_API_KEY ? `${process.env.MAILJET_API_KEY.substring(0, 8)}...` : null,
        mailjetSecretKeySet: !!process.env.MAILJET_SECRET_KEY,
        fromEmail: process.env.FROM_EMAIL,
        appName: process.env.APP_NAME,
        nodeEnv: process.env.NODE_ENV
      }
    };
  }

  /**
   * Get nodemailer version
   */
  getNodemailerVersion() {
    try {
      const packageInfo = require('nodemailer/package.json');
      return packageInfo.version;
    } catch (e) {
      return 'unknown';
    }
  }

  /**
   * Force reinitialize transporter
   */
  reinitialize() {
    console.log('🔄 Force reinitializing email transporter...');
    this.transporter = null;
    this.provider = 'none';
    this.lastError = null;
    this.initializeTransporter();
    return this.getStatus();
  }

  /**
   * Send email verification with enhanced error handling
   */
  async sendEmailVerification(user, token) {
    console.log('📧 Attempting to send email verification...');
    console.log('   Current provider:', this.provider);
    console.log('   Has transporter:', !!this.transporter);
    console.log('   User email:', user.email);

    try {
      // Check if transporter is available
      if (!this.transporter) {
        console.error('❌ Email transporter not available');
        console.error('   Provider status:', this.provider);
        console.error('   Last error:', this.lastError);
        return false;
      }

      if (this.provider === 'error') {
        console.error('❌ Email service is in error state');
        console.error('   Last error:', this.lastError);
        return false;
      }

      const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
      const verificationUrl = `${baseUrl}/api/v1/auth/verify-email?token=${token}&email=${encodeURIComponent(user.email)}`;
      
      const mailOptions = {
        from: {
          name: process.env.APP_NAME || 'Secure Node.js Backend',
          address: process.env.FROM_EMAIL
        },
        to: user.email,
        subject: `Verify Your Email - ${process.env.APP_NAME || 'Secure Node.js Backend'}`,
        html: this.generateEmailVerificationTemplate(user, verificationUrl),
        text: this.generateEmailVerificationText(user, verificationUrl)
      };

      console.log('📧 Mail options:');
      console.log('   From:', mailOptions.from);
      console.log('   To:', mailOptions.to);
      console.log('   Subject:', mailOptions.subject);
      
      console.log('📧 Sending email via Mailjet...');
      const info = await this.transporter.sendMail(mailOptions);
      
      console.log('✅ Email sent successfully:', {
        messageId: info.messageId,
        recipient: user.email,
        provider: this.provider,
        response: info.response
      });
      
      // Safe logging with try-catch
      try {
        if (typeof logUserAction === 'function') {
          logUserAction('email_verification_sent', user.id, {
            email: user.email,
            messageId: info.messageId,
            provider: this.provider
          });
        }
      } catch (logError) {
        console.warn('Warning: Could not log user action:', logError.message);
      }

      return true;
    } catch (error) {
      console.error('❌ Failed to send verification email:', {
        error: error.message,
        code: error.code,
        command: error.command,
        response: error.response,
        responseCode: error.responseCode,
        userId: user.id,
        email: user.email,
        provider: this.provider
      });

      // Safe logging with try-catch
      try {
        if (typeof logSystemError === 'function') {
          logSystemError(error, {
            context: 'send_email_verification',
            userId: user.id,
            email: user.email,
            provider: this.provider
          });
        }
      } catch (logError) {
        console.warn('Warning: Could not log system error:', logError.message);
      }
      
      return false;
    }
  }

  /**
   * Send account banned notification email
   * @param {object} user - User object
   * @param {string} reason - Reason for banning
   * @returns {boolean} Success status
   */
  async sendAccountBannedNotification(user, reason = 'Terms of service violation') {
    try {
      if (!this.transporter) {
        console.error('❌ Email transporter not available for ban notification');
        return false;
      }

      const subject = `${this.appName} - Account Suspended`;
      
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Account Suspended</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              line-height: 1.6; 
              color: #333; 
              margin: 0; 
              padding: 0; 
              background-color: #f4f4f4;
            }
            .container { 
              max-width: 600px; 
              margin: 0 auto; 
              padding: 20px; 
              background-color: white;
              box-shadow: 0 0 10px rgba(0,0,0,0.1);
            }
            .header { 
              background: #dc3545; 
              color: white; 
              padding: 20px; 
              text-align: center; 
              border-radius: 8px 8px 0 0; 
            }
            .content { 
              background: #f8f9fa; 
              padding: 30px; 
              border-radius: 0 0 8px 8px; 
            }
            .warning-box { 
              background: #fff3cd; 
              border: 1px solid #ffeaa7; 
              padding: 15px; 
              border-radius: 5px; 
              margin: 20px 0; 
            }
            .support-box { 
              background: #d1ecf1; 
              border: 1px solid #bee5eb; 
              padding: 20px; 
              border-radius: 5px; 
              margin: 20px 0; 
              text-align: center; 
            }
            .footer { 
              text-align: center; 
              margin-top: 30px; 
              font-size: 12px; 
              color: #666; 
            }
            ul { 
              padding-left: 20px; 
            }
            li { 
              margin: 8px 0; 
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🚫 Account Suspended</h1>
            </div>
            <div class="content">
              <h2>Hello ${user.username},</h2>
              
              <div class="warning-box">
                <p><strong>⚠️ Your account has been suspended</strong></p>
                <p>Your ${this.appName} account has been temporarily suspended and you will not be able to access our services.</p>
              </div>

              <h3>📋 Suspension Details:</h3>
              <ul>
                <li><strong>Account:</strong> ${user.email}</li>
                <li><strong>Username:</strong> ${user.username}</li>
                <li><strong>Reason:</strong> ${reason}</li>
                <li><strong>Date:</strong> ${new Date().toLocaleDateString('id-ID', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}</li>
              </ul>

              <div class="support-box">
                <h3>🆘 Need Help?</h3>
                <p><strong>For more information about your account status, please contact:</strong></p>
                <p><strong>📧 support@sijago.ai</strong></p>
                <p>Our support team will review your case and provide further assistance.</p>
              </div>

              <h3>🔍 What happens next?</h3>
              <ul>
                <li>Your account access has been temporarily disabled</li>
                <li>Your data remains secure in our system</li>
                <li>You can contact support for clarification or appeal</li>
                <li>Account reactivation is possible upon review</li>
              </ul>

              <p><strong>Important:</strong> If you believe this suspension was made in error, please contact our support team immediately with details about your situation.</p>
            </div>
            
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} ${this.appName}. All rights reserved.</p>
              <p>This is an automated message. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      const textContent = `
Account Suspended - ${this.appName}

Hello ${user.username},

Your ${this.appName} account has been suspended.

Suspension Details:
- Account: ${user.email}
- Username: ${user.username}
- Reason: ${reason}
- Date: ${new Date().toLocaleDateString('id-ID')}

For more information about your account status, please contact: support@sijago.ai

What happens next:
- Your account access has been temporarily disabled
- Your data remains secure in our system
- You can contact support for clarification or appeal
- Account reactivation is possible upon review

If you believe this suspension was made in error, please contact our support team immediately.

© ${new Date().getFullYear()} ${this.appName}. All rights reserved.
      `;

      const mailOptions = {
        from: this.fromEmail,
        to: user.email,
        subject: subject,
        text: textContent,
        html: htmlContent
      };

      const info = await this.transporter.sendMail(mailOptions);
      
      console.log('✅ Account banned notification sent successfully:', {
        messageId: info.MessageID || info.messageId,
        to: user.email,
        reason: reason
      });

      return true;
    } catch (error) {
      console.error('❌ Failed to send account banned notification:', error);
      return false;
    }
  }

  /**
   * Send account reactivated notification email
   * @param {object} user - User object
   * @param {string} reason - Reason for reactivation
   * @returns {boolean} Success status
   */
  async sendAccountReactivatedNotification(user, reason = 'Account reviewed and reactivated') {
    try {
      if (!this.transporter) {
        console.error('❌ Email transporter not available for reactivation notification');
        return false;
      }

      const subject = `${this.appName} - Account Reactivated`;
      
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Account Reactivated</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              line-height: 1.6; 
              color: #333; 
              margin: 0; 
              padding: 0; 
              background-color: #f4f4f4;
            }
            .container { 
              max-width: 600px; 
              margin: 0 auto; 
              padding: 20px; 
              background-color: white;
              box-shadow: 0 0 10px rgba(0,0,0,0.1);
            }
            .header { 
              background: #28a745; 
              color: white; 
              padding: 20px; 
              text-align: center; 
              border-radius: 8px 8px 0 0; 
            }
            .content { 
              background: #f8f9fa; 
              padding: 30px; 
              border-radius: 0 0 8px 8px; 
            }
            .success-box { 
              background: #d4edda; 
              border: 1px solid #c3e6cb; 
              padding: 15px; 
              border-radius: 5px; 
              margin: 20px 0; 
            }
            .info-box { 
              background: #d1ecf1; 
              border: 1px solid #bee5eb; 
              padding: 20px; 
              border-radius: 5px; 
              margin: 20px 0; 
            }
            .footer { 
              text-align: center; 
              margin-top: 30px; 
              font-size: 12px; 
              color: #666; 
            }
            .btn { 
              display: inline-block; 
              padding: 12px 24px; 
              background: #007bff; 
              color: white; 
              text-decoration: none; 
              border-radius: 5px; 
              margin: 10px 0; 
            }
            ul { 
              padding-left: 20px; 
            }
            li { 
              margin: 8px 0; 
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✅ Account Reactivated</h1>
            </div>
            <div class="content">
              <h2>Welcome back, ${user.username}!</h2>
              
              <div class="success-box">
                <p><strong>🎉 Great news! Your account has been reactivated</strong></p>
                <p>You can now access all ${this.appName} services again.</p>
              </div>

              <h3>📋 Reactivation Details:</h3>
              <ul>
                <li><strong>Account:</strong> ${user.email}</li>
                <li><strong>Username:</strong> ${user.username}</li>
                <li><strong>Reason:</strong> ${reason}</li>
                <li><strong>Date:</strong> ${new Date().toLocaleDateString('id-ID', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}</li>
              </ul>

              <div class="info-box">
                <h3>🔑 What you can do now:</h3>
                <ul>
                  <li>Log in to your account normally</li>
                  <li>Access all platform features</li>
                  <li>Continue where you left off</li>
                  <li>Enjoy our services without restrictions</li>
                </ul>
              </div>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${this.baseUrl}/login" class="btn">Login to Your Account</a>
              </div>

              <h3>📝 Important Reminders:</h3>
              <ul>
                <li>Please review our Terms of Service to avoid future issues</li>
                <li>Contact support if you have any questions: <strong>support@sijago.ai</strong></li>
                <li>Your account data and settings have been preserved</li>
              </ul>

              <p>Thank you for your patience during the review process. We're glad to have you back!</p>
            </div>
            
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} ${this.appName}. All rights reserved.</p>
              <p>This is an automated message. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      const textContent = `
Account Reactivated - ${this.appName}

Welcome back, ${user.username}!

Great news! Your account has been reactivated and you can now access all ${this.appName} services again.

Reactivation Details:
- Account: ${user.email}
- Username: ${user.username}
- Reason: ${reason}
- Date: ${new Date().toLocaleDateString('id-ID')}

What you can do now:
- Log in to your account normally
- Access all platform features
- Continue where you left off
- Enjoy our services without restrictions

Important Reminders:
- Please review our Terms of Service to avoid future issues
- Contact support if you have any questions: support@sijago.ai
- Your account data and settings have been preserved

Thank you for your patience during the review process. We're glad to have you back!

Login: ${this.baseUrl}/login

© ${new Date().getFullYear()} ${this.appName}. All rights reserved.
      `;

      const mailOptions = {
        from: this.fromEmail,
        to: user.email,
        subject: subject,
        text: textContent,
        html: htmlContent
      };

      const info = await this.transporter.sendMail(mailOptions);
      
      console.log('✅ Account reactivation notification sent successfully:', {
        messageId: info.MessageID || info.messageId,
        to: user.email,
        reason: reason
      });

      return true;
    } catch (error) {
      console.error('❌ Failed to send account reactivation notification:', error);
      return false;
    }
  }

  /**
   * Send ban appeal instructions email
   * @param {object} user - User object
   * @param {string} appealEmail - Email address for appeals
   * @returns {boolean} Success status
   */
  async sendBanAppealInstructions(user, appealEmail = 'support@sijago.ai') {
    try {
      if (!this.transporter) {
        console.error('❌ Email transporter not available for ban appeal instructions');
        return false;
      }

      const subject = `${this.appName} - Account Appeal Process`;
      
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Account Appeal Process</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              line-height: 1.6; 
              color: #333; 
              margin: 0; 
              padding: 0; 
              background-color: #f4f4f4;
            }
            .container { 
              max-width: 600px; 
              margin: 0 auto; 
              padding: 20px; 
              background-color: white;
              box-shadow: 0 0 10px rgba(0,0,0,0.1);
            }
            .header { 
              background: #17a2b8; 
              color: white; 
              padding: 20px; 
              text-align: center; 
              border-radius: 8px 8px 0 0; 
            }
            .content { 
              background: #f8f9fa; 
              padding: 30px; 
              border-radius: 0 0 8px 8px; 
            }
            .info-box { 
              background: #d1ecf1; 
              border: 1px solid #bee5eb; 
              padding: 20px; 
              border-radius: 5px; 
              margin: 20px 0; 
            }
            .steps-box { 
              background: #fff; 
              border: 1px solid #dee2e6; 
              padding: 20px; 
              border-radius: 5px; 
              margin: 20px 0; 
            }
            .footer { 
              text-align: center; 
              margin-top: 30px; 
              font-size: 12px; 
              color: #666; 
            }
            .step { 
              margin: 15px 0; 
              padding: 15px; 
              background: #f8f9fa; 
              border-left: 4px solid #007bff; 
              border-radius: 0 5px 5px 0;
            }
            ul { 
              padding-left: 20px; 
            }
            li { 
              margin: 8px 0; 
            }
            .template-box {
              background: #e9ecef;
              padding: 20px;
              border-radius: 5px;
              margin: 15px 0;
              font-family: monospace;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📋 Account Appeal Process</h1>
            </div>
            <div class="content">
              <h2>Hello ${user.username},</h2>
              
              <div class="info-box">
                <p><strong>ℹ️ You have requested information about the appeal process</strong></p>
                <p>We understand your concern about your account status. Here's how you can submit an appeal.</p>
              </div>

              <h3>📝 How to Submit an Appeal:</h3>
              
              <div class="steps-box">
                <div class="step">
                  <strong>Step 1:</strong> Send an email to <strong>${appealEmail}</strong>
                </div>
                
                <div class="step">
                  <strong>Step 2:</strong> Include the following information:
                  <ul>
                    <li>Your account email: ${user.email}</li>
                    <li>Your username: ${user.username}</li>
                    <li>Subject: "Account Appeal Request"</li>
                    <li>Detailed explanation of your situation</li>
                    <li>Any relevant evidence or documentation</li>
                  </ul>
                </div>
                
                <div class="step">
                  <strong>Step 3:</strong> Wait for our response (typically 3-5 business days)
                </div>
                
                <div class="step">
                  <strong>Step 4:</strong> Follow any additional instructions from our support team
                </div>
              </div>

              <h3>📧 Email Template for Appeal:</h3>
              <div class="template-box">
To: ${appealEmail}
Subject: Account Appeal Request - ${user.username}

Dear Support Team,

I am writing to appeal the suspension of my account.

Account Details:
- Email: ${user.email}
- Username: ${user.username}
- Suspension Date: [Insert date if known]

Reason for Appeal:
[Explain your situation and why you believe the suspension should be reviewed]

Additional Information:
[Include any relevant details or evidence]

Thank you for your time and consideration.

Best regards,
[Your Name]
              </div>

              <h3>⏰ What to Expect:</h3>
              <ul>
                <li><strong>Response Time:</strong> 3-5 business days</li>
                <li><strong>Review Process:</strong> Our team will carefully review your case</li>
                <li><strong>Possible Outcomes:</strong> Account reactivation, partial restrictions, or appeal denial</li>
                <li><strong>Communication:</strong> All updates will be sent to your email</li>
              </ul>

              <h3>📞 Additional Support:</h3>
              <div class="info-box">
                <p>If you have urgent questions about the appeal process, you can also contact us at:</p>
                <ul>
                  <li><strong>Email:</strong> ${appealEmail}</li>
                  <li><strong>Response Time:</strong> Within 24 hours</li>
                </ul>
              </div>

              <p><strong>Note:</strong> Please be patient as our team reviews each case thoroughly to ensure fair treatment.</p>
            </div>
            
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} ${this.appName}. All rights reserved.</p>
              <p>This is an automated message. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      const textContent = `
Account Appeal Process - ${this.appName}

Hello ${user.username},

You have requested information about the appeal process. Here's how you can submit an appeal.

How to Submit an Appeal:

Step 1: Send an email to ${appealEmail}

Step 2: Include the following information:
- Your account email: ${user.email}
- Your username: ${user.username}
- Subject: "Account Appeal Request"
- Detailed explanation of your situation
- Any relevant evidence or documentation

Step 3: Wait for our response (typically 3-5 business days)

Step 4: Follow any additional instructions from our support team

Email Template for Appeal:
To: ${appealEmail}
Subject: Account Appeal Request - ${user.username}

Dear Support Team,

I am writing to appeal the suspension of my account.

Account Details:
- Email: ${user.email}
- Username: ${user.username}
- Suspension Date: [Insert date if known]

Reason for Appeal:
[Explain your situation and why you believe the suspension should be reviewed]

Additional Information:
[Include any relevant details or evidence]

Thank you for your time and consideration.

Best regards,
[Your Name]

What to Expect:
- Response Time: 3-5 business days
- Review Process: Our team will carefully review your case
- Possible Outcomes: Account reactivation, partial restrictions, or appeal denial
- Communication: All updates will be sent to your email

Additional Support:
Email: ${appealEmail}
Response Time: Within 24 hours

Note: Please be patient as our team reviews each case thoroughly to ensure fair treatment.

© ${new Date().getFullYear()} ${this.appName}. All rights reserved.
      `;

      const mailOptions = {
        from: this.fromEmail,
        to: user.email,
        subject: subject,
        text: textContent,
        html: htmlContent
      };

      const info = await this.transporter.sendMail(mailOptions);
      
      console.log('✅ Ban appeal instructions sent successfully:', {
        messageId: info.MessageID || info.messageId,
        to: user.email,
        appealEmail: appealEmail
      });

      return true;
    } catch (error) {
      console.error('❌ Failed to send ban appeal instructions:', error);
      return false;
    }
  }

  /**
   * Test email configuration with comprehensive diagnostics
   */
  async testConnection() {
    console.log('🔍 Testing email connection...');
    console.log('   Provider:', this.provider);
    console.log('   Has transporter:', !!this.transporter);
    console.log('   Last error:', this.lastError);

    try {
      if (!this.transporter) {
        return {
          success: false,
          provider: this.provider,
          error: this.lastError || 'Email transporter not initialized',
          suggestion: 'Check Mailjet API credentials in .env file',
          details: this.getStatus()
        };
      }

      if (this.provider === 'error') {
        return {
          success: false,
          provider: this.provider,
          error: this.lastError || 'Email service in error state',
          suggestion: 'Check environment variables and restart server',
          details: this.getStatus()
        };
      }
      
      console.log('🔍 Verifying Mailjet connection...');
      await this.transporter.verify();
      
      console.log('✅ Mailjet connection test successful');
      
      return {
        success: true,
        provider: this.provider,
        message: 'Mailjet connection verified successfully',
        config: {
          host: 'in-v3.mailjet.com',
          port: 587,
          apiKey: process.env.MAILJET_API_KEY ? `${process.env.MAILJET_API_KEY.substring(0, 8)}...` : 'Not set',
          fromEmail: process.env.FROM_EMAIL
        },
        details: this.getStatus()
      };
    } catch (error) {
      console.error('❌ Mailjet connection test failed:', {
        error: error.message,
        code: error.code,
        command: error.command,
        response: error.response
      });
      
      // Safe logging with try-catch
      try {
        if (typeof logSystemError === 'function') {
          logSystemError(error, { 
            context: 'email_test_connection',
            provider: this.provider 
          });
        }
      } catch (logError) {
        console.warn('Warning: Could not log system error:', logError.message);
      }
      
      return {
        success: false,
        provider: this.provider,
        error: error.message,
        code: error.code,
        suggestion: this.getErrorSuggestion(error),
        details: this.getStatus()
      };
    }
  }

  /**
   * Get suggestion based on error type
   */
  getErrorSuggestion(error) {
    if (error.code === 'EAUTH') {
      return 'Invalid Mailjet API credentials. Check MAILJET_API_KEY and MAILJET_SECRET_KEY';
    } else if (error.code === 'ENOTFOUND') {
      return 'Network connectivity issue. Check internet connection';
    } else if (error.code === 'ECONNECTION') {
      return 'Cannot connect to Mailjet SMTP server. Check firewall settings';
    } else if (error.code === 'ETIMEDOUT') {
      return 'Connection timeout. Check network connectivity';
    } else if (error.message.includes('Invalid API key')) {
      return 'Invalid Mailjet API key. Verify your API credentials';
    } else if (error.message.includes('Invalid Secret key')) {
      return 'Invalid Mailjet Secret key. Verify your API credentials';
    } else {
      return 'Check Mailjet account status and API credentials';
    }
  }

  /**
   * Generate HTML template for email verification
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
   * Send welcome email after verification
   */
  async sendWelcomeEmail(user) {
    try {
      if (!this.transporter || this.provider === 'error') {
        console.warn('Email transporter not available. Skipping welcome email.');
        return false;
      }

      const mailOptions = {
        from: {
          name: process.env.APP_NAME || 'Secure Node.js Backend',
          address: process.env.FROM_EMAIL
        },
        to: user.email,
        subject: `Welcome to ${process.env.APP_NAME || 'Secure Node.js Backend'}!`,
        html: this.generateWelcomeEmailTemplate(user),
        text: this.generateWelcomeEmailText(user)
      };

      console.log(`📧 Sending welcome email to: ${user.email}`);
      
      const info = await this.transporter.sendMail(mailOptions);
      
      console.log('✅ Welcome email sent successfully:', {
        messageId: info.messageId,
        recipient: user.email
      });
      
      try {
        if (typeof logUserAction === 'function') {
          logUserAction('welcome_email_sent', user.id, {
            email: user.email,
            messageId: info.messageId,
            provider: this.provider
          });
        }
      } catch (logError) {
        console.warn('Warning: Could not log user action:', logError.message);
      }

      return true;
    } catch (error) {
      console.error('❌ Failed to send welcome email:', error.message);
      
      try {
        if (typeof logSystemError === 'function') {
          logSystemError(error, {
            context: 'send_welcome_email',
            userId: user.id,
            email: user.email,
            provider: this.provider
          });
        }
      } catch (logError) {
        console.warn('Warning: Could not log system error:', logError.message);
      }
      
      return false;
    }
  }

  /**
   * Generate HTML template for welcome email
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
}

module.exports = new EmailService();