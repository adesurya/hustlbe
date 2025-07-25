const express = require('express');
const categoryController = require('../controllers/categoryController');
const { authenticateToken, authorizeRoles, optionalAuth } = require('../middleware/auth');
const {
  validateCategoryCreate,
  validateCategoryUpdate,
  validatePagination,
  validateIdParam
} = require('../middleware/validation');
const { uploadSingleCategory, handleUploadError } = require('../middleware/upload');
const { generalLimiter } = require('../config/security');

const router = express.Router();

// Apply rate limiting
router.use(generalLimiter);

/**
 * @route   GET /api/v1/categories
 * @desc    Get all categories (Admin) or active categories (Public)
 * @access  Public/Admin
 */
router.get('/', optionalAuth, validatePagination, (req, res, next) => {
  // If user is admin, show all categories, otherwise show active categories only
  if (req.user && req.user.role === 'admin') {
    return categoryController.getAllCategories(req, res, next);
  } else {
    return categoryController.getActiveCategories(req, res, next);
  }
});

/**
 * @route   GET /api/v1/categories/active
 * @desc    Get active categories
 * @access  Public
 */
router.get('/active', categoryController.getActiveCategories);

/**
 * @route   GET /api/v1/categories/:id
 * @desc    Get category by ID
 * @access  Public
 */
router.get('/:id', validateIdParam, categoryController.getCategoryById);

/**
 * @route   GET /api/v1/categories/slug/:slug
 * @desc    Get category by slug
 * @access  Public
 */
router.get('/slug/:slug', categoryController.getCategoryBySlug);

/**
 * @route   POST /api/v1/categories
 * @desc    Create new category
 * @access  Admin
 */
router.post('/',
  authenticateToken,
  authorizeRoles('admin'),
  validateCategoryCreate,
  categoryController.createCategory
);

/**
 * @route   PUT /api/v1/categories/:id
 * @desc    Update category
 * @access  Admin
 */
router.put('/:id',
  authenticateToken,
  authorizeRoles('admin'),
  validateIdParam,
  validateCategoryUpdate,
  categoryController.updateCategory
);

/**
 * @route   DELETE /api/v1/categories/:id
 * @desc    Delete category
 * @access  Admin
 */
router.delete('/:id',
  authenticateToken,
  authorizeRoles('admin'),
  validateIdParam,
  categoryController.deleteCategory
);

/**
 * @route   POST /api/v1/categories/:id/image
 * @desc    Upload category image
 * @access  Admin
 */
router.post('/:id/image',
  authenticateToken,
  authorizeRoles('admin'),
  validateIdParam,
  uploadSingleCategory,
  handleUploadError,
  categoryController.uploadCategoryImage
);

/**
 * @route   PATCH /api/v1/categories/:id/toggle-status
 * @desc    Toggle category active status
 * @access  Admin
 */
router.patch('/:id/toggle-status',
  authenticateToken,
  authorizeRoles('admin'),
  validateIdParam,
  categoryController.toggleCategoryStatus
);

module.exports = router;