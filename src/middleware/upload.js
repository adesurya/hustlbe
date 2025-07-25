const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { logSecurityEvent } = require('../utils/logger');

// Ensure upload directories exist
const createUploadDirs = () => {
  const dirs = [
    'uploads',
    'uploads/categories',
    'uploads/products',
    'uploads/temp'
  ];
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};

createUploadDirs();

// File filter function
const fileFilter = (req, file, cb) => {
  // Allowed file extensions
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg', 
    'image/png', 
    'image/gif',
    'image/webp'
  ];
  
  const fileExtension = path.extname(file.originalname).toLowerCase();
  const mimeType = file.mimetype.toLowerCase();
  
  // Check file extension
  if (!allowedExtensions.includes(fileExtension)) {
    logSecurityEvent('file_upload_invalid_extension', {
      filename: file.originalname,
      extension: fileExtension,
      mimetype: mimeType,
      userId: req.user ? req.user.id : null
    });
    
    return cb(new Error(`Invalid file extension. Allowed: ${allowedExtensions.join(', ')}`), false);
  }
  
  // Check MIME type
  if (!allowedMimeTypes.includes(mimeType)) {
    logSecurityEvent('file_upload_invalid_mimetype', {
      filename: file.originalname,
      extension: fileExtension,
      mimetype: mimeType,
      userId: req.user ? req.user.id : null
    });
    
    return cb(new Error(`Invalid file type. Allowed: ${allowedMimeTypes.join(', ')}`), false);
  }
  
  cb(null, true);
};

// Storage configuration for categories
const categoryStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/categories');
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = crypto.randomBytes(16).toString('hex');
    const fileExtension = path.extname(file.originalname).toLowerCase();
    const filename = `category_${Date.now()}_${uniqueSuffix}${fileExtension}`;
    
    cb(null, filename);
  }
});

// Storage configuration for products
const productStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/products');
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = crypto.randomBytes(16).toString('hex');
    const fileExtension = path.extname(file.originalname).toLowerCase();
    const filename = `product_${Date.now()}_${uniqueSuffix}${fileExtension}`;
    
    cb(null, filename);
  }
});

// Multer configuration
const multerConfig = {
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 10 // Maximum 10 files
  }
};

// Create upload middleware instances
const uploadCategory = multer({
  storage: categoryStorage,
  ...multerConfig
});

const uploadProduct = multer({
  storage: productStorage,
  ...multerConfig
});

// Middleware for single file upload
const uploadSingleCategory = uploadCategory.single('image');
const uploadSingleProduct = uploadProduct.single('image');

// Middleware for multiple files upload
const uploadMultipleProducts = uploadProduct.array('images', 10);

// Error handling middleware for multer
const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    logSecurityEvent('file_upload_error', {
      error: error.message,
      code: error.code,
      field: error.field,
      userId: req.user ? req.user.id : null
    });
    
    let message = 'File upload error';
    
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        message = 'File too large. Maximum size is 5MB';
        break;
      case 'LIMIT_FILE_COUNT':
        message = 'Too many files. Maximum is 10 files';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        message = 'Unexpected field name';
        break;
      case 'LIMIT_PART_COUNT':
        message = 'Too many parts';
        break;
      case 'LIMIT_FIELD_KEY':
        message = 'Field name too long';
        break;
      case 'LIMIT_FIELD_VALUE':
        message = 'Field value too long';
        break;
      case 'LIMIT_FIELD_COUNT':
        message = 'Too many fields';
        break;
    }
    
    return res.status(400).json({
      success: false,
      message,
      code: 'UPLOAD_ERROR'
    });
  }
  
  if (error.message.includes('Invalid file')) {
    return res.status(400).json({
      success: false,
      message: error.message,
      code: 'INVALID_FILE_TYPE'
    });
  }
  
  next(error);
};

// Utility function to delete uploaded file
const deleteFile = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
  } catch (error) {
    console.error('Error deleting file:', error);
  }
  return false;
};

// Utility function to get file URL
const getFileUrl = (filename, type = 'products') => {
  if (!filename) return null;
  
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  return `${baseUrl}/uploads/${type}/${filename}`;
};

// Utility function to validate image file
const validateImageFile = (file) => {
  const errors = [];
  
  if (!file) {
    errors.push('No file provided');
    return errors;
  }
  
  // Check file size (5MB limit)
  if (file.size > 5 * 1024 * 1024) {
    errors.push('File size exceeds 5MB limit');
  }
  
  // Check file type
  const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedMimeTypes.includes(file.mimetype.toLowerCase())) {
    errors.push('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed');
  }
  
  return errors;
};

module.exports = {
  uploadSingleCategory,
  uploadSingleProduct,
  uploadMultipleProducts,
  handleUploadError,
  deleteFile,
  getFileUrl,
  validateImageFile,
  createUploadDirs
};