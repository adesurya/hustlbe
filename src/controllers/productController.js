const productService = require('../services/productService');
const { 
  successResponse, 
  errorResponse, 
  asyncHandler,
  HTTP_STATUS,
  SUCCESS_CODES,
  ERROR_CODES,
  createPaginationMeta
} = require('../utils/response');
const { getFileUrl, deleteFile } = require('../middleware/upload');

class ProductController {
  /**
   * Get all products (Admin only)
   */
  getAllProducts = asyncHandler(async (req, res) => {
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
    } = req.query;

    const result = await productService.getAllProducts({
      page: parseInt(page),
      limit: parseInt(limit),
      search,
      categoryId: categoryId ? parseInt(categoryId) : undefined,
      minPrice: minPrice ? parseFloat(minPrice) : undefined,
      maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
      minPoints: minPoints ? parseInt(minPoints) : undefined,
      maxPoints: maxPoints ? parseInt(maxPoints) : undefined,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      isFeatured: isFeatured !== undefined ? isFeatured === 'true' : undefined,
      sortBy,
      sortOrder
    });

    // Add image URLs
    result.products = result.products.map(product => ({
      ...product.toSafeJSON(),
      imageUrl: product.image ? getFileUrl(product.image, 'products') : null
    }));

    res.status(HTTP_STATUS.OK.code).json(
      successResponse(
        'Products retrieved successfully',
        result.products,
        createPaginationMeta(
          result.pagination.currentPage,
          result.pagination.itemsPerPage,
          result.pagination.totalItems,
          result.pagination.totalPages
        )
      )
    );
  });

  /**
   * Get active products (Public)
   */
  getActiveProducts = asyncHandler(async (req, res) => {
    const queryOptions = { ...req.query };
    
    const result = await productService.getActiveProducts({
      page: parseInt(queryOptions.page) || 1,
      limit: parseInt(queryOptions.limit) || 10,
      search: queryOptions.search || '',
      categoryId: queryOptions.categoryId ? parseInt(queryOptions.categoryId) : undefined,
      minPrice: queryOptions.minPrice ? parseFloat(queryOptions.minPrice) : undefined,
      maxPrice: queryOptions.maxPrice ? parseFloat(queryOptions.maxPrice) : undefined,
      minPoints: queryOptions.minPoints ? parseInt(queryOptions.minPoints) : undefined,
      maxPoints: queryOptions.maxPoints ? parseInt(queryOptions.maxPoints) : undefined,
      isFeatured: queryOptions.isFeatured !== undefined ? queryOptions.isFeatured === 'true' : undefined,
      sortBy: queryOptions.sortBy || 'createdAt',
      sortOrder: queryOptions.sortOrder || 'DESC'
    });

    // Add image URLs
    result.products = result.products.map(product => ({
      ...product.toSafeJSON(),
      imageUrl: product.image ? getFileUrl(product.image, 'products') : null
    }));

    res.status(HTTP_STATUS.OK.code).json(
      successResponse(
        'Products retrieved successfully',
        result.products,
        createPaginationMeta(
          result.pagination.currentPage,
          result.pagination.itemsPerPage,
          result.pagination.totalItems,
          result.pagination.totalPages
        )
      )
    );
  });

  /**
   * Get featured products (Public)
   */
  getFeaturedProducts = asyncHandler(async (req, res) => {
    const { limit = 10 } = req.query;
    
    const products = await productService.getFeaturedProducts(parseInt(limit));

    const productsWithImageUrl = products.map(product => ({
      ...product.toSafeJSON(),
      imageUrl: product.image ? getFileUrl(product.image, 'products') : null
    }));

    res.status(HTTP_STATUS.OK.code).json(
      successResponse('Featured products retrieved successfully', productsWithImageUrl)
    );
  });

  /**
   * Get product by ID
   */
  getProductById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { includeImages = false } = req.query;

    const product = await productService.getProductById(
      parseInt(id),
      includeImages === 'true'
    );

    const productData = {
      ...product.toSafeJSON(),
      imageUrl: product.image ? getFileUrl(product.image, 'products') : null
    };

    // Add image URLs to additional images if included
    if (productData.images) {
      productData.images = productData.images.map(image => ({
        ...image.toJSON(),
        imageUrl: getFileUrl(image.imagePath, 'products')
      }));
    }

    res.status(HTTP_STATUS.OK.code).json(
      successResponse('Product retrieved successfully', productData)
    );
  });

  /**
   * Get product by slug (Public)
   */
  getProductBySlug = asyncHandler(async (req, res) => {
    const { slug } = req.params;
    const incrementView = req.user ? false : true; // Only increment for non-authenticated users

    const product = await productService.getProductBySlug(slug, incrementView);

    const productData = {
      ...product.toSafeJSON(),
      imageUrl: product.image ? getFileUrl(product.image, 'products') : null
    };

    res.status(HTTP_STATUS.OK.code).json(
      successResponse('Product retrieved successfully', productData)
    );
  });

  /**
   * Search products (Public)
   */
  searchProducts = asyncHandler(async (req, res) => {
    const { q: query, ...options } = req.query;

    if (!query || query.trim().length === 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST.code).json(
        errorResponse('Search query is required', ERROR_CODES.MISSING_REQUIRED_FIELD)
      );
    }

    const result = await productService.searchProducts(query.trim(), {
      page: parseInt(options.page) || 1,
      limit: parseInt(options.limit) || 10,
      categoryId: options.categoryId ? parseInt(options.categoryId) : undefined,
      minPrice: options.minPrice ? parseFloat(options.minPrice) : undefined,
      maxPrice: options.maxPrice ? parseFloat(options.maxPrice) : undefined,
      sortBy: options.sortBy || 'viewCount',
      sortOrder: options.sortOrder || 'DESC'
    });

    // Add image URLs
    result.products = result.products.map(product => ({
      ...product.toSafeJSON(),
      imageUrl: product.image ? getFileUrl(product.image, 'products') : null
    }));

    res.status(HTTP_STATUS.OK.code).json(
      successResponse(
        `Search results for "${query}"`,
        result.products,
        createPaginationMeta(
          result.pagination.currentPage,
          result.pagination.itemsPerPage,
          result.pagination.totalItems,
          result.pagination.totalPages
        )
      )
    );
  });

  /**
   * Get products by category (Public)
   */
  getProductsByCategory = asyncHandler(async (req, res) => {
    const { categoryId } = req.params;
    const options = req.query;

    const result = await productService.getProductsByCategory(parseInt(categoryId), {
      page: parseInt(options.page) || 1,
      limit: parseInt(options.limit) || 10,
      minPrice: options.minPrice ? parseFloat(options.minPrice) : undefined,
      maxPrice: options.maxPrice ? parseFloat(options.maxPrice) : undefined,
      sortBy: options.sortBy || 'sortOrder',
      sortOrder: options.sortOrder || 'ASC'
    });

    // Add image URLs
    result.products = result.products.map(product => ({
      ...product.toSafeJSON(),
      imageUrl: product.image ? getFileUrl(product.image, 'products') : null
    }));

    res.status(HTTP_STATUS.OK.code).json(
      successResponse(
        'Products retrieved successfully',
        result.products,
        createPaginationMeta(
          result.pagination.currentPage,
          result.pagination.itemsPerPage,
          result.pagination.totalItems,
          result.pagination.totalPages
        )
      )
    );
  });

  /**
   * Create new product with optional image upload
   */
  createProduct = asyncHandler(async (req, res) => {
    const productData = req.body;
    const userId = req.user.id;
    
    // Get uploaded file if exists
    const imageFile = req.file;

    try {
      const product = await productService.createProduct(productData, userId, imageFile?.filename);

      const productWithImageUrl = {
        ...product.toSafeJSON(),
        imageUrl: product.image ? getFileUrl(product.image, 'products') : null
      };

      res.status(HTTP_STATUS.CREATED.code).json(
        successResponse(
          'Product created successfully',
          productWithImageUrl,
          null,
          SUCCESS_CODES.RESOURCE_CREATED
        )
      );
    } catch (error) {
      // Delete uploaded file if database operation fails
      if (imageFile) {
        deleteFile(`uploads/products/${imageFile.filename}`);
      }
      throw error;
    }
  });

  /**
 * Update product (Admin only)
 */
updateProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;
  const userId = req.user.id;
  
  // Get uploaded file if exists
  const imageFile = req.file;

  try {
    const product = await productService.updateProduct(
      parseInt(id),
      updateData,
      userId,
      imageFile?.filename  // ← Pass image filename to service
    );

    const productWithImageUrl = {
      ...product.toSafeJSON(),
      imageUrl: product.image ? getFileUrl(product.image, 'products') : null
    };

    res.status(HTTP_STATUS.OK.code).json(
      successResponse(
        'Product updated successfully',
        productWithImageUrl,
        null,
        SUCCESS_CODES.RESOURCE_UPDATED
      )
    );
  } catch (error) {
    // Delete uploaded file if database operation fails
    if (imageFile) {
      deleteFile(`uploads/products/${imageFile.filename}`);
    }
    throw error;
  }
});

  /**
   * Delete product (Admin only)
   */
  deleteProduct = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    await productService.deleteProduct(parseInt(id), userId);

    res.status(HTTP_STATUS.OK.code).json(
      successResponse(
        'Product deleted successfully',
        null,
        null,
        SUCCESS_CODES.RESOURCE_DELETED
      )
    );
  });

  /**
   * Upload product image (Admin only) - for existing products
   */
  uploadProductImage = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    if (!req.file) {
      return res.status(HTTP_STATUS.BAD_REQUEST.code).json(
        errorResponse('No image file provided', ERROR_CODES.MISSING_REQUIRED_FIELD)
      );
    }

    try {
      const product = await productService.uploadProductImage(
        parseInt(id),
        req.file.filename,
        userId
      );

      const productWithImageUrl = {
        ...product.toSafeJSON(),
        imageUrl: getFileUrl(product.image, 'products')
      };

      res.status(HTTP_STATUS.OK.code).json(
        successResponse(
          'Product image uploaded successfully',
          productWithImageUrl,
          null,
          SUCCESS_CODES.FILE_UPLOADED
        )
      );
    } catch (error) {
      // Delete uploaded file if database operation fails
      deleteFile(`uploads/products/${req.file.filename}`);
      throw error;
    }
  });

  /**
   * Get product statistics (Admin only)
   */
  getProductStatistics = asyncHandler(async (req, res) => {
    const statistics = await productService.getProductStatistics();

    res.status(HTTP_STATUS.OK.code).json(
      successResponse('Product statistics retrieved successfully', statistics)
    );
  });

  /**
   * Toggle product status (Admin only)
   */
  toggleProductStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    const product = await productService.toggleProductStatus(parseInt(id), userId);

    const productWithImageUrl = {
      ...product.toSafeJSON(),
      imageUrl: product.image ? getFileUrl(product.image, 'products') : null
    };

    res.status(HTTP_STATUS.OK.code).json(
      successResponse(
        `Product ${product.isActive ? 'activated' : 'deactivated'} successfully`,
        productWithImageUrl,
        null,
        SUCCESS_CODES.STATUS_UPDATED
      )
    );
  });

  /**
   * Toggle product featured status (Admin only)
   */
  toggleProductFeatured = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    const product = await productService.toggleProductFeatured(parseInt(id), userId);

    const productWithImageUrl = {
      ...product.toSafeJSON(),
      imageUrl: product.image ? getFileUrl(product.image, 'products') : null
    };

    res.status(HTTP_STATUS.OK.code).json(
      successResponse(
        `Product ${product.isFeatured ? 'marked as featured' : 'unmarked as featured'} successfully`,
        productWithImageUrl,
        null,
        SUCCESS_CODES.STATUS_UPDATED
      )
    );
  });

  /**
   * Update product stock (Admin only)
   */
  updateProductStock = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { quantity } = req.body;
    const userId = req.user.id;

    if (!quantity || isNaN(quantity)) {
      return res.status(HTTP_STATUS.BAD_REQUEST.code).json(
        errorResponse('Valid quantity is required', ERROR_CODES.VALIDATION_ERROR)
      );
    }

    const product = await productService.updateProductStock(
      parseInt(id),
      parseInt(quantity),
      userId
    );

    const productWithImageUrl = {
      ...product.toSafeJSON(),
      imageUrl: product.image ? getFileUrl(product.image, 'products') : null
    };

    res.status(HTTP_STATUS.OK.code).json(
      successResponse(
        'Product stock updated successfully',
        productWithImageUrl,
        null,
        SUCCESS_CODES.RESOURCE_UPDATED
      )
    );
  });
}

module.exports = new ProductController();