const Product = require('../models/Product');
const Category = require('../models/Category');
const ProductImage = require('../models/ProductImage');
const { logUserAction } = require('../utils/logger');
const { deleteFile } = require('../middleware/upload');

class ProductService {
  /**
   * Get all products with pagination and filtering
   * @param {object} options - Query options
   * @returns {object} Products with pagination info
   */
  async getAllProducts(options = {}) {
    const {
      page = 1,
      limit = 10,
      search = '',
      categoryId,
      minPrice,
      maxPrice,
      minPoints,
      maxPoints,
      isActive,
      isFeatured,
      sortBy = 'createdAt',
      sortOrder = 'DESC'
    } = options;

    const offset = (page - 1) * limit;
    const whereClause = {};

    // Add search filter
    if (search) {
      whereClause[Product.sequelize.Sequelize.Op.or] = [
        { title: { [Product.sequelize.Sequelize.Op.like]: `%${search}%` } },
        { description: { [Product.sequelize.Sequelize.Op.like]: `%${search}%` } }
      ];
    }

    // Add category filter
    if (categoryId) {
      whereClause.categoryId = categoryId;
    }

    // Add price range filter
    if (minPrice !== undefined || maxPrice !== undefined) {
      whereClause.price = {};
      if (minPrice !== undefined) whereClause.price[Product.sequelize.Sequelize.Op.gte] = minPrice;
      if (maxPrice !== undefined) whereClause.price[Product.sequelize.Sequelize.Op.lte] = maxPrice;
    }

    // Add points range filter
    if (minPoints !== undefined || maxPoints !== undefined) {
      whereClause.points = {};
      if (minPoints !== undefined) whereClause.points[Product.sequelize.Sequelize.Op.gte] = minPoints;
      if (maxPoints !== undefined) whereClause.points[Product.sequelize.Sequelize.Op.lte] = maxPoints;
    }

    // Add active filter
    if (isActive !== undefined) {
      whereClause.isActive = isActive;
    }

    // Add featured filter
    if (isFeatured !== undefined) {
      whereClause.isFeatured = isFeatured;
    }

    const { count, rows } = await Product.findAndCountAll({
      where: whereClause,
      include: [{
        model: Category,
        as: 'category',
        attributes: ['id', 'name', 'slug']
      }],
      order: [[sortBy, sortOrder.toUpperCase()]],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    return {
      products: rows,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / limit),
        totalItems: count,
        itemsPerPage: parseInt(limit)
      }
    };
  }

  /**
   * Get active products for public view
   * @param {object} options - Query options
   * @returns {object} Active products with pagination
   */
  async getActiveProducts(options = {}) {
    return this.getAllProducts({
      ...options,
      isActive: true
    });
  }

  /**
   * Get featured products
   * @param {number} limit - Number of products to return
   * @returns {Array} Featured products
   */
  async getFeaturedProducts(limit = 10) {
    return Product.findFeaturedProducts(limit);
  }

  /**
   * Get product by ID
   * @param {number} productId - Product ID
   * @param {boolean} includeImages - Include product images
   * @returns {object} Product
   */
  async getProductById(productId, includeImages = false) {
    const includeOptions = [{
      model: Category,
      as: 'category',
      attributes: ['id', 'name', 'slug']
    }];

    if (includeImages) {
      includeOptions.push({
        model: ProductImage,
        as: 'images',
        order: [['isPrimary', 'DESC'], ['sortOrder', 'ASC']]
      });
    }

    const product = await Product.findByPk(productId, {
      include: includeOptions
    });

    if (!product) {
      throw new Error('Product not found');
    }

    return product;
  }

  /**
   * Get product by slug
   * @param {string} slug - Product slug
   * @param {boolean} incrementView - Increment view count
   * @returns {object} Product
   */
  async getProductBySlug(slug, incrementView = false) {
    const product = await Product.findBySlug(slug);

    if (!product) {
      throw new Error('Product not found');
    }

    // Increment view count if requested
    if (incrementView) {
      await product.incrementViewCount();
    }

    return product;
  }

  /**
   * Search products
   * @param {string} query - Search query
   * @param {object} options - Additional options
   * @returns {object} Search results with pagination
   */
  async searchProducts(query, options = {}) {
    return this.getAllProducts({
      ...options,
      search: query,
      isActive: true
    });
  }

  /**
   * Get products by category
   * @param {number} categoryId - Category ID
   * @param {object} options - Query options
   * @returns {object} Products in category
   */
  async getProductsByCategory(categoryId, options = {}) {
    return this.getAllProducts({
      ...options,
      categoryId,
      isActive: true
    });
  }

  /**
   * Create new product
   * @param {object} productData - Product data
   * @param {number} userId - User ID who creates the product
   * @returns {object} Created product
   */
  async createProduct(productData, userId) {
    const {
      title,
      slug,
      description,
      points,
      price,
      url,
      categoryId,
      isActive,
      isFeatured,
      stockQuantity,
      sortOrder,
      metaTitle,
      metaDescription
    } = productData;

    // Verify category exists
    const category = await Category.findByPk(categoryId);
    if (!category) {
      throw new Error('Category not found');
    }

    // Check if product with same slug exists
    const existingProduct = await Product.findOne({
      where: { slug: slug || title.toLowerCase().replace(/\s+/g, '-') }
    });

    if (existingProduct) {
      throw new Error('Product with this slug already exists');
    }

    const product = await Product.create({
      title,
      slug,
      description,
      points: parseInt(points),
      price: parseFloat(price),
      url,
      categoryId: parseInt(categoryId),
      isActive: isActive !== undefined ? isActive : true,
      isFeatured: isFeatured || false,
      stockQuantity: stockQuantity || 0,
      sortOrder: sortOrder || 0,
      metaTitle,
      metaDescription,
      createdBy: userId
    });

    logUserAction('product_created', userId, {
      productId: product.id,
      productTitle: product.title,
      categoryId: product.categoryId
    });

    return product;
  }

  /**
   * Update product
   * @param {number} productId - Product ID
   * @param {object} updateData - Update data
   * @param {number} userId - User ID who updates the product
   * @returns {object} Updated product
   */
  async updateProduct(productId, updateData, userId) {
    const product = await Product.findByPk(productId);

    if (!product) {
      throw new Error('Product not found');
    }

    // Verify category exists if categoryId is being updated
    if (updateData.categoryId) {
      const category = await Category.findByPk(updateData.categoryId);
      if (!category) {
        throw new Error('Category not found');
      }
    }

    // Check for duplicate slug if it's being updated
    if (updateData.slug && updateData.slug !== product.slug) {
      const existingProduct = await Product.findOne({
        where: {
          slug: updateData.slug,
          id: { [Product.sequelize.Sequelize.Op.ne]: productId }
        }
      });

      if (existingProduct) {
        throw new Error('Product with this slug already exists');
      }
    }

    // Convert numeric fields
    if (updateData.points) updateData.points = parseInt(updateData.points);
    if (updateData.price) updateData.price = parseFloat(updateData.price);
    if (updateData.categoryId) updateData.categoryId = parseInt(updateData.categoryId);
    if (updateData.stockQuantity !== undefined) updateData.stockQuantity = parseInt(updateData.stockQuantity);
    if (updateData.sortOrder !== undefined) updateData.sortOrder = parseInt(updateData.sortOrder);

    // Update product
    await product.update({
      ...updateData,
      updatedBy: userId
    });

    logUserAction('product_updated', userId, {
      productId: product.id,
      productTitle: product.title,
      changes: Object.keys(updateData)
    });

    return product;
  }

  /**
   * Delete product
   * @param {number} productId - Product ID
   * @param {number} userId - User ID who deletes the product
   * @returns {boolean} Success status
   */
  async deleteProduct(productId, userId) {
    const product = await Product.findByPk(productId, {
      include: [{
        model: ProductImage,
        as: 'images'
      }]
    });

    if (!product) {
      throw new Error('Product not found');
    }

    // Delete product images from filesystem
    if (product.images && product.images.length > 0) {
      product.images.forEach(image => {
        deleteFile(`uploads/products/${image.imagePath}`);
      });
    }

    // Delete main product image if exists
    if (product.image) {
      deleteFile(`uploads/products/${product.image}`);
    }

    await product.destroy();

    logUserAction('product_deleted', userId, {
      productId,
      productTitle: product.title
    });

    return true;
  }

  /**
   * Upload product image
   * @param {number} productId - Product ID
   * @param {string} filename - Image filename
   * @param {number} userId - User ID
   * @returns {object} Updated product
   */
  async uploadProductImage(productId, filename, userId) {
    const product = await Product.findByPk(productId);

    if (!product) {
      throw new Error('Product not found');
    }

    // Delete old image if exists
    if (product.image) {
      deleteFile(`uploads/products/${product.image}`);
    }

    // Update product with new image
    await product.update({
      image: filename,
      updatedBy: userId
    });

    logUserAction('product_image_uploaded', userId, {
      productId,
      filename
    });

    return product;
  }

  /**
   * Add multiple images to product
   * @param {number} productId - Product ID
   * @param {Array} files - Array of uploaded files
   * @param {number} userId - User ID
   * @returns {Array} Created product images
   */
  async addProductImages(productId, files, userId) {
    const product = await Product.findByPk(productId);

    if (!product) {
      throw new Error('Product not found');
    }

    const productImages = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const productImage = await ProductImage.create({
        productId,
        imagePath: file.filename,
        altText: `${product.title} - Image ${i + 1}`,
        isPrimary: i === 0, // First image is primary by default
        sortOrder: i
      });

      productImages.push(productImage);
    }

    logUserAction('product_images_added', userId, {
      productId,
      imageCount: files.length
    });

    return productImages;
  }

  /**
   * Get product images
   * @param {number} productId - Product ID
   * @returns {Array} Product images
   */
  async getProductImages(productId) {
    return ProductImage.findByProduct(productId);
  }

  /**
   * Delete product image
   * @param {number} imageId - Image ID
   * @param {number} userId - User ID
   * @returns {boolean} Success status
   */
  async deleteProductImage(imageId, userId) {
    const image = await ProductImage.findByPk(imageId);

    if (!image) {
      throw new Error('Image not found');
    }

    // Delete image file
    deleteFile(`uploads/products/${image.imagePath}`);

    await image.destroy();

    logUserAction('product_image_deleted', userId, {
      imageId,
      productId: image.productId
    });

    return true;
  }

  /**
   * Set primary product image
   * @param {number} imageId - Image ID
   * @param {number} productId - Product ID
   * @param {number} userId - User ID
   * @returns {boolean} Success status
   */
  async setPrimaryImage(imageId, productId, userId) {
    await ProductImage.setPrimaryImage(imageId, productId);

    logUserAction('product_primary_image_set', userId, {
      imageId,
      productId
    });

    return true;
  }

  /**
   * Toggle product status
   * @param {number} productId - Product ID
   * @param {number} userId - User ID
   * @returns {object} Updated product
   */
  async toggleProductStatus(productId, userId) {
    const product = await Product.findByPk(productId);

    if (!product) {
      throw new Error('Product not found');
    }

    await product.update({
      isActive: !product.isActive,
      updatedBy: userId
    });

    logUserAction('product_status_toggled', userId, {
      productId,
      newStatus: product.isActive
    });

    return product;
  }

  /**
   * Toggle product featured status
   * @param {number} productId - Product ID
   * @param {number} userId - User ID
   * @returns {object} Updated product
   */
  async toggleProductFeatured(productId, userId) {
    const product = await Product.findByPk(productId);

    if (!product) {
      throw new Error('Product not found');
    }

    await product.update({
      isFeatured: !product.isFeatured,
      updatedBy: userId
    });

    logUserAction('product_featured_toggled', userId, {
      productId,
      newStatus: product.isFeatured
    });

    return product;
  }

  /**
   * Update product stock
   * @param {number} productId - Product ID
   * @param {number} quantity - Quantity change (positive or negative)
   * @param {number} userId - User ID
   * @returns {object} Updated product
   */
  async updateProductStock(productId, quantity, userId) {
    const product = await Product.findByPk(productId);

    if (!product) {
      throw new Error('Product not found');
    }

    await product.updateStock(quantity);

    logUserAction('product_stock_updated', userId, {
      productId,
      quantityChange: quantity,
      newStock: product.stockQuantity + quantity
    });

    return product;
  }

  /**
   * Get product statistics
   * @returns {object} Product statistics
   */
  async getProductStatistics() {
    const totalProducts = await Product.count();
    const activeProducts = await Product.count({ where: { isActive: true } });
    const featuredProducts = await Product.count({ where: { isFeatured: true } });
    const outOfStockProducts = await Product.count({ where: { stockQuantity: 0 } });

    // Top viewed products
    const topViewedProducts = await Product.findAll({
      where: { isActive: true },
      order: [['viewCount', 'DESC']],
      limit: 5,
      attributes: ['id', 'title', 'viewCount'],
      include: [{
        model: Category,
        as: 'category',
        attributes: ['name']
      }]
    });

    // Products by category
    const productsByCategory = await Category.findAll({
      attributes: [
        'id',
        'name',
        [Product.sequelize.fn('COUNT', Product.sequelize.col('products.id')), 'productCount']
      ],
      include: [{
        model: Product,
        as: 'products',
        attributes: [],
        where: { isActive: true },
        required: false
      }],
      group: ['Category.id'],
      order: [[Product.sequelize.fn('COUNT', Product.sequelize.col('products.id')), 'DESC']]
    });

    return {
      totalProducts,
      activeProducts,
      featuredProducts,
      outOfStockProducts,
      topViewedProducts,
      productsByCategory
    };
  }
}

module.exports = new ProductService();