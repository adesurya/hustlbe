const express = require('express');
const productController = require('../controllers/productController');
const { authenticateToken, authorizeRoles, optionalAuth } = require('../middleware/auth');
const {
  validateProductCreate,
  validateProductUpdate,
  validateProductFilter,
  validatePagination,
  validateIdParam
} = require('../middleware/validation');
const { uploadSingleProduct, handleUploadError } = require('../middleware/upload');
const { generalLimiter } = require('../config/security');

const router = express.Router();

// Apply rate limiting
router.use(generalLimiter);

/**
 * @route   GET /api/v1/products
 * @desc    Get all products (Admin) or active products (Public)
 * @access  Public/Admin
 */
router.get('/', optionalAuth, validatePagination, validateProductFilter, (req, res, next) => {
  // If user is admin, show all products, otherwise show active products only
  if (req.user && req.user.role === 'admin') {
    return productController.getAllProducts(req, res, next);
  } else {
    return productController.getActiveProducts(req, res, next);
  }
});

/**
 * @route   GET /api/v1/products/featured
 * @desc    Get featured products
 * @access  Public
 */
router.get('/featured', productController.getFeaturedProducts);

/**
 * @route   GET /api/v1/products/search
 * @desc    Search products
 * @access  Public
 */
router.get('/search', validateProductFilter, productController.searchProducts);

/**
 * @route   GET /api/v1/products/statistics
 * @desc    Get product statistics
 * @access  Admin
 */
router.get('/statistics',
  authenticateToken,
  authorizeRoles('admin'),
  productController.getProductStatistics
);

/**
 * @route   GET /api/v1/products/category/:categoryId
 * @desc    Get products by category
 * @access  Public
 */
router.get('/category/:categoryId',
  validateIdParam,
  validatePagination,
  validateProductFilter,
  productController.getProductsByCategory
);

/**
 * @route   GET /api/v1/products/:id
 * @desc    Get product by ID
 * @access  Public
 */
router.get('/:id', validateIdParam, productController.getProductById);

/**
 * @route   GET /api/v1/products/slug/:slug
 * @desc    Get product by slug
 * @access  Public
 */
router.get('/slug/:slug', optionalAuth, productController.getProductBySlug);

/**
 * @route   POST /api/v1/products
 * @desc    Create new product with optional image upload
 * @access  Admin
 */
router.post('/',
  authenticateToken,
  authorizeRoles('admin'),
  uploadSingleProduct, // Handle file upload first
  handleUploadError,
  validateProductCreate,
  productController.createProduct
);


/**
 * @route   PUT /api/v1/products/:id
 * @desc    Update product with optional image upload
 * @access  Admin
 */
router.put('/:id',
  authenticateToken,
  authorizeRoles('admin'),
  validateIdParam,
  uploadSingleProduct,      // ← Tambahkan middleware upload
  handleUploadError,        // ← Tambahkan error handler
  validateProductUpdate,
  productController.updateProduct
);

/**
 * @route   DELETE /api/v1/products/:id
 * @desc    Delete product
 * @access  Admin
 */
router.delete('/:id',
  authenticateToken,
  authorizeRoles('admin'),
  validateIdParam,
  productController.deleteProduct
);

/**
 * @route   POST /api/v1/products/:id/image
 * @desc    Upload product image (separate endpoint for existing products)
 * @access  Admin
 */
router.post('/:id/image',
  authenticateToken,
  authorizeRoles('admin'),
  validateIdParam,
  uploadSingleProduct,
  handleUploadError,
  productController.uploadProductImage
);

/**
 * @route   PATCH /api/v1/products/:id/toggle-status
 * @desc    Toggle product active status
 * @access  Admin
 */
router.patch('/:id/toggle-status',
  authenticateToken,
  authorizeRoles('admin'),
  validateIdParam,
  productController.toggleProductStatus
);

/**
 * @route   PATCH /api/v1/products/:id/toggle-featured
 * @desc    Toggle product featured status
 * @access  Admin
 */
router.patch('/:id/toggle-featured',
  authenticateToken,
  authorizeRoles('admin'),
  validateIdParam,
  productController.toggleProductFeatured
);

/**
 * @route   PATCH /api/v1/products/:id/stock
 * @desc    Update product stock
 * @access  Admin
 */
router.patch('/:id/stock',
  authenticateToken,
  authorizeRoles('admin'),
  validateIdParam,
  productController.updateProductStock
);

module.exports = router;