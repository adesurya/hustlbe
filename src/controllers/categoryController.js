const categoryService = require('../services/categoryService');
const { 
  successResponse, 
  errorResponse, 
  asyncHandler,
  HTTP_STATUS,
  SUCCESS_CODES,
  ERROR_CODES,
  createPaginationMeta
} = require('../utils/response');
const { getFileUrl } = require('../middleware/upload');

class CategoryController {
  /**
   * Get all categories (Admin only)
   */
  getAllCategories = asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 10,
      search = '',
      isActive,
      sortBy = 'sortOrder',
      sortOrder = 'ASC',
      includeProductCount = false
    } = req.query;

    const result = await categoryService.getAllCategories({
      page: parseInt(page),
      limit: parseInt(limit),
      search,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      sortBy,
      sortOrder,
      includeProductCount: includeProductCount === 'true'
    });

    // Add image URLs
    result.categories = result.categories.map(category => ({
      ...category.toJSON(),
      imageUrl: category.image ? getFileUrl(category.image, 'categories') : null
    }));

    res.status(HTTP_STATUS.OK.code).json(
      successResponse(
        'Categories retrieved successfully',
        result.categories,
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
   * Get active categories (Public)
   */
  getActiveCategories = asyncHandler(async (req, res) => {
    const categories = await categoryService.getActiveCategories();

    const categoriesWithImageUrl = categories.map(category => ({
      ...category.toJSON(),
      imageUrl: category.image ? getFileUrl(category.image, 'categories') : null
    }));

    res.status(HTTP_STATUS.OK.code).json(
      successResponse(
        'Active categories retrieved successfully',
        categoriesWithImageUrl
      )
    );
  });

  /**
   * Get category by ID
   */
  getCategoryById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { includeProducts = false } = req.query;

    const category = await categoryService.getCategoryById(
      parseInt(id),
      includeProducts === 'true'
    );

    const categoryData = {
      ...category.toJSON(),
      imageUrl: category.image ? getFileUrl(category.image, 'categories') : null
    };

    // Add image URLs to products if included
    if (categoryData.products) {
      categoryData.products = categoryData.products.map(product => ({
        ...product,
        imageUrl: product.image ? getFileUrl(product.image, 'products') : null
      }));
    }

    res.status(HTTP_STATUS.OK.code).json(
      successResponse('Category retrieved successfully', categoryData)
    );
  });

  /**
   * Get category by slug (Public)
   */
  getCategoryBySlug = asyncHandler(async (req, res) => {
    const { slug } = req.params;
    const { includeProducts = false } = req.query;

    const category = await categoryService.getCategoryBySlug(
      slug,
      includeProducts === 'true'
    );

    const categoryData = {
      ...category.toJSON(),
      imageUrl: category.image ? getFileUrl(category.image, 'categories') : null
    };

    // Add image URLs to products if included
    if (categoryData.products) {
      categoryData.products = categoryData.products.map(product => ({
        ...product,
        imageUrl: product.image ? getFileUrl(product.image, 'products') : null
      }));
    }

    res.status(HTTP_STATUS.OK.code).json(
      successResponse('Category retrieved successfully', categoryData)
    );
  });

  /**
   * Create new category (Admin only)
   */
  createCategory = asyncHandler(async (req, res) => {
    const categoryData = req.body;
    const userId = req.user.id;

    const category = await categoryService.createCategory(categoryData, userId);

    const categoryWithImageUrl = {
      ...category.toJSON(),
      imageUrl: category.image ? getFileUrl(category.image, 'categories') : null
    };

    res.status(HTTP_STATUS.CREATED.code).json(
      successResponse(
        'Category created successfully',
        categoryWithImageUrl,
        null,
        SUCCESS_CODES.RESOURCE_CREATED
      )
    );
  });

  /**
   * Update category (Admin only)
   */
  updateCategory = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updateData = req.body;
    const userId = req.user.id;

    const category = await categoryService.updateCategory(
      parseInt(id),
      updateData,
      userId
    );

    const categoryWithImageUrl = {
      ...category.toJSON(),
      imageUrl: category.image ? getFileUrl(category.image, 'categories') : null
    };

    res.status(HTTP_STATUS.OK.code).json(
      successResponse(
        'Category updated successfully',
        categoryWithImageUrl,
        null,
        SUCCESS_CODES.RESOURCE_UPDATED
      )
    );
  });

  /**
   * Delete category (Admin only)
   */
  deleteCategory = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    await categoryService.deleteCategory(parseInt(id), userId);

    res.status(HTTP_STATUS.OK.code).json(
      successResponse(
        'Category deleted successfully',
        null,
        null,
        SUCCESS_CODES.RESOURCE_DELETED
      )
    );
  });

  /**
   * Upload category image (Admin only)
   */
  uploadCategoryImage = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    if (!req.file) {
      return res.status(HTTP_STATUS.BAD_REQUEST.code).json(
        errorResponse('No image file provided', ERROR_CODES.MISSING_REQUIRED_FIELD)
      );
    }

    try {
      const category = await categoryService.uploadCategoryImage(
        parseInt(id),
        req.file.filename,
        userId
      );

      const categoryWithImageUrl = {
        ...category.toJSON(),
        imageUrl: getFileUrl(category.image, 'categories')
      };

      res.status(HTTP_STATUS.OK.code).json(
        successResponse(
          'Category image uploaded successfully',
          categoryWithImageUrl,
          null,
          SUCCESS_CODES.FILE_UPLOADED
        )
      );
    } catch (error) {
      // Delete uploaded file if database operation fails
      const fs = require('fs');
      if (fs.existsSync(`uploads/categories/${req.file.filename}`)) {
        fs.unlinkSync(`uploads/categories/${req.file.filename}`);
      }
      throw error;
    }
  });

  /**
   * Toggle category status (Admin only)
   */
  toggleCategoryStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    const category = await categoryService.toggleCategoryStatus(
      parseInt(id),
      userId
    );

    const categoryWithImageUrl = {
      ...category.toJSON(),
      imageUrl: category.image ? getFileUrl(category.image, 'categories') : null
    };

    res.status(HTTP_STATUS.OK.code).json(
      successResponse(
        `Category ${category.isActive ? 'activated' : 'deactivated'} successfully`,
        categoryWithImageUrl,
        null,
        SUCCESS_CODES.STATUS_UPDATED
      )
    );
  });
}

module.exports = new CategoryController();