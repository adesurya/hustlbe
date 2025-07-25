const request = require('supertest');
const app = require('../src/app');
const { sequelize } = require('../src/config/database');
const User = require('../src/models/User');

// Mock email service
jest.mock('../src/services/emailService', () => ({
  sendEmailVerification: jest.fn().mockResolvedValue(true),
  sendWelcomeEmail: jest.fn().mockResolvedValue(true),
  testConnection: jest.fn().mockResolvedValue(true)
}));

describe('Email Verification', () => {
  let server;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    server = app.listen(0);
  });

  afterAll(async () => {
    await sequelize.close();
    if (server) {
      server.close();
    }
  });

  beforeEach(async () => {
    await User.destroy({ where: {}, force: true });
  });

  describe('POST /api/v1/auth/register', () => {
    const validUserData = {
      username: 'testuser',
      email: 'test@example.com',
      phoneNumber: '+6281234567890',
      password: 'SecurePass123!',
      confirmPassword: 'SecurePass123!'
    };

    it('should register user and require email verification', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(validUserData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.isVerified).toBe(false);
      expect(response.body.data.requiresEmailVerification).toBe(true);
      expect(response.body.data.accessToken).toBeUndefined();
      expect(response.body.message).toContain('check your email');

      // Verify user is created but not verified
      const user = await User.findOne({ where: { email: 'test@example.com' } });
      expect(user).toBeTruthy();
      expect(user.isVerified).toBe(false);
      expect(user.emailVerificationToken).toBeTruthy();
      expect(user.emailVerificationExpires).toBeTruthy();
    });
  });

  describe('POST /api/v1/auth/login', () => {
    let unverifiedUser;

    beforeEach(async () => {
      unverifiedUser = await User.create({
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: 'SecurePass123!',
        role: 'user',
        isActive: true,
        isVerified: false
      });
    });

    it('should prevent login for unverified users', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          identifier: 'testuser',
          password: 'SecurePass123!'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('EMAIL_NOT_VERIFIED');
      expect(response.body.message).toContain('verify your email');
    });

    it('should allow login for verified users', async () => {
      // Mark user as verified
      await unverifiedUser.update({
        isVerified: true,
        emailVerifiedAt: new Date()
      });

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          identifier: 'testuser',
          password: 'SecurePass123!'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBeTruthy();
      expect(response.body.code).toBe('LOGIN_SUCCESS');
    });
  });

  describe('GET /api/v1/auth/verify-email', () => {
    let user;
    let verificationToken;

    beforeEach(async () => {
      user = await User.create({
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: 'SecurePass123!',
        role: 'user',
        isActive: true,
        isVerified: false
      });

      verificationToken = user.generateEmailVerificationToken();
      await user.save();
    });

    it('should verify email with valid token', async () => {
      const response = await request(app)
        .get(`/api/v1/auth/verify-email?token=${verificationToken}&email=${user.email}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.code).toBe('EMAIL_VERIFIED');
      expect(response.body.message).toContain('verified successfully');

      // Check user is now verified
      await user.reload();
      expect(user.isVerified).toBe(true);
      expect(user.emailVerifiedAt).toBeTruthy();
      expect(user.emailVerificationToken).toBeNull();
    });

    it('should fail with invalid token', async () => {
      const response = await request(app)
        .get(`/api/v1/auth/verify-email?token=invalid-token&email=${user.email}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('INVALID_TOKEN');
    });

    it('should fail with missing parameters', async () => {
      const response = await request(app)
        .get('/api/v1/auth/verify-email')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('MISSING_REQUIRED_FIELD');
    });

    it('should handle already verified email', async () => {
      // Mark user as verified first
      await user.update({
        isVerified: true,
        emailVerifiedAt: new Date(),
        emailVerificationToken: null
      });

      const response = await request(app)
        .get(`/api/v1/auth/verify-email?token=${verificationToken}&email=${user.email}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.alreadyVerified).toBe(true);
      expect(response.body.message).toContain('already verified');
    });

    it('should fail with expired token', async () => {
      // Set token to expired
      await user.update({
        emailVerificationExpires: new Date(Date.now() - 1000) // 1 second ago
      });

      const response = await request(app)
        .get(`/api/v1/auth/verify-email?token=${verificationToken}&email=${user.email}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('TOKEN_EXPIRED');
      expect(response.body.message).toContain('expired');
    });
  });

  describe('POST /api/v1/auth/resend-verification', () => {
    let user;

    beforeEach(async () => {
      user = await User.create({
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: 'SecurePass123!',
        role: 'user',
        isActive: true,
        isVerified: false
      });
    });

    it('should resend verification email for unverified user', async () => {
      const response = await request(app)
        .post('/api/v1/auth/resend-verification')
        .send({ email: user.email })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.code).toBe('EMAIL_VERIFICATION_SENT');
      expect(response.body.message).toContain('sent');

      // Check that new token was generated
      await user.reload();
      expect(user.emailVerificationToken).toBeTruthy();
      expect(user.emailVerificationSentAt).toBeTruthy();
    });

    it('should handle already verified email', async () => {
      await user.update({
        isVerified: true,
        emailVerifiedAt: new Date()
      });

      const response = await request(app)
        .post('/api/v1/auth/resend-verification')
        .send({ email: user.email })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('already verified');
    });

    it('should handle non-existent email gracefully', async () => {
      const response = await request(app)
        .post('/api/v1/auth/resend-verification')
        .send({ email: 'nonexistent@example.com' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('If an account with this email exists');
    });

    it('should enforce rate limiting for verification emails', async () => {
      // Set recent verification email sent
      await user.update({
        emailVerificationSentAt: new Date(Date.now() - 2 * 60 * 1000) // 2 minutes ago
      });

      const response = await request(app)
        .post('/api/v1/auth/resend-verification')
        .send({ email: user.email })
        .expect(429);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(response.body.message).toContain('wait');
    });

    it('should fail with invalid email format', async () => {
      const response = await request(app)
        .post('/api/v1/auth/resend-verification')
        .send({ email: 'invalid-email' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should fail with missing email', async () => {
      const response = await request(app)
        .post('/api/v1/auth/resend-verification')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('MISSING_REQUIRED_FIELD');
    });
  });

  describe('User Model Email Verification Methods', () => {
    let user;

    beforeEach(async () => {
      user = await User.create({
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: 'SecurePass123!',
        role: 'user',
        isActive: true,
        isVerified: false
      });
    });

    it('should generate email verification token', () => {
      const token = user.generateEmailVerificationToken();
      
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
      expect(user.emailVerificationToken).toBeTruthy();
      expect(user.emailVerificationExpires).toBeTruthy();
      expect(user.emailVerificationSentAt).toBeTruthy();
    });

    it('should validate email verification token', () => {
      const token = user.generateEmailVerificationToken();
      
      expect(user.validateEmailVerificationToken(token)).toBe(true);
      expect(user.validateEmailVerificationToken('invalid-token')).toBe(false);
    });

    it('should detect expired tokens', async () => {
      const token = user.generateEmailVerificationToken();
      
      // Set token to expired
      user.emailVerificationExpires = new Date(Date.now() - 1000);
      
      expect(user.validateEmailVerificationToken(token)).toBe(false);
      expect(user.isEmailVerificationExpired()).toBe(true);
    });

    it('should enforce resend cooldown', () => {
      // No previous send
      expect(user.canResendVerificationEmail()).toBe(true);
      
      // Recent send
      user.emailVerificationSentAt = new Date(Date.now() - 2 * 60 * 1000); // 2 minutes ago
      expect(user.canResendVerificationEmail()).toBe(false);
      
      // Old send
      user.emailVerificationSentAt = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago
      expect(user.canResendVerificationEmail()).toBe(true);
    });

    it('should mark email as verified', async () => {
      await user.markEmailAsVerified();
      
      expect(user.isVerified).toBe(true);
      expect(user.emailVerifiedAt).toBeTruthy();
      expect(user.emailVerificationToken).toBeNull();
      expect(user.emailVerificationExpires).toBeNull();
    });
  });
});