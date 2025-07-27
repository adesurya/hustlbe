const Category = require('../models/Category');
const Product = require('../models/Product');
const { logUserAction } = require('../utils/logger');
const { deleteFile } = require('../middleware/upload');

class CategoryService {
  /**
   * Get all categories with pagination and filtering
   * @param {object} options - Query options
   * @returns {object} Categories with pagination info
   */
  async getAllCategories(options = {}) {
    const {
      page = 1,
      limit = 10,
      search = '',
      isActive,
      sortBy = 'sortOrder',
      sortOrder = 'ASC',
      includeProductCount = false
    } = options;

    const offset = (page - 1) * limit;
    const whereClause = {};

    // Add search filter
    if (search) {
      whereClause[Category.sequelize.Sequelize.Op.or] = [
        { name: { [Category.sequelize.Sequelize.Op.like]: `%${search}%` } },
        { description: { [Category.sequelize.Sequelize.Op.like]: `%${search}%` } }
      ];
    }

    // Add active filter
    if (isActive !== undefined) {
      whereClause.isActive = isActive;
    }

    // Build query options
    const queryOptions = {
      where: whereClause,
      order: [[sortBy, sortOrder.toUpperCase()]],
      limit: parseInt(limit),
      offset: parseInt(offset)
    };

    // Include product count if requested
    if (includeProductCount) {
      queryOptions.attributes = {
        include: [
          [
            Category.sequelize.fn('COUNT', Category.sequelize.col('products.id')),
            'productCount'
          ]
        ]
      };
      queryOptions.include = [{
        model: Product,
        as: 'products',
        attributes: [],
        required: false,
        where: { isActive: true }
      }];
      queryOptions.group = ['Category.id'];
      queryOptions.subQuery = false;
    }

    const { count, rows } = await Category.findAndCountAll(queryOptions);

    return {
      categories: rows,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / limit),
        totalItems: count,
        itemsPerPage: parseInt(limit)
      }
    };
  }

  /**
   * Get active categories for public view
   * @returns {Array} Active categories
   */
  async getActiveCategories() {
    return Category.findActiveCategories({
      attributes: ['id', 'name', 'slug', 'description', 'image', 'sortOrder']
    });
  }

  /**
   * Get category by ID
   * @param {number} categoryId - Category ID
   * @param {boolean} includeProducts - Include products
   * @returns {object} Category
   */
  async getCategoryById(categoryId, includeProducts = false) {
    const includeOptions = [];

    if (includeProducts) {
      includeOptions.push({
        model: Product,
        as: 'products',
        where: { isActive: true },
        required: false,
        attributes: ['id', 'title', 'slug', 'price', 'points', 'image', 'isFeatured']
      });
    }

    const category = await Category.findByPk(categoryId, {
      include: includeOptions
    });

    if (!category) {
      throw new Error('Category not found');
    }

    return category;
  }

  /**
   * Get category by slug
   * @param {string} slug - Category slug
   * @param {boolean} includeProducts - Include products
   * @returns {object} Category
   */
  async getCategoryBySlug(slug, includeProducts = false) {
    const includeOptions = [];

    if (includeProducts) {
      includeOptions.push({
        model: Product,
        as: 'products',
        where: { isActive: true },
        required: false,
        attributes: ['id', 'title', 'slug', 'price', 'points', 'image', 'isFeatured'],
        order: [['sortOrder', 'ASC'], ['createdAt', 'DESC']]
      });
    }

    const category = await Category.findOne({
      where: { slug },
      include: includeOptions
    });

    if (!category) {
      throw new Error('Category not found');
    }

    return category;
  }

  /**
   * Create new category
   * @param {object} categoryData - Category data
   * @param {number} userId - User ID who creates the category
   * @returns {object} Created category
   */
  async createCategory(categoryData, userId) {
    const { name, slug, description, isActive, sortOrder } = categoryData;

    // Check if category with same name or slug exists (including soft deleted ones)
    const existingCategory = await Category.findOne({
      where: {
        [Category.sequelize.Sequelize.Op.or]: [
          { name },
          { slug: slug || name.toLowerCase().replace(/\s+/g, '-') }
        ]
      },
      paranoid: false // Include soft deleted records
    });

    if (existingCategory) {
      const field = existingCategory.name === name ? 'name' : 'slug';
      throw new Error(`Category with this ${field} already exists`);
    }

    const category = await Category.create({
      name,
      slug,
      description,
      isActive: isActive !== undefined ? isActive : true,
      sortOrder: sortOrder || 0,
      createdBy: userId
    });

    logUserAction('category_created', userId, {
      categoryId: category.id,
      categoryName: category.name
    });

    return category;
  }

  /**
   * Update category
   * @param {number} categoryId - Category ID
   * @param {object} updateData - Update data
   * @param {number} userId - User ID who updates the category
   * @returns {object} Updated category
   */
  async updateCategory(categoryId, updateData, userId) {
    const category = await Category.findByPk(categoryId);

    if (!category) {
      throw new Error('Category not found');
    }

    // Check for duplicate name/slug if they're being updated
    if (updateData.name || updateData.slug) {
      const whereClause = {
        id: { [Category.sequelize.Sequelize.Op.ne]: categoryId }
      };

      const orConditions = [];
      if (updateData.name) orConditions.push({ name: updateData.name });
      if (updateData.slug) orConditions.push({ slug: updateData.slug });

      if (orConditions.length > 0) {
        whereClause[Category.sequelize.Sequelize.Op.or] = orConditions;
      }

      const existingCategory = await Category.findOne({ 
        where: whereClause,
        paranoid: false // Include soft deleted records
      });

      if (existingCategory) {
        const field = existingCategory.name === updateData.name ? 'name' : 'slug';
        throw new Error(`Category with this ${field} already exists`);
      }
    }

    // Update category
    await category.update({
      ...updateData,
      updatedBy: userId
    });

    logUserAction('category_updated', userId, {
      categoryId: category.id,
      categoryName: category.name,
      changes: Object.keys(updateData)
    });

    return category;
  }

  /**
   * Delete category (Soft delete)
   * @param {number} categoryId - Category ID
   * @param {number} userId - User ID who deletes the category
   * @returns {boolean} Success status
   */
  async deleteCategory(categoryId, userId) {
    const category = await Category.findByPk(categoryId);

    if (!category) {
      throw new Error('Category not found');
    }

    // Check if category has active products
    const productCount = await Product.count({
      where: { 
        categoryId,
        isActive: true 
      }
    });

    if (productCount > 0) {
      throw new Error('Cannot delete category that has active products. Please deactivate or move products first.');
    }

    // Perform soft delete
    await category.destroy();

    logUserAction('category_deleted', userId, {
      categoryId,
      categoryName: category.name
    });

    return true;
  }

  /**
   * Force delete category (Hard delete)
   * @param {number} categoryId - Category ID
   * @param {number} userId - User ID who deletes the category
   * @returns {boolean} Success status
   */
  async forceDeleteCategory(categoryId, userId) {
    const category = await Category.findByPk(categoryId, {
      paranoid: false // Include soft deleted records
    });

    if (!category) {
      throw new Error('Category not found');
    }

    // Check if category has products
    const productCount = await Product.count({
      where: { categoryId },
      paranoid: false // Include soft deleted products
    });

    if (productCount > 0) {
      throw new Error('Cannot permanently delete category that has products. Please delete products first.');
    }

    // Delete category image if exists
    if (category.image) {
      deleteFile(`uploads/categories/${category.image}`);
    }

    // Force delete (permanent)
    await category.destroy({ force: true });

    logUserAction('category_force_deleted', userId, {
      categoryId,
      categoryName: category.name
    });

    return true;
  }

  /**
   * Restore soft deleted category
   * @param {number} categoryId - Category ID
   * @param {number} userId - User ID who restores the category
   * @returns {object} Restored category
   */
  async restoreCategory(categoryId, userId) {
    const category = await Category.findByPk(categoryId, {
      paranoid: false
    });

    if (!category) {
      throw new Error('Category not found');
    }

    if (!category.deletedAt) {
      throw new Error('Category is not deleted');
    }

    await category.restore();

    logUserAction('category_restored', userId, {
      categoryId,
      categoryName: category.name
    });

    return category;
  }

  /**
   * Upload category image
   * @param {number} categoryId - Category ID
   * @param {string} filename - Image filename
   * @param {number} userId - User ID
   * @returns {object} Updated category
   */
  async uploadCategoryImage(categoryId, filename, userId) {
    const category = await Category.findByPk(categoryId);

    if (!category) {
      throw new Error('Category not found');
    }

    // Delete old image if exists
    if (category.image) {
      deleteFile(`uploads/categories/${category.image}`);
    }

    // Update category with new image
    await category.update({
      image: filename,
      updatedBy: userId
    });

    logUserAction('category_image_uploaded', userId, {
      categoryId,
      filename
    });

    return category;
  }

  /**
   * Toggle category status
   * @param {number} categoryId - Category ID
   * @param {number} userId - User ID
   * @returns {object} Updated category
   */
  async toggleCategoryStatus(categoryId, userId) {
    const category = await Category.findByPk(categoryId);

    if (!category) {
      throw new Error('Category not found');
    }

    await category.update({
      isActive: !category.isActive,
      updatedBy: userId
    });

    logUserAction('category_status_toggled', userId, {
      categoryId,
      newStatus: category.isActive
    });

    return category;
  }
}

module.exports = new CategoryService();