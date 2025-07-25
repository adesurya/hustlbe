const request = require('supertest');
const app = require('../src/app');
const { sequelize } = require('../src/config/database');
const User = require('../src/models/User');

describe('Authentication Endpoints', () => {
  let server;

  beforeAll(async () => {
    // Setup test database
    await sequelize.sync({ force: true });
    server = app.listen(0); // Random port for testing
  });

  afterAll(async () => {
    await sequelize.close();
    if (server) {
      server.close();
    }
  });

  beforeEach(async () => {
    // Clean database before each test
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

    it('should register a new user successfully', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(validUserData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(validUserData.email);
      expect(response.body.data.user.username).toBe(validUserData.username);
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
      expect(response.body.data.user.passwordHash).toBeUndefined();
    });

    it('should fail registration with weak password', async () => {
      const weakPasswordData = {
        ...validUserData,
        password: '123',
        confirmPassword: '123'
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(weakPasswordData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should fail registration with duplicate email', async () => {
      // First registration
      await request(app)
        .post('/api/v1/auth/register')
        .send(validUserData)
        .expect(201);

      // Second registration with same email
      const duplicateData = {
        ...validUserData,
        username: 'differentuser'
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(duplicateData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('RESOURCE_ALREADY_EXISTS');
    });

    it('should fail registration with invalid email format', async () => {
      const invalidEmailData = {
        ...validUserData,
        email: 'invalid-email'
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(invalidEmailData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should fail registration when passwords do not match', async () => {
      const mismatchPasswordData = {
        ...validUserData,
        confirmPassword: 'DifferentPass123!'
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(mismatchPasswordData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    let testUser;

    beforeEach(async () => {
      // Create test user
      testUser = await User.create({
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: 'SecurePass123!',
        role: 'user',
        isActive: true,
        isVerified: true
      });
    });

    it('should login successfully with username', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          identifier: 'testuser',
          password: 'SecurePass123!'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(testUser.email);
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.code).toBe('LOGIN_SUCCESS');
    });

    it('should login successfully with email', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          identifier: 'test@example.com',
          password: 'SecurePass123!'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(testUser.email);
      expect(response.body.data.accessToken).toBeDefined();
    });

    it('should fail login with wrong password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          identifier: 'testuser',
          password: 'WrongPassword123!'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('INVALID_CREDENTIALS');
    });

    it('should fail login with non-existent user', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          identifier: 'nonexistent',
          password: 'SecurePass123!'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('INVALID_CREDENTIALS');
    });

    it('should lock account after multiple failed attempts', async () => {
      // Make 5 failed login attempts
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/v1/auth/login')
          .send({
            identifier: 'testuser',
            password: 'WrongPassword123!'
          })
          .expect(401);
      }

      // 6th attempt should return account locked error
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          identifier: 'testuser',
          password: 'WrongPassword123!'
        })
        .expect(401);

      expect(response.body.code).toBe('ACCOUNT_LOCKED');
    });

    it('should fail login for inactive user', async () => {
      await testUser.update({ isActive: false });

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          identifier: 'testuser',
          password: 'SecurePass123!'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('ACCOUNT_DISABLED');
    });
  });

  describe('GET /api/v1/auth/profile', () => {
    let testUser;
    let accessToken;

    beforeEach(async () => {
      // Register and login user to get token
      const registerResponse = await request(app)
        .post('/api/v1/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          phoneNumber: '+6281234567890',
          password: 'SecurePass123!',
          confirmPassword: 'SecurePass123!'
        });

      accessToken = registerResponse.body.data.accessToken;
      testUser = registerResponse.body.data.user;
    });

    it('should get user profile successfully', async () => {
      const response = await request(app)
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.id).toBe(testUser.id);
      expect(response.body.data.user.email).toBe(testUser.email);
      expect(response.body.data.user.passwordHash).toBeUndefined();
    });

    it('should fail to get profile without token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/profile')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('MISSING_TOKEN');
    });

    it('should fail to get profile with invalid token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('INVALID_TOKEN');
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    let accessToken;

    beforeEach(async () => {
      const registerResponse = await request(app)
        .post('/api/v1/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          phoneNumber: '+6281234567890',
          password: 'SecurePass123!',
          confirmPassword: 'SecurePass123!'
        });

      accessToken = registerResponse.body.data.accessToken;
    });

    it('should logout successfully', async () => {
      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.code).toBe('LOGOUT_SUCCESS');
    });

    it('should fail logout without token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/logout')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('MISSING_TOKEN');
    });
  });

  describe('POST /api/v1/auth/change-password', () => {
    let testUser;
    let accessToken;

    beforeEach(async () => {
      const registerResponse = await request(app)
        .post('/api/v1/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          phoneNumber: '+6281234567890',
          password: 'SecurePass123!',
          confirmPassword: 'SecurePass123!'
        });

      accessToken = registerResponse.body.data.accessToken;
      testUser = registerResponse.body.data.user;
    });

    it('should change password successfully', async () => {
      const response = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'SecurePass123!',
          newPassword: 'NewSecurePass123!',
          confirmNewPassword: 'NewSecurePass123!'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.code).toBe('PASSWORD_CHANGED');
    });

    it('should fail change password with wrong current password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'WrongPassword123!',
          newPassword: 'NewSecurePass123!',
          confirmNewPassword: 'NewSecurePass123!'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('INVALID_CREDENTIALS');
    });

    it('should fail change password with weak new password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'SecurePass123!',
          newPassword: '123',
          confirmNewPassword: '123'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting to login endpoint', async () => {
      const promises = [];
      
      // Make 6 requests simultaneously (limit is 5)
      for (let i = 0; i < 6; i++) {
        promises.push(
          request(app)
            .post('/api/v1/auth/login')
            .send({
              identifier: 'testuser',
              password: 'password'
            })
        );
      }

      const responses = await Promise.all(promises);
      
      // At least one should be rate limited
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Input Validation', () => {
    it('should sanitize malicious input', async () => {
      const maliciousData = {
        username: '<script>alert("xss")</script>testuser',
        email: 'test@example.com',
        phoneNumber: '+6281234567890',
        password: 'SecurePass123!',
        confirmPassword: 'SecurePass123!'
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(maliciousData)
        .expect(201);

      expect(response.body.data.user.username).not.toContain('<script>');
      expect(response.body.data.user.username).not.toContain('alert');
    });

    it('should reject SQL injection attempts', async () => {
      const sqlInjectionData = {
        username: "admin'; DROP TABLE users; --",
        email: 'test@example.com',
        phoneNumber: '+6281234567890',
        password: 'SecurePass123!',
        confirmPassword: 'SecurePass123!'
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(sqlInjectionData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });
});