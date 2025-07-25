# API Documentation - Secure Node.js Backend

## Base URL
```
http://localhost:3000/api/v1
```

## Authentication
Most endpoints require authentication using JWT Bearer token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## Response Format
All API responses follow this standard format:
```json
{
  "success": true|false,
  "message": "Response message",
  "data": {...},
  "code": "SUCCESS_CODE",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "meta": {
    "pagination": {...}
  }
}
```

---

# Authentication Endpoints

## POST /auth/register
Register a new user account.

**Access:** Public

**Request Body:**
```json
{
  "username": "johndoe",
  "email": "john@example.com",
  "phoneNumber": "+6281234567890",
  "password": "SecurePass123!",
  "confirmPassword": "SecurePass123!"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "User registered successfully. Please verify your email.",
  "data": {
    "user": {
      "id": 1,
      "username": "johndoe",
      "email": "john@example.com",
      "phoneNumber": "+6281234567890",
      "role": "user",
      "isVerified": false,
      "isActive": true,
      "createdAt": "2024-01-01T00:00:00.000Z"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "code": "USER_CREATED",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## POST /auth/login
Login with username/email and password.

**Access:** Public

**Request Body:**
```json
{
  "identifier": "johndoe",
  "password": "SecurePass123!"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": 1,
      "username": "johndoe",
      "email": "john@example.com",
      "role": "user",
      "lastLogin": "2024-01-01T00:00:00.000Z"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "code": "LOGIN_SUCCESS"
}
```

## GET /auth/google
Initiate Google OAuth login.

**Access:** Public

**Response:** Redirects to Google OAuth consent screen.

## POST /auth/logout
Logout current user.

**Access:** Private (User/Admin)

**Headers:**
```
Authorization: Bearer <access-token>
```

**Response (200):**
```json
{
  "success": true,
  "message": "Logout successful",
  "code": "LOGOUT_SUCCESS"
}
```

---

# Category Endpoints

## GET /categories
Get categories list. Shows all categories for admin, active categories for public.

**Access:** Public

**Query Parameters:**
- `page` (integer, default: 1) - Page number
- `limit` (integer, default: 10) - Items per page
- `search` (string) - Search query
- `isActive` (boolean) - Filter by active status (admin only)
- `sortBy` (string, default: 'sortOrder') - Sort field
- `sortOrder` (string, default: 'ASC') - Sort direction
- `includeProductCount` (boolean) - Include product count

**Response (200):**
```json
{
  "success": true,
  "message": "Categories retrieved successfully",
  "data": [
    {
      "id": 1,
      "name": "Electronics",
      "slug": "electronics",
      "description": "Electronic devices and gadgets",
      "imageUrl": "http://localhost:3000/uploads/categories/category_123456.jpg",
      "isActive": true,
      "sortOrder": 1,
      "productCount": 15,
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "meta": {
    "pagination": {
      "currentPage": 1,
      "itemsPerPage": 10,
      "totalItems": 5,
      "totalPages": 1
    }
  }
}
```

## GET /categories/active
Get only active categories.

**Access:** Public

**Response (200):**
```json
{
  "success": true,
  "message": "Active categories retrieved successfully",
  "data": [
    {
      "id": 1,
      "name": "Electronics",
      "slug": "electronics",
      "description": "Electronic devices and gadgets",
      "imageUrl": "http://localhost:3000/uploads/categories/category_123456.jpg",
      "sortOrder": 1
    }
  ]
}
```

## GET /categories/:id
Get category by ID.

**Access:** Public

**Query Parameters:**
- `includeProducts` (boolean) - Include products in category

**Response (200):**
```json
{
  "success": true,
  "message": "Category retrieved successfully",
  "data": {
    "id": 1,
    "name": "Electronics",
    "slug": "electronics",
    "description": "Electronic devices and gadgets",
    "imageUrl": "http://localhost:3000/uploads/categories/category_123456.jpg",
    "isActive": true,
    "sortOrder": 1,
    "products": [
      {
        "id": 1,
        "title": "Smartphone Android Terbaru",
        "slug": "smartphone-android-terbaru",
        "price": 5999999.00,
        "points": 1500,
        "imageUrl": "http://localhost:3000/uploads/products/product_123456.jpg",
        "isFeatured": true
      }
    ]
  }
}
```

## GET /categories/slug/:slug
Get category by slug.

**Access:** Public

**Query Parameters:**
- `includeProducts` (boolean) - Include products in category

**Response:** Same as GET /categories/:id

## POST /categories
Create new category.

**Access:** Admin

**Headers:**
```
Authorization: Bearer <admin-token>
```

**Request Body:**
```json
{
  "name": "New Category",
  "slug": "new-category",
  "description": "Category description",
  "isActive": true,
  "sortOrder": 1
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Category created successfully",
  "data": {
    "id": 6,
    "name": "New Category",
    "slug": "new-category",
    "description": "Category description",
    "imageUrl": null,
    "isActive": true,
    "sortOrder": 1,
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "code": "RESOURCE_CREATED"
}
```

## PUT /categories/:id
Update category.

**Access:** Admin

**Headers:**
```
Authorization: Bearer <admin-token>
```

**Request Body:**
```json
{
  "name": "Updated Category Name",
  "description": "Updated description",
  "isActive": false
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Category updated successfully",
  "data": {
    "id": 1,
    "name": "Updated Category Name",
    "slug": "electronics",
    "description": "Updated description",
    "isActive": false,
    "updatedAt": "2024-01-01T00:00:00.000Z"
  },
  "code": "RESOURCE_UPDATED"
}
```

## DELETE /categories/:id
Delete category.

**Access:** Admin

**Headers:**
```
Authorization: Bearer <admin-token>
```

**Response (200):**
```json
{
  "success": true,
  "message": "Category deleted successfully",
  "code": "RESOURCE_DELETED"
}
```

## POST /categories/:id/image
Upload category image.

**Access:** Admin

**Headers:**
```
Authorization: Bearer <admin-token>
Content-Type: multipart/form-data
```

**Form Data:**
- `image` (file) - Image file (JPG, PNG, GIF, WebP, max 5MB)

**Response (200):**
```json
{
  "success": true,
  "message": "Category image uploaded successfully",
  "data": {
    "id": 1,
    "name": "Electronics",
    "imageUrl": "http://localhost:3000/uploads/categories/category_1704067200_abc123.jpg"
  },
  "code": "FILE_UPLOADED"
}
```

## PATCH /categories/:id/toggle-status
Toggle category active status.

**Access:** Admin

**Headers:**
```
Authorization: Bearer <admin-token>
```

**Response (200):**
```json
{
  "success": true,
  "message": "Category activated successfully",
  "data": {
    "id": 1,
    "name": "Electronics",
    "isActive": true
  },
  "code": "STATUS_UPDATED"
}
```

---

# Product Endpoints

## GET /products
Get products list. Shows all products for admin, active products for public.

**Access:** Public

**Query Parameters:**
- `page` (integer, default: 1) - Page number
- `limit` (integer, default: 10) - Items per page
- `search` (string) - Search query
- `categoryId` (integer) - Filter by category
- `minPrice` (float) - Minimum price filter
- `maxPrice` (float) - Maximum price filter
- `minPoints` (integer) - Minimum points filter
- `maxPoints` (integer) - Maximum points filter
- `isActive` (boolean) - Filter by active status (admin only)
- `isFeatured` (boolean) - Filter by featured status
- `sortBy` (string, default: 'createdAt') - Sort field
- `sortOrder` (string, default: 'DESC') - Sort direction

**Response (200):**
```json
{
  "success": true,
  "message": "Products retrieved successfully",
  "data": [
    {
      "id": 1,
      "title": "Smartphone Android Terbaru",
      "slug": "smartphone-android-terbaru",
      "description": "Smartphone Android dengan teknologi terdepan...",
      "points": 1500,
      "price": 5999999.00,
      "formattedPrice": "Rp5.999.999,00",
      "url": "https://example.com/products/smartphone-android",
      "imageUrl": "http://localhost:3000/uploads/products/product_123456.jpg",
      "isActive": true,
      "isFeatured": true,
      "stockQuantity": 50,
      "viewCount": 245,
      "category": {
        "id": 1,
        "name": "Electronics",
        "slug": "electronics"
      },
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "meta": {
    "pagination": {
      "currentPage": 1,
      "itemsPerPage": 10,
      "totalItems": 25,
      "totalPages": 3
    }
  }
}
```

## GET /products/featured
Get featured products.

**Access:** Public

**Query Parameters:**
- `limit` (integer, default: 10) - Number of products to return

**Response (200):**
```json
{
  "success": true,
  "message": "Featured products retrieved successfully",
  "data": [
    {
      "id": 1,
      "title": "Smartphone Android Terbaru",
      "slug": "smartphone-android-terbaru",
      "points": 1500,
      "price": 5999999.00,
      "formattedPrice": "Rp5.999.999,00",
      "imageUrl": "http://localhost:3000/uploads/products/product_123456.jpg",
      "isFeatured": true,
      "category": {
        "id": 1,
        "name": "Electronics",
        "slug": "electronics"
      }
    }
  ]
}
```

## GET /products/search
Search products.

**Access:** Public

**Query Parameters:**
- `q` (string, required) - Search query
- `page` (integer, default: 1) - Page number
- `limit` (integer, default: 10) - Items per page
- `categoryId` (integer) - Filter by category
- `minPrice` (float) - Minimum price filter
- `maxPrice` (float) - Maximum price filter
- `sortBy` (string, default: 'viewCount') - Sort field
- `sortOrder` (string, default: 'DESC') - Sort direction

**Request:**
```
GET /products/search?q=smartphone&categoryId=1&minPrice=1000000&maxPrice=10000000
```

**Response (200):**
```json
{
  "success": true,
  "message": "Search results for \"smartphone\"",
  "data": [
    {
      "id": 1,
      "title": "Smartphone Android Terbaru",
      "slug": "smartphone-android-terbaru",
      "points": 1500,
      "price": 5999999.00,
      "imageUrl": "http://localhost:3000/uploads/products/product_123456.jpg",
      "category": {
        "id": 1,
        "name": "Electronics",
        "slug": "electronics"
      }
    }
  ],
  "meta": {
    "pagination": {
      "currentPage": 1,
      "itemsPerPage": 10,
      "totalItems": 3,
      "totalPages": 1
    }
  }
}
```

## GET /products/statistics
Get product statistics.

**Access:** Admin

**Headers:**
```
Authorization: Bearer <admin-token>
```

**Response (200):**
```json
{
  "success": true,
  "message": "Product statistics retrieved successfully",
  "data": {
    "totalProducts": 25,
    "activeProducts": 22,
    "featuredProducts": 8,
    "outOfStockProducts": 3,
    "topViewedProducts": [
      {
        "id": 1,
        "title": "Smartphone Android Terbaru",
        "viewCount": 245,
        "category": {
          "name": "Electronics"
        }
      }
    ],
    "productsByCategory": [
      {
        "id": 1,
        "name": "Electronics",
        "productCount": 15
      }
    ]
  }
}
```

## GET /products/category/:categoryId
Get products by category.

**Access:** Public

**Query Parameters:**
- `page` (integer, default: 1) - Page number
- `limit` (integer, default: 10) - Items per page
- `minPrice` (float) - Minimum price filter
- `maxPrice` (float) - Maximum price filter
- `sortBy` (string, default: 'sortOrder') - Sort field
- `sortOrder` (string, default: 'ASC') - Sort direction

**Response (200):**
Same format as GET /products

## GET /products/:id
Get product by ID.

**Access:** Public

**Query Parameters:**
- `includeImages` (boolean) - Include additional product images

**Response (200):**
```json
{
  "success": true,
  "message": "Product retrieved successfully",
  "data": {
    "id": 1,
    "title": "Smartphone Android Terbaru",
    "slug": "smartphone-android-terbaru",
    "description": "Smartphone Android dengan teknologi terdepan, kamera berkualitas tinggi, dan performa yang luar biasa.",
    "points": 1500,
    "price": 5999999.00,
    "formattedPrice": "Rp5.999.999,00",
    "url": "https://example.com/products/smartphone-android",
    "imageUrl": "http://localhost:3000/uploads/products/product_123456.jpg",
    "isActive": true,
    "isFeatured": true,
    "stockQuantity": 50,
    "viewCount": 245,
    "metaTitle": "Smartphone Android Terbaru - Teknologi Terdepan",
    "metaDescription": "Dapatkan smartphone Android terbaru dengan fitur canggih dan harga terjangkau",
    "category": {
      "id": 1,
      "name": "Electronics",
      "slug": "electronics"
    },
    "images": [
      {
        "id": 1,
        "imagePath": "product_image1.jpg",
        "imageUrl": "http://localhost:3000/uploads/products/product_image1.jpg",
        "altText": "Smartphone Android Terbaru - Image 1",
        "isPrimary": true,
        "sortOrder": 0
      }
    ],
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

## GET /products/slug/:slug
Get product by slug.

**Access:** Public

**Response (200):**
Same format as GET /products/:id

## POST /products
Create new product.

**Access:** Admin

**Headers:**
```
Authorization: Bearer <admin-token>
```

**Request Body:**
```json
{
  "title": "New Product",
  "slug": "new-product",
  "description": "Product description",
  "points": 1000,
  "price": 2999999.00,
  "url": "https://example.com/products/new-product",
  "categoryId": 1,
  "isActive": true,
  "isFeatured": false,
  "stockQuantity": 25,
  "sortOrder": 0,
  "metaTitle": "New Product - Best Quality",
  "metaDescription": "Get the best new product with amazing features"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Product created successfully",
  "data": {
    "id": 26,
    "title": "New Product",
    "slug": "new-product",
    "description": "Product description",
    "points": 1000,
    "price": 2999999.00,
    "formattedPrice": "Rp2.999.999,00",
    "url": "https://example.com/products/new-product",
    "categoryId": 1,
    "isActive": true,
    "isFeatured": false,
    "stockQuantity": 25,
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "code": "RESOURCE_CREATED"
}
```

## PUT /products/:id
Update product.

**Access:** Admin

**Headers:**
```
Authorization: Bearer <admin-token>
```

**Request Body:**
```json
{
  "title": "Updated Product Title",
  "description": "Updated description",
  "price": 3499999.00,
  "points": 1200,
  "isFeatured": true
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Product updated successfully",
  "data": {
    "id": 1,
    "title": "Updated Product Title",
    "description": "Updated description",
    "price": 3499999.00,
    "formattedPrice": "Rp3.499.999,00",
    "points": 1200,
    "isFeatured": true,
    "updatedAt": "2024-01-01T00:00:00.000Z"
  },
  "code": "RESOURCE_UPDATED"
}
```

## DELETE /products/:id
Delete product.

**Access:** Admin

**Headers:**
```
Authorization: Bearer <admin-token>
```

**Response (200):**
```json
{
  "success": true,
  "message": "Product deleted successfully",
  "code": "RESOURCE_DELETED"
}
```

## POST /products/:id/image
Upload product image.

**Access:** Admin

**Headers:**
```
Authorization: Bearer <admin-token>
Content-Type: multipart/form-data
```

**Form Data:**
- `image` (file) - Image file (JPG, PNG, GIF, WebP, max 5MB)

**Response (200):**
```json
{
  "success": true,
  "message": "Product image uploaded successfully",
  "data": {
    "id": 1,
    "title": "Smartphone Android Terbaru",
    "imageUrl": "http://localhost:3000/uploads/products/product_1704067200_xyz789.jpg"
  },
  "code": "FILE_UPLOADED"
}
```

## PATCH /products/:id/toggle-status
Toggle product active status.

**Access:** Admin

**Headers:**
```
Authorization: Bearer <admin-token>
```

**Response (200):**
```json
{
  "success": true,
  "message": "Product activated successfully",
  "data": {
    "id": 1,
    "title": "Smartphone Android Terbaru",
    "isActive": true
  },
  "code": "STATUS_UPDATED"
}
```

## PATCH /products/:id/toggle-featured
Toggle product featured status.

**Access:** Admin

**Headers:**
```
Authorization: Bearer <admin-token>
```

**Response (200):**
```json
{
  "success": true,
  "message": "Product marked as featured successfully",
  "data": {
    "id": 1,
    "title": "Smartphone Android Terbaru",
    "isFeatured": true
  },
  "code": "STATUS_UPDATED"
}
```

## PATCH /products/:id/stock
Update product stock.

**Access:** Admin

**Headers:**
```
Authorization: Bearer <admin-token>
```

**Request Body:**
```json
{
  "quantity": -5
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Product stock updated successfully",
  "data": {
    "id": 1,
    "title": "Smartphone Android Terbaru",
    "stockQuantity": 45
  },
  "code": "RESOURCE_UPDATED"
}
```

---

# Error Responses

## Validation Error (400)
```json
{
  "success": false,
  "message": "Validation failed",
  "data": {
    "errors": [
      {
        "field": "title",
        "message": "Product title is required",
        "value": ""
      }
    ]
  },
  "code": "VALIDATION_ERROR",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Unauthorized (401)
```json
{
  "success": false,
  "message": "Access token required",
  "code": "MISSING_TOKEN",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Forbidden (403)
```json
{
  "success": false,
  "message": "Insufficient permissions",
  "code": "INSUFFICIENT_PERMISSIONS",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Not Found (404)
```json
{
  "success": false,
  "message": "Product not found",
  "code": "RESOURCE_NOT_FOUND",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Conflict (409)
```json
{
  "success": false,
  "message": "Product with this slug already exists",
  "code": "RESOURCE_ALREADY_EXISTS",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Rate Limit (429)
```json
{
  "success": false,
  "message": "Too many requests, please try again later",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 900,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Server Error (500)
```json
{
  "success": false,
  "message": "Internal server error",
  "code": "INTERNAL_ERROR",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

# Usage Examples

## Example: Get Products with Filtering
```bash
curl -X GET "http://localhost:3000/api/v1/products?categoryId=1&minPrice=1000000&maxPrice=10000000&isFeatured=true&page=1&limit=5" \
  -H "Content-Type: application/json"
```

## Example: Create Product as Admin
```bash
curl -X POST "http://localhost:3000/api/v1/products" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "title": "Gaming Laptop Pro",
    "description": "High-performance gaming laptop with RTX graphics",
    "points": 2500,
    "price": 15999999.00,
    "url": "https://example.com/gaming-laptop-pro",
    "categoryId": 1,
    "isFeatured": true,
    "stockQuantity": 10
  }'
```

## Example: Upload Product Image
```bash
curl -X POST "http://localhost:3000/api/v1/products/1/image" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -F "image=@/path/to/your/image.jpg"
```

## Example: Search Products
```bash
curl -X GET "http://localhost:3000/api/v1/products/search?q=laptop&categoryId=1&sortBy=price&sortOrder=ASC" \
  -H "Content-Type: application/json"
```

---

# Role-based Access Control

## Public Access (No Authentication)
- GET /categories (active only)
- GET /categories/active
- GET /categories/:id
- GET /categories/slug/:slug
- GET /products (active only)
- GET /products/featured
- GET /products/search
- GET /products/category/:categoryId
- GET /products/:id
- GET /products/slug/:slug
- All authentication endpoints

## User Access (Authenticated Users)
- All public endpoints
- POST /auth/logout
- GET /auth/profile
- PUT /auth/profile
- POST /auth/change-password

## Admin Access (Admin Role Required)
- All user endpoints
- All category management (POST, PUT, DELETE, image upload)
- All product management (POST, PUT, DELETE, image upload)
- GET /products/statistics
- Status and featured toggles
- Stock management

---

# File Upload Specifications

## Supported Image Formats
- JPEG (.jpg, .jpeg)
- PNG (.png)
- GIF (.gif)
- WebP (.webp)

## File Size Limits
- Maximum file size: 5MB per image
- Maximum files per request: 10 images

## Storage Locations
- Category images: `/uploads/categories/`
- Product images: `/uploads/products/`

## Image URL Format
```
http://localhost:3000/uploads/{type}/{filename}
```

Example:
```
http://localhost:3000/uploads/products/product_1704067200_abc123.jpg
```


📚 API Endpoints yang Ditambahkan
Categories:

GET /api/v1/categories - List categories
GET /api/v1/categories/active - Active categories
GET /api/v1/categories/:id - Get by ID
GET /api/v1/categories/slug/:slug - Get by slug
POST /api/v1/categories - Create (Admin)
PUT /api/v1/categories/:id - Update (Admin)
DELETE /api/v1/categories/:id - Delete (Admin)
POST /api/v1/categories/:id/image - Upload image (Admin)
PATCH /api/v1/categories/:id/toggle-status - Toggle status (Admin)

Products:

GET /api/v1/products - List products
GET /api/v1/products/featured - Featured products
GET /api/v1/products/search - Search products
GET /api/v1/products/statistics - Statistics (Admin)
GET /api/v1/products/category/:categoryId - By category
GET /api/v1/products/:id - Get by ID
GET /api/v1/products/slug/:slug - Get by slug
POST /api/v1/products - Create (Admin)
PUT /api/v1/products/:id - Update (Admin)
DELETE /api/v1/products/:id - Delete (Admin)
POST /api/v1/products/:id/image - Upload image (Admin)
PATCH /api/v1/products/:id/toggle-status - Toggle status (Admin)
PATCH /api/v1/products/:id/toggle-featured - Toggle featured (Admin)
PATCH /api/v1/products/:id/stock - Update stock (Admin)

File Access:

GET /uploads/categories/:filename - Category images
GET /uploads/products/:filename - Product images


📝 Sample Usage Examples:
Create Category (Admin):
bashcurl -X POST http://localhost:3000/api/v1/categories \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "name": "Gadgets",
    "description": "Latest gadgets and accessories",
    "isActive": true,
    "sortOrder": 1
  }'
Upload Category Image:
bashcurl -X POST http://localhost:3000/api/v1/categories/1/image \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -F "image=@category-image.jpg"
Create Product (Admin):
bashcurl -X POST http://localhost:3000/api/v1/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "title": "Gaming Mouse Pro",
    "description": "High-precision gaming mouse with RGB lighting",
    "points": 500,
    "price": 899999.00,
    "url": "https://store.example.com/gaming-mouse-pro",
    "categoryId": 1,
    "isFeatured": true,
    "stockQuantity": 25
  }'
Search Products (Public):
bashcurl -X GET "http://localhost:3000/api/v1/products/search?q=gaming&minPrice=500000&maxPrice=1000000&categoryId=1"
Get Featured Products (Public):
bashcurl -X GET "http://localhost:3000/api/v1/products/featured?limit=5"


📋 Default Admin Credentials:

Username: admin
Email: admin@example.com
Password: admin123!

🔗 Image URLs:
Uploaded images dapat diakses secara public via:

Category images: http://localhost:3000/uploads/categories/filename.jpg
Product images: http://localhost:3000/uploads/products/filename.jpg


# API Documentation - Secure Node.js Backend

## Base URL
```
http://localhost:3000/api/v1
```

## Authentication
Most endpoints require authentication using JWT Bearer token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## Response Format
All API responses follow this standard format:
```json
{
  "success": true|false,
  "message": "Response message",
  "data": {...},
  "code": "SUCCESS_CODE",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "meta": {
    "pagination": {...}
  }
}
```

---

# Authentication Endpoints

## POST /auth/register
Register a new user account.

**Access:** Public

**Request Body:**
```json
{
  "username": "johndoe",
  "email": "john@example.com",
  "phoneNumber": "+6281234567890",
  "password": "SecurePass123!",
  "confirmPassword": "SecurePass123!"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Registration successful. Please check your email to verify your account before logging in.",
  "data": {
    "user": {
      "id": 1,
      "username": "johndoe",
      "email": "john@example.com",
      "phoneNumber": "+6281234567890",
      "role": "user",
      "isVerified": false,
      "isActive": true,
      "createdAt": "2024-01-01T00:00:00.000Z"
    },
    "requiresEmailVerification": true
  },
  "code": "USER_CREATED",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Note:** After registration, users must verify their email before they can log in. A verification email will be sent automatically.

## POST /auth/login
Login with username/email and password.

**Access:** Public

**Request Body:**
```json
{
  "identifier": "johndoe",
  "password": "SecurePass123!"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": 1,
      "username": "johndoe",
      "email": "john@example.com",
      "role": "user",
      "lastLogin": "2024-01-01T00:00:00.000Z"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "code": "LOGIN_SUCCESS"
}
```

**Error Response (401) - Email Not Verified:**
```json
{
  "success": false,
  "message": "Please verify your email address before logging in. Check your inbox for verification instructions.",
  "code": "EMAIL_NOT_VERIFIED"
}
```
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "code": "LOGIN_SUCCESS"
}
```

## GET /auth/google
Initiate Google OAuth login.

**Access:** Public

**Response:** Redirects to Google OAuth consent screen.

## GET /auth/verify-email
Verify user email address using verification token.

**Access:** Public

**Query Parameters:**
- `token` (string, required) - Email verification token
- `email` (string, required) - User email address

**Request:**
```
GET /auth/verify-email?token=abc123xyz789&email=john@example.com
```

**Response (200):**
```json
{
  "success": true,
  "message": "Email verified successfully! You can now log in to your account.",
  "data": {
    "user": {
      "id": 1,
      "username": "johndoe",
      "email": "john@example.com",
      "isVerified": true,
      "emailVerifiedAt": "2024-01-01T00:00:00.000Z"
    },
    "alreadyVerified": false
  },
  "code": "EMAIL_VERIFIED"
}
```

**Error Response (400) - Invalid Token:**
```json
{
  "success": false,
  "message": "Invalid verification token",
  "code": "INVALID_TOKEN"
}
```

**Error Response (400) - Expired Token:**
```json
{
  "success": false,
  "message": "Verification link has expired. Please request a new verification email.",
  "code": "TOKEN_EXPIRED"
}
```

## POST /auth/resend-verification
Resend email verification link.

**Access:** Public

**Request Body:**
```json
{
  "email": "john@example.com"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Verification email has been sent. Please check your inbox and spam folder.",
  "code": "EMAIL_VERIFICATION_SENT"
}
```

## POST /auth/logout
Logout current user.

**Access:** Private (User/Admin)

**Headers:**
```
Authorization: Bearer <access-token>
```

**Response (200):**
```json
{
  "success": true,
  "message": "Logout successful",
  "code": "LOGOUT_SUCCESS"
}
```

---

# Category Endpoints

## GET /categories
Get categories list. Shows all categories for admin, active categories for public.

**Access:** Public

**Query Parameters:**
- `page` (integer, default: 1) - Page number
- `limit` (integer, default: 10) - Items per page
- `search` (string) - Search query
- `isActive` (boolean) - Filter by active status (admin only)
- `sortBy` (string, default: 'sortOrder') - Sort field
- `sortOrder` (string, default: 'ASC') - Sort direction
- `includeProductCount` (boolean) - Include product count

**Response (200):**
```json
{
  "success": true,
  "message": "Categories retrieved successfully",
  "data": [
    {
      "id": 1,
      "name": "Electronics",
      "slug": "electronics",
      "description": "Electronic devices and gadgets",
      "imageUrl": "http://localhost:3000/uploads/categories/category_123456.jpg",
      "isActive": true,
      "sortOrder": 1,
      "productCount": 15,
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "meta": {
    "pagination": {
      "currentPage": 1,
      "itemsPerPage": 10,
      "totalItems": 5,
      "totalPages": 1
    }
  }
}
```

## GET /categories/active
Get only active categories.

**Access:** Public

**Response (200):**
```json
{
  "success": true,
  "message": "Active categories retrieved successfully",
  "data": [
    {
      "id": 1,
      "name": "Electronics",
      "slug": "electronics",
      "description": "Electronic devices and gadgets",
      "imageUrl": "http://localhost:3000/uploads/categories/category_123456.jpg",
      "sortOrder": 1
    }
  ]
}
```

## GET /categories/:id
Get category by ID.

**Access:** Public

**Query Parameters:**
- `includeProducts` (boolean) - Include products in category

**Response (200):**
```json
{
  "success": true,
  "message": "Category retrieved successfully",
  "data": {
    "id": 1,
    "name": "Electronics",
    "slug": "electronics",
    "description": "Electronic devices and gadgets",
    "imageUrl": "http://localhost:3000/uploads/categories/category_123456.jpg",
    "isActive": true,
    "sortOrder": 1,
    "products": [
      {
        "id": 1,
        "title": "Smartphone Android Terbaru",
        "slug": "smartphone-android-terbaru",
        "price": 5999999.00,
        "points": 1500,
        "imageUrl": "http://localhost:3000/uploads/products/product_123456.jpg",
        "isFeatured": true
      }
    ]
  }
}
```

## GET /categories/slug/:slug
Get category by slug.

**Access:** Public

**Query Parameters:**
- `includeProducts` (boolean) - Include products in category

**Response:** Same as GET /categories/:id

## POST /categories
Create new category.

**Access:** Admin

**Headers:**
```
Authorization: Bearer <admin-token>
```

**Request Body:**
```json
{
  "name": "New Category",
  "slug": "new-category",
  "description": "Category description",
  "isActive": true,
  "sortOrder": 1
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Category created successfully",
  "data": {
    "id": 6,
    "name": "New Category",
    "slug": "new-category",
    "description": "Category description",
    "imageUrl": null,
    "isActive": true,
    "sortOrder": 1,
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "code": "RESOURCE_CREATED"
}
```

## PUT /categories/:id
Update category.

**Access:** Admin

**Headers:**
```
Authorization: Bearer <admin-token>
```

**Request Body:**
```json
{
  "name": "Updated Category Name",
  "description": "Updated description",
  "isActive": false
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Category updated successfully",
  "data": {
    "id": 1,
    "name": "Updated Category Name",
    "slug": "electronics",
    "description": "Updated description",
    "isActive": false,
    "updatedAt": "2024-01-01T00:00:00.000Z"
  },
  "code": "RESOURCE_UPDATED"
}
```

## DELETE /categories/:id
Delete category.

**Access:** Admin

**Headers:**
```
Authorization: Bearer <admin-token>
```

**Response (200):**
```json
{
  "success": true,
  "message": "Category deleted successfully",
  "code": "RESOURCE_DELETED"
}
```

## POST /categories/:id/image
Upload category image.

**Access:** Admin

**Headers:**
```
Authorization: Bearer <admin-token>
Content-Type: multipart/form-data
```

**Form Data:**
- `image` (file) - Image file (JPG, PNG, GIF, WebP, max 5MB)

**Response (200):**
```json
{
  "success": true,
  "message": "Category image uploaded successfully",
  "data": {
    "id": 1,
    "name": "Electronics",
    "imageUrl": "http://localhost:3000/uploads/categories/category_1704067200_abc123.jpg"
  },
  "code": "FILE_UPLOADED"
}
```

## PATCH /categories/:id/toggle-status
Toggle category active status.

**Access:** Admin

**Headers:**
```
Authorization: Bearer <admin-token>
```

**Response (200):**
```json
{
  "success": true,
  "message": "Category activated successfully",
  "data": {
    "id": 1,
    "name": "Electronics",
    "isActive": true
  },
  "code": "STATUS_UPDATED"
}
```

---

# Product Endpoints

## GET /products
Get products list. Shows all products for admin, active products for public.

**Access:** Public

**Query Parameters:**
- `page` (integer, default: 1) - Page number
- `limit` (integer, default: 10) - Items per page
- `search` (string) - Search query
- `categoryId` (integer) - Filter by category
- `minPrice` (float) - Minimum price filter
- `maxPrice` (float) - Maximum price filter
- `minPoints` (integer) - Minimum points filter
- `maxPoints` (integer) - Maximum points filter
- `isActive` (boolean) - Filter by active status (admin only)
- `isFeatured` (boolean) - Filter by featured status
- `sortBy` (string, default: 'createdAt') - Sort field
- `sortOrder` (string, default: 'DESC') - Sort direction

**Response (200):**
```json
{
  "success": true,
  "message": "Products retrieved successfully",
  "data": [
    {
      "id": 1,
      "title": "Smartphone Android Terbaru",
      "slug": "smartphone-android-terbaru",
      "description": "Smartphone Android dengan teknologi terdepan...",
      "points": 1500,
      "price": 5999999.00,
      "formattedPrice": "Rp5.999.999,00",
      "url": "https://example.com/products/smartphone-android",
      "imageUrl": "http://localhost:3000/uploads/products/product_123456.jpg",
      "isActive": true,
      "isFeatured": true,
      "stockQuantity": 50,
      "viewCount": 245,
      "category": {
        "id": 1,
        "name": "Electronics",
        "slug": "electronics"
      },
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "meta": {
    "pagination": {
      "currentPage": 1,
      "itemsPerPage": 10,
      "totalItems": 25,
      "totalPages": 3
    }
  }
}
```

## GET /products/featured
Get featured products.

**Access:** Public

**Query Parameters:**
- `limit` (integer, default: 10) - Number of products to return

**Response (200):**
```json
{
  "success": true,
  "message": "Featured products retrieved successfully",
  "data": [
    {
      "id": 1,
      "title": "Smartphone Android Terbaru",
      "slug": "smartphone-android-terbaru",
      "points": 1500,
      "price": 5999999.00,
      "formattedPrice": "Rp5.999.999,00",
      "imageUrl": "http://localhost:3000/uploads/products/product_123456.jpg",
      "isFeatured": true,
      "category": {
        "id": 1,
        "name": "Electronics",
        "slug": "electronics"
      }
    }
  ]
}
```

## GET /products/search
Search products.

**Access:** Public

**Query Parameters:**
- `q` (string, required) - Search query
- `page` (integer, default: 1) - Page number
- `limit` (integer, default: 10) - Items per page
- `categoryId` (integer) - Filter by category
- `minPrice` (float) - Minimum price filter
- `maxPrice` (float) - Maximum price filter
- `sortBy` (string, default: 'viewCount') - Sort field
- `sortOrder` (string, default: 'DESC') - Sort direction

**Request:**
```
GET /products/search?q=smartphone&categoryId=1&minPrice=1000000&maxPrice=10000000
```

**Response (200):**
```json
{
  "success": true,
  "message": "Search results for \"smartphone\"",
  "data": [
    {
      "id": 1,
      "title": "Smartphone Android Terbaru",
      "slug": "smartphone-android-terbaru",
      "points": 1500,
      "price": 5999999.00,
      "imageUrl": "http://localhost:3000/uploads/products/product_123456.jpg",
      "category": {
        "id": 1,
        "name": "Electronics",
        "slug": "electronics"
      }
    }
  ],
  "meta": {
    "pagination": {
      "currentPage": 1,
      "itemsPerPage": 10,
      "totalItems": 3,
      "totalPages": 1
    }
  }
}
```

## GET /products/statistics
Get product statistics.

**Access:** Admin

**Headers:**
```
Authorization: Bearer <admin-token>
```

**Response (200):**
```json
{
  "success": true,
  "message": "Product statistics retrieved successfully",
  "data": {
    "totalProducts": 25,
    "activeProducts": 22,
    "featuredProducts": 8,
    "outOfStockProducts": 3,
    "topViewedProducts": [
      {
        "id": 1,
        "title": "Smartphone Android Terbaru",
        "viewCount": 245,
        "category": {
          "name": "Electronics"
        }
      }
    ],
    "productsByCategory": [
      {
        "id": 1,
        "name": "Electronics",
        "productCount": 15
      }
    ]
  }
}
```

## GET /products/category/:categoryId
Get products by category.

**Access:** Public

**Query Parameters:**
- `page` (integer, default: 1) - Page number
- `limit` (integer, default: 10) - Items per page
- `minPrice` (float) - Minimum price filter
- `maxPrice` (float) - Maximum price filter
- `sortBy` (string, default: 'sortOrder') - Sort field
- `sortOrder` (string, default: 'ASC') - Sort direction

**Response (200):**
Same format as GET /products

## GET /products/:id
Get product by ID.

**Access:** Public

**Query Parameters:**
- `includeImages` (boolean) - Include additional product images

**Response (200):**
```json
{
  "success": true,
  "message": "Product retrieved successfully",
  "data": {
    "id": 1,
    "title": "Smartphone Android Terbaru",
    "slug": "smartphone-android-terbaru",
    "description": "Smartphone Android dengan teknologi terdepan, kamera berkualitas tinggi, dan performa yang luar biasa.",
    "points": 1500,
    "price": 5999999.00,
    "formattedPrice": "Rp5.999.999,00",
    "url": "https://example.com/products/smartphone-android",
    "imageUrl": "http://localhost:3000/uploads/products/product_123456.jpg",
    "isActive": true,
    "isFeatured": true,
    "stockQuantity": 50,
    "viewCount": 245,
    "metaTitle": "Smartphone Android Terbaru - Teknologi Terdepan",
    "metaDescription": "Dapatkan smartphone Android terbaru dengan fitur canggih dan harga terjangkau",
    "category": {
      "id": 1,
      "name": "Electronics",
      "slug": "electronics"
    },
    "images": [
      {
        "id": 1,
        "imagePath": "product_image1.jpg",
        "imageUrl": "http://localhost:3000/uploads/products/product_image1.jpg",
        "altText": "Smartphone Android Terbaru - Image 1",
        "isPrimary": true,
        "sortOrder": 0
      }
    ],
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

## GET /products/slug/:slug
Get product by slug.

**Access:** Public

**Response (200):**
Same format as GET /products/:id

## POST /products
Create new product.

**Access:** Admin

**Headers:**
```
Authorization: Bearer <admin-token>
```

**Request Body:**
```json
{
  "title": "New Product",
  "slug": "new-product",
  "description": "Product description",
  "points": 1000,
  "price": 2999999.00,
  "url": "https://example.com/products/new-product",
  "categoryId": 1,
  "isActive": true,
  "isFeatured": false,
  "stockQuantity": 25,
  "sortOrder": 0,
  "metaTitle": "New Product - Best Quality",
  "metaDescription": "Get the best new product with amazing features"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Product created successfully",
  "data": {
    "id": 26,
    "title": "New Product",
    "slug": "new-product",
    "description": "Product description",
    "points": 1000,
    "price": 2999999.00,
    "formattedPrice": "Rp2.999.999,00",
    "url": "https://example.com/products/new-product",
    "categoryId": 1,
    "isActive": true,
    "isFeatured": false,
    "stockQuantity": 25,
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "code": "RESOURCE_CREATED"
}
```

## PUT /products/:id
Update product.

**Access:** Admin

**Headers:**
```
Authorization: Bearer <admin-token>
```

**Request Body:**
```json
{
  "title": "Updated Product Title",
  "description": "Updated description",
  "price": 3499999.00,
  "points": 1200,
  "isFeatured": true
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Product updated successfully",
  "data": {
    "id": 1,
    "title": "Updated Product Title",
    "description": "Updated description",
    "price": 3499999.00,
    "formattedPrice": "Rp3.499.999,00",
    "points": 1200,
    "isFeatured": true,
    "updatedAt": "2024-01-01T00:00:00.000Z"
  },
  "code": "RESOURCE_UPDATED"
}
```

## DELETE /products/:id
Delete product.

**Access:** Admin

**Headers:**
```
Authorization: Bearer <admin-token>
```

**Response (200):**
```json
{
  "success": true,
  "message": "Product deleted successfully",
  "code": "RESOURCE_DELETED"
}
```

## POST /products/:id/image
Upload product image.

**Access:** Admin

**Headers:**
```
Authorization: Bearer <admin-token>
Content-Type: multipart/form-data
```

**Form Data:**
- `image` (file) - Image file (JPG, PNG, GIF, WebP, max 5MB)

**Response (200):**
```json
{
  "success": true,
  "message": "Product image uploaded successfully",
  "data": {
    "id": 1,
    "title": "Smartphone Android Terbaru",
    "imageUrl": "http://localhost:3000/uploads/products/product_1704067200_xyz789.jpg"
  },
  "code": "FILE_UPLOADED"
}
```

## PATCH /products/:id/toggle-status
Toggle product active status.

**Access:** Admin

**Headers:**
```
Authorization: Bearer <admin-token>
```

**Response (200):**
```json
{
  "success": true,
  "message": "Product activated successfully",
  "data": {
    "id": 1,
    "title": "Smartphone Android Terbaru",
    "isActive": true
  },
  "code": "STATUS_UPDATED"
}
```

## PATCH /products/:id/toggle-featured
Toggle product featured status.

**Access:** Admin

**Headers:**
```
Authorization: Bearer <admin-token>
```

**Response (200):**
```json
{
  "success": true,
  "message": "Product marked as featured successfully",
  "data": {
    "id": 1,
    "title": "Smartphone Android Terbaru",
    "isFeatured": true
  },
  "code": "STATUS_UPDATED"
}
```

## PATCH /products/:id/stock
Update product stock.

**Access:** Admin

**Headers:**
```
Authorization: Bearer <admin-token>
```

**Request Body:**
```json
{
  "quantity": -5
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Product stock updated successfully",
  "data": {
    "id": 1,
    "title": "Smartphone Android Terbaru",
    "stockQuantity": 45
  },
  "code": "RESOURCE_UPDATED"
}
```

---

# Error Responses

## Validation Error (400)
```json
{
  "success": false,
  "message": "Validation failed",
  "data": {
    "errors": [
      {
        "field": "title",
        "message": "Product title is required",
        "value": ""
      }
    ]
  },
  "code": "VALIDATION_ERROR",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Unauthorized (401)
```json
{
  "success": false,
  "message": "Access token required",
  "code": "MISSING_TOKEN",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Forbidden (403)
```json
{
  "success": false,
  "message": "Insufficient permissions",
  "code": "INSUFFICIENT_PERMISSIONS",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Not Found (404)
```json
{
  "success": false,
  "message": "Product not found",
  "code": "RESOURCE_NOT_FOUND",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Conflict (409)
```json
{
  "success": false,
  "message": "Product with this slug already exists",
  "code": "RESOURCE_ALREADY_EXISTS",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Rate Limit (429)
```json
{
  "success": false,
  "message": "Too many requests, please try again later",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 900,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Server Error (500)
```json
{
  "success": false,
  "message": "Internal server error",
  "code": "INTERNAL_ERROR",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

# Usage Examples

## Example: Register and Verify Email Flow
```bash
# 1. Register new user
curl -X POST "http://localhost:3000/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "johndoe",
    "email": "john@example.com",
    "phoneNumber": "+6281234567890",
    "password": "SecurePass123!",
    "confirmPassword": "SecurePass123!"
  }'

# 2. User receives email with verification link like:
# http://localhost:3000/api/v1/auth/verify-email?token=abc123xyz789&email=john@example.com

# 3. Verify email by visiting the link or calling API
curl -X GET "http://localhost:3000/api/v1/auth/verify-email?token=abc123xyz789&email=john@example.com"

# 4. Now user can login
curl -X POST "http://localhost:3000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "johndoe",
    "password": "SecurePass123!"
  }'
```

## Example: Resend Verification Email
```bash
curl -X POST "http://localhost:3000/api/v1/auth/resend-verification" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com"
  }'
```

## Example: Create Product as Admin
```bash
curl -X POST "http://localhost:3000/api/v1/products" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "title": "Gaming Laptop Pro",
    "description": "High-performance gaming laptop with RTX graphics",
    "points": 2500,
    "price": 15999999.00,
    "url": "https://example.com/gaming-laptop-pro",
    "categoryId": 1,
    "isFeatured": true,
    "stockQuantity": 10
  }'
```

## Example: Upload Product Image
```bash
curl -X POST "http://localhost:3000/api/v1/products/1/image" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -F "image=@/path/to/your/image.jpg"
```

## Example: Search Products
```bash
curl -X GET "http://localhost:3000/api/v1/products/search?q=laptop&categoryId=1&sortBy=price&sortOrder=ASC" \
  -H "Content-Type: application/json"
```

---

# Role-based Access Control

## Public Access (No Authentication)
- GET /categories (active only)
- GET /categories/active
- GET /categories/:id
- GET /categories/slug/:slug
- GET /products (active only)
- GET /products/featured
- GET /products/search
- GET /products/category/:categoryId
- GET /products/:id
- GET /products/slug/:slug
- All authentication endpoints

## User Access (Authenticated Users)
- All public endpoints
- POST /auth/logout
- GET /auth/profile
- PUT /auth/profile
- POST /auth/change-password

## Admin Access (Admin Role Required)
- All user endpoints
- All category management (POST, PUT, DELETE, image upload)
- All product management (POST, PUT, DELETE, image upload)
- GET /products/statistics
- Status and featured toggles
- Stock management

---

# File Upload Specifications

## Supported Image Formats
- JPEG (.jpg, .jpeg)
- PNG (.png)
- GIF (.gif)
- WebP (.webp)

## File Size Limits
- Maximum file size: 5MB per image
- Maximum files per request: 10 images

## Storage Locations
- Category images: `/uploads/categories/`
- Product images: `/uploads/products/`

## Image URL Format
```
http://localhost:3000/uploads/{type}/{filename}
```

Example:
```
http://localhost:3000/uploads/products/product_1704067200_abc123.jpg
```