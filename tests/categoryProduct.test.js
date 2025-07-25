const request = require('supertest');
const app = require('../src/app');
const { sequelize } = require('../src/config/database');
const { User, Category, Product } = require('../src/models');

describe('Category and Product Endpoints', () => {
  let server;
  let adminToken;
  let userToken;
  let adminUser;
  let regularUser;
  let testCategory;

  beforeAll(async () => {
    // Setup test database
    await sequelize.sync({ force: true });
    server = app.listen(0);

    // Create admin user
    adminUser = await User.create({
      username: 'admin',
      email: 'admin@test.com',
      passwordHash: 'AdminPass123!',
      role: 'admin',
      isActive: true,
      isVerified: true
    });

    // Create regular user
    regularUser = await User.create({
      username: 'user',
      email: 'user@test.com',
      passwordHash: 'UserPass123!',
      role: 'user',
      isActive: true,
      isVerified: true
    });

    // Get admin token
    const adminLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({
        identifier: 'admin',
        password: 'AdminPass123!'
      });
    adminToken = adminLogin.body.data.accessToken;

    // Get user token
    const userLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({
        identifier: 'user',
        password: 'UserPass123!'
      });
    userToken = userLogin.body.data.accessToken;
  });

  afterAll(async () => {
    await sequelize.close();
    if (server) {
      server.close();
    }
  });

  beforeEach(async () => {
    // Clean up categories and products before each test
    await Product.destroy({ where: {}, force: true });
    await Category.destroy({ where: {}, force: true });
  });

  describe('Category Endpoints', () => {
    describe('POST /api/v1/categories', () => {
      it('should create category as admin', async () => {
        const categoryData = {
          name: 'Electronics',
          description: 'Electronic devices and gadgets',
          isActive: true,
          sortOrder: 1
        };

        const response = await request(app)
          .post('/api/v1/categories')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(categoryData)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data.name).toBe(categoryData.name);
        expect(response.body.data.slug).toBe('electronics');
        expect(response.body.code).toBe('RESOURCE_CREATED');
      });

      it('should fail to create category as regular user', async () => {
        const categoryData = {
          name: 'Electronics',
          description: 'Electronic devices and gadgets'
        };

        const response = await request(app)
          .post('/api/v1/categories')
          .set('Authorization', `Bearer ${userToken}`)
          .send(categoryData)
          .expect(403);

        expect(response.body.success).toBe(false);
        expect(response.body.code).toBe('INSUFFICIENT_PERMISSIONS');
      });

      it('should fail to create category without authentication', async () => {
        const categoryData = {
          name: 'Electronics',
          description: 'Electronic devices and gadgets'
        };

        const response = await request(app)
          .post('/api/v1/categories')
          .send(categoryData)
          .expect(401);

        expect(response.body.success).toBe(false);
        expect(response.body.code).toBe('MISSING_TOKEN');
      });

      it('should fail to create category with duplicate name', async () => {
        // Create first category
        await Category.create({
          name: 'Electronics',
          slug: 'electronics',
          createdBy: adminUser.id
        });

        const categoryData = {
          name: 'Electronics',
          description: 'Duplicate category'
        };

        const response = await request(app)
          .post('/api/v1/categories')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(categoryData)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('already exists');
      });
    });

    describe('GET /api/v1/categories', () => {
      beforeEach(async () => {
        // Create test categories
        await Category.create({
          name: 'Electronics',
          slug: 'electronics',
          isActive: true,
          sortOrder: 1,
          createdBy: adminUser.id
        });

        await Category.create({
          name: 'Fashion',
          slug: 'fashion',
          isActive: false,
          sortOrder: 2,
          createdBy: adminUser.id
        });
      });

      it('should get all categories as admin', async () => {
        const response = await request(app)
          .get('/api/v1/categories')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(2);
        expect(response.body.meta.pagination.totalItems).toBe(2);
      });

      it('should get only active categories as regular user', async () => {
        const response = await request(app)
          .get('/api/v1/categories')
          .set('Authorization', `Bearer ${userToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].name).toBe('Electronics');
      });

      it('should get only active categories without authentication', async () => {
        const response = await request(app)
          .get('/api/v1/categories')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].isActive).toBe(true);
      });
    });

    describe('GET /api/v1/categories/active', () => {
      beforeEach(async () => {
        await Category.create({
          name: 'Electronics',
          slug: 'electronics',
          isActive: true,
          sortOrder: 1,
          createdBy: adminUser.id
        });

        await Category.create({
          name: 'Fashion',
          slug: 'fashion',
          isActive: false,
          sortOrder: 2,
          createdBy: adminUser.id
        });
      });

      it('should get only active categories', async () => {
        const response = await request(app)
          .get('/api/v1/categories/active')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].name).toBe('Electronics');
        expect(response.body.data[0].isActive).toBe(true);
      });
    });

    describe('PUT /api/v1/categories/:id', () => {
      beforeEach(async () => {
        testCategory = await Category.create({
          name: 'Electronics',
          slug: 'electronics',
          description: 'Original description',
          isActive: true,
          createdBy: adminUser.id
        });
      });

      it('should update category as admin', async () => {
        const updateData = {
          name: 'Updated Electronics',
          description: 'Updated description',
          isActive: false
        };

        const response = await request(app)
          .put(`/api/v1/categories/${testCategory.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send(updateData)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.name).toBe(updateData.name);
        expect(response.body.data.description).toBe(updateData.description);
        expect(response.body.data.isActive).toBe(updateData.isActive);
      });

      it('should fail to update category as regular user', async () => {
        const updateData = {
          name: 'Updated Electronics'
        };

        const response = await request(app)
          .put(`/api/v1/categories/${testCategory.id}`)
          .set('Authorization', `Bearer ${userToken}`)
          .send(updateData)
          .expect(403);

        expect(response.body.success).toBe(false);
        expect(response.body.code).toBe('INSUFFICIENT_PERMISSIONS');
      });
    });

    describe('DELETE /api/v1/categories/:id', () => {
      beforeEach(async () => {
        testCategory = await Category.create({
          name: 'Electronics',
          slug: 'electronics',
          isActive: true,
          createdBy: adminUser.id
        });
      });

      it('should delete category as admin', async () => {
        const response = await request(app)
          .delete(`/api/v1/categories/${testCategory.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.code).toBe('RESOURCE_DELETED');

        // Verify category is deleted
        const deletedCategory = await Category.findByPk(testCategory.id);
        expect(deletedCategory).toBeNull();
      });

      it('should fail to delete category with products', async () => {
        // Create a product in the category
        await Product.create({
          title: 'Test Product',
          slug: 'test-product',
          points: 100,
          price: 1000,
          categoryId: testCategory.id,
          createdBy: adminUser.id
        });

        const response = await request(app)
          .delete(`/api/v1/categories/${testCategory.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('has products');
      });
    });
  });

  describe('Product Endpoints', () => {
    beforeEach(async () => {
      // Create test category
      testCategory = await Category.create({
        name: 'Electronics',
        slug: 'electronics',
        isActive: true,
        createdBy: adminUser.id
      });
    });

    describe('POST /api/v1/products', () => {
      it('should create product as admin', async () => {
        const productData = {
          title: 'Smartphone Pro',
          description: 'Latest smartphone with advanced features',
          points: 1500,
          price: 5999999.00,
          url: 'https://example.com/smartphone-pro',
          categoryId: testCategory.id,
          isFeatured: true,
          stockQuantity: 50
        };

        const response = await request(app)
          .post('/api/v1/products')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(productData)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data.title).toBe(productData.title);
        expect(response.body.data.slug).toBe('smartphone-pro');
        expect(response.body.data.points).toBe(productData.points);
        expect(response.body.data.price).toBe(productData.price);
        expect(response.body.code).toBe('RESOURCE_CREATED');
      });

      it('should fail to create product as regular user', async () => {
        const productData = {
          title: 'Smartphone Pro',
          points: 1500,
          price: 5999999.00,
          categoryId: testCategory.id
        };

        const response = await request(app)
          .post('/api/v1/products')
          .set('Authorization', `Bearer ${userToken}`)
          .send(productData)
          .expect(403);

        expect(response.body.success).toBe(false);
        expect(response.body.code).toBe('INSUFFICIENT_PERMISSIONS');
      });

      it('should fail to create product with invalid category', async () => {
        const productData = {
          title: 'Smartphone Pro',
          points: 1500,
          price: 5999999.00,
          categoryId: 99999 // Non-existent category
        };

        const response = await request(app)
          .post('/api/v1/products')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(productData)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('Category not found');
      });
    });

    describe('GET /api/v1/products', () => {
      beforeEach(async () => {
        // Create test products
        await Product.create({
          title: 'Smartphone Pro',
          slug: 'smartphone-pro',
          points: 1500,
          price: 5999999.00,
          categoryId: testCategory.id,
          isActive: true,
          isFeatured: true,
          createdBy: adminUser.id
        });

        await Product.create({
          title: 'Tablet Ultra',
          slug: 'tablet-ultra',
          points: 1000,
          price: 3999999.00,
          categoryId: testCategory.id,
          isActive: false,
          isFeatured: false,
          createdBy: adminUser.id
        });
      });

      it('should get all products as admin', async () => {
        const response = await request(app)
          .get('/api/v1/products')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(2);
        expect(response.body.meta.pagination.totalItems).toBe(2);
      });

      it('should get only active products as regular user', async () => {
        const response = await request(app)
          .get('/api/v1/products')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].title).toBe('Smartphone Pro');
        expect(response.body.data[0].isActive).toBe(true);
      });

      it('should filter products by category', async () => {
        const response = await request(app)
          .get(`/api/v1/products?categoryId=${testCategory.id}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].category.id).toBe(testCategory.id);
      });

      it('should filter products by price range', async () => {
        const response = await request(app)
          .get('/api/v1/products?minPrice=4000000&maxPrice=6000000')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].title).toBe('Smartphone Pro');
      });
    });

    describe('GET /api/v1/products/featured', () => {
      beforeEach(async () => {
        await Product.create({
          title: 'Featured Product',
          slug: 'featured-product',
          points: 1500,
          price: 5999999.00,
          categoryId: testCategory.id,
          isActive: true,
          isFeatured: true,
          createdBy: adminUser.id
        });

        await Product.create({
          title: 'Regular Product',
          slug: 'regular-product',
          points: 1000,
          price: 3999999.00,
          categoryId: testCategory.id,
          isActive: true,
          isFeatured: false,
          createdBy: adminUser.id
        });
      });

      it('should get only featured products', async () => {
        const response = await request(app)
          .get('/api/v1/products/featured')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].title).toBe('Featured Product');
        expect(response.body.data[0].isFeatured).toBe(true);
      });
    });

    describe('GET /api/v1/products/search', () => {
      beforeEach(async () => {
        await Product.create({
          title: 'Gaming Laptop Pro',
          slug: 'gaming-laptop-pro',
          description: 'High-performance gaming laptop',
          points: 2500,
          price: 15999999.00,
          categoryId: testCategory.id,
          isActive: true,
          createdBy: adminUser.id
        });

        await Product.create({
          title: 'Office Desktop',
          slug: 'office-desktop',
          description: 'Reliable desktop for office work',
          points: 1200,
          price: 8999999.00,
          categoryId: testCategory.id,
          isActive: true,
          createdBy: adminUser.id
        });
      });

      it('should search products by title', async () => {
        const response = await request(app)
          .get('/api/v1/products/search?q=laptop')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].title).toBe('Gaming Laptop Pro');
      });

      it('should search products by description', async () => {
        const response = await request(app)
          .get('/api/v1/products/search?q=gaming')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].title).toBe('Gaming Laptop Pro');
      });

      it('should fail search without query parameter', async () => {
        const response = await request(app)
          .get('/api/v1/products/search')
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.code).toBe('MISSING_REQUIRED_FIELD');
      });
    });
  });
});