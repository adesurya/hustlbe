## 📊 Database Schema

### Users Table
```sql
- id (INT, PRIMARY KEY, AUTO_INCREMENT)
- username (VARCHAR(50), UNIQUE, NOT NULL)
- email (VARCHAR(100), UNIQUE, NOT NULL)
- phone_number (VARCHAR(20))
- password_hash (VARCHAR(255))
- role (ENUM: 'admin', 'user')
- google_id (VARCHAR(255), UNIQUE)
- profile_picture (VARCHAR(500))
- is_verified (BOOLEAN, DEFAULT FALSE)
- is_active (BOOLEAN, DEFAULT TRUE)
- login_attempts (INT, DEFAULT 0)
- locked_until (DATETIME)
- last_login (DATETIME)
- email_verification_token (VARCHAR(255))
- email_verification_expires (DATETIME)
- email_verification_sent_at (DATETIME)
- email_verified_at (DATETIME)
- current_points (INT, DEFAULT 0)
- created_at (DATETIME)
- updated_at (DATETIME)
```

### Point Transactions Table
```sql
- id (INT, PRIMARY KEY, AUTO_INCREMENT)
- user_id (INT, FOREIGN KEY)
- transaction_type (ENUM: 'credit', 'debit')
- amount (INT, NOT NULL)
- balance_before (INT, NOT NULL)
- balance_after (INT, NOT NULL)
- activity_type (VARCHAR(50))
- activity_description (TEXT)
- reference_id (VARCHAR(100))
- reference_type (VARCHAR(50))
- status (ENUM: 'pending', 'completed', 'failed', 'cancelled')
- processed_by (INT, FOREIGN KEY)
- metadata (JSON)
- expires_at (DATETIME)
- created_at (DATETIME)
- updated_at (DATETIME)
```

### Point Activities Table
```sql
- id (INT, PRIMARY KEY, AUTO_INCREMENT)
- activity_code (VARCHAR(50), UNIQUE)
- activity_name (VARCHAR(100))
- description (TEXT)
- points_reward (INT)
- daily_limit (INT)
- total_limit (INT)
- is_active (BOOLEAN)
- valid_from (DATETIME)
- valid_until (DATETIME)
- created_by (INT, FOREIGN KEY)
- created_at (DATETIME)
- updated_at (DATETIME)
```

### Point Redemptions Table
```sql
- id (INT, PRIMARY KEY, AUTO_INCREMENT)
- user_id (INT, FOREIGN KEY)
- points_redeemed (INT)
- redemption_type (VARCHAR(50))
- redemption_value (DECIMAL(12,2))
- redemption_details (JSON)
- status (ENUM)
- requested_at (DATETIME)
- processed_at (DATETIME)
- processed_by (INT, FOREIGN KEY)
- admin_notes (TEXT)
- transaction_id (INT, FOREIGN KEY)
- created_at (DATETIME)
- updated_at (DATETIME)
```

### Categories Table
```sql
- id (INT, PRIMARY KEY, AUTO_INCREMENT)
- name (VARCHAR(100), UNIQUE, NOT NULL)
- slug (VARCHAR(120), UNIQUE, NOT NULL)
- description (TEXT)
- image (VARCHAR(500))
- is_active (BOOLEAN, DEFAULT TRUE)
- sort_order (INT, DEFAULT 0)
- created_by (INT, FOREIGN KEY)
- updated_by (INT, FOREIGN KEY)
- created_at (DATETIME)
- updated_at (DATETIME)
```

### Products Table
```sql
- id (INT, PRIMARY KEY, AUTO_INCREMENT)
- title (VARCHAR(200), NOT NULL)
- slug (VARCHAR(220), UNIQUE, NOT NULL)
- description (TEXT)
- points (INT, NOT NULL, DEFAULT 0)
- price (DECIMAL(12,2), NOT NULL, DEFAULT 0.00)
- url (VARCHAR(500))
- image (VARCHAR(500))
- category_id (INT, FOREIGN KEY, NOT NULL)
- is_active (BOOLEAN, DEFAULT TRUE)
- is_featured (BOOLEAN, DEFAULT FALSE)
- stock_quantity (INT, DEFAULT 0)
- view_count (INT, DEFAULT 0)
- sort_order (INT, DEFAULT 0)
- meta_title (VARCHAR(200))
- meta_description (TEXT)
- created_by (INT, FOREIGN KEY)
- updated_by (INT, FOREIGN KEY)
- created_at (DATETIME)
- updated_at (DATETIME)
```

### Product Images Table
```sql
- id (INT, PRIMARY KEY, AUTO_INCREMENT)
- product_id (INT, FOREIGN KEY, NOT NULL)
- image_path (VARCHAR(500), NOT NULL)
- alt_text (VARCHAR(200))
- is_primary (BOOLEAN, DEFAULT FALSE)
- sort_order (INT, DEFAULT 0)
- created_at (DATETIME)
```# Secure Node.js Backend API

Aplikasi backend Node.js yang aman dengan arsitektur MVC, mengimplementasikan best practices keamanan berdasarkan OWASP Top 10 2025.

## 🚀 Fitur Utama

- **Authentication & Authorization**
  - Registrasi dan login dengan username/email
  - **Email verification** wajib setelah registrasi
  - Google Single Sign-On (OAuth 2.0)
  - JWT token dengan refresh token
  - Role-based access control (Admin/User/Guest)
  - Account lockout protection
  - **Email verification system** dengan token expiry

- **Category Management**
  - CRUD operations untuk categories (Admin only)
  - Image upload untuk categories
  - Slug-based URL untuk SEO
  - Active/inactive status management
  - Sort order management

- **Product Management**
  - CRUD operations untuk products (Admin only)
  - Image upload untuk products
  - Multiple product images support
  - Category relationship
  - Points and price system
  - Featured products
  - Stock management
  - View counter
  - SEO-friendly URLs dengan slug
  - Advanced filtering dan search

- **Public Access**
  - View active categories dan products
  - Product search dan filtering
  - Category-based product browsing
  - Featured products display

- **File Management**
  - Secure image upload dengan validation
  - Multiple format support (JPG, PNG, GIF, WebP)
  - File size limiting (5MB)
  - Public access untuk uploaded images

- **Keamanan (OWASP Top 10 2025)**
  - Password hashing dengan bcrypt
  - Rate limiting dan slowdown protection
  - Input validation dan sanitization
  - SQL injection prevention dengan Sequelize ORM
  - XSS protection
  - CORS configuration
  - Security headers dengan Helmet.js
  - Session management
  - Comprehensive logging
  - File upload security

- **Database**
  - MySQL dengan Sequelize ORM
  - Connection pooling
  - Migration system
  - Audit logging
  - Relational data integrity

## 🛠️ Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: MySQL
- **ORM**: Sequelize
- **Authentication**: JWT, Passport.js
- **Email**: Nodemailer
- **File Upload**: Multer
- **Security**: Helmet, bcrypt, rate-limit
- **Logging**: Winston
- **Validation**: express-validator, Joi

## 📋 Prerequisites

- Node.js >= 18.0.0
- MySQL >= 8.0
- npm atau yarn

## 🔧 Installation

1. **Clone repository**
   ```bash
   git clone <repository-url>
   cd secure-nodejs-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Setup environment variables**
   ```bash
   cp .env.example .env
   ```
   Edit file `.env` dengan konfigurasi yang sesuai, terutama:
   - Database credentials
   - JWT secrets
   - **Email SMTP configuration** (Gmail/lainnya)
   - Base URL untuk verification links

4. **Setup database**
   ```bash
   # Create database
   mysql -u root -p
   CREATE DATABASE secure_app_db;
   
   # Run migrations
   npm run migrate
   ```

5. **Create upload directories**
   ```bash
   mkdir -p uploads/categories uploads/products
   ```

6. **Start development server**
   ```bash
   npm run dev
   ```

## 🌐 API Endpoints

### Authentication

| Method | Endpoint | Description | Access |
|--------|----------|-------------|---------|
| POST | `/api/v1/auth/register` | User registration | Public |
| POST | `/api/v1/auth/login` | User login | Private (Email Verified) |
| GET | `/api/v1/auth/verify-email` | Verify email address | Public |
| POST | `/api/v1/auth/resend-verification` | Resend verification email | Public |
| POST | `/api/v1/auth/logout` | User logout | Private |
| POST | `/api/v1/auth/refresh-token` | Refresh access token | Public |
| POST | `/api/v1/auth/change-password` | Change password | Private |
| GET | `/api/v1/auth/profile` | Get user profile | Private |
| PUT | `/api/v1/auth/profile` | Update user profile | Private |
| GET | `/api/v1/auth/google` | Google OAuth login | Public |
| GET | `/api/v1/auth/google/callback` | Google OAuth callback | Public |

### Categories

| Method | Endpoint | Description | Access |
|--------|----------|-------------|---------|
| GET | `/api/v1/categories` | Get categories | Public |
| GET | `/api/v1/categories/active` | Get active categories | Public |
| GET | `/api/v1/categories/:id` | Get category by ID | Public |
| GET | `/api/v1/categories/slug/:slug` | Get category by slug | Public |
| POST | `/api/v1/categories` | Create category | Admin |
| PUT | `/api/v1/categories/:id` | Update category | Admin |
| DELETE | `/api/v1/categories/:id` | Delete category | Admin |
| POST | `/api/v1/categories/:id/image` | Upload category image | Admin |
| PATCH | `/api/v1/categories/:id/toggle-status` | Toggle category status | Admin |

### Products

| Method | Endpoint | Description | Access |
|--------|----------|-------------|---------|
| GET | `/api/v1/products` | Get products | Public |
| GET | `/api/v1/products/featured` | Get featured products | Public |
| GET | `/api/v1/products/search` | Search products | Public |
| GET | `/api/v1/products/statistics` | Get product statistics | Admin |
| GET | `/api/v1/products/category/:categoryId` | Get products by category | Public |
| GET | `/api/v1/products/:id` | Get product by ID | Public |
| GET | `/api/v1/products/slug/:slug` | Get product by slug | Public |
| POST | `/api/v1/products` | Create product | Admin |
| PUT | `/api/v1/products/:id` | Update product | Admin |
| DELETE | `/api/v1/products/:id` | Delete product | Admin |
| POST | `/api/v1/products/:id/image` | Upload product image | Admin |
| PATCH | `/api/v1/products/:id/toggle-status` | Toggle product status | Admin |
| PATCH | `/api/v1/products/:id/toggle-featured` | Toggle featured status | Admin |
| PATCH | `/api/v1/products/:id/stock` | Update product stock | Admin |

### Points Management

| Method | Endpoint | Description | Access |
|--------|----------|-------------|---------|
| GET | `/api/v1/points/my-points` | Get user's points balance | Private |
| GET | `/api/v1/points/my-transactions` | Get user's transaction history | Private |
| POST | `/api/v1/points/redeem` | Request point redemption | Private |
| GET | `/api/v1/points/my-redemptions` | Get user's redemption history | Private |
| GET | `/api/v1/points/activities` | Get available point activities | Private |
| GET | `/api/v1/points/admin/transactions` | Get all transactions | Admin |
| GET | `/api/v1/points/admin/redemptions` | Get all redemption requests | Admin |
| PUT | `/api/v1/points/admin/redemptions/:id/process` | Process redemption | Admin |
| GET | `/api/v1/points/admin/statistics` | Get system statistics | Admin |
### Health Check

| Method | Endpoint | Description | Access |
|--------|----------|-------------|---------|
| GET | `/health` | Server health check | Public |

### File Access

| Method | Endpoint | Description | Access |
|--------|----------|-------------|---------|
| GET | `/uploads/categories/:filename` | Access category images | Public |
| GET | `/uploads/products/:filename` | Access product images | Public |

## 📝 API Usage Examples

### User Registration with Email Verification
```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "johndoe",
    "email": "john@example.com",
    "phoneNumber": "+6281234567890",
    "password": "SecurePass123!",
    "confirmPassword": "SecurePass123!"
### Get Categories (Public)
```bash
curl -X GET http://localhost:3000/api/v1/categories/active
```

### Verify Email (user clicks link from email)
```bash
curl -X GET "http://localhost:3000/api/v1/auth/verify-email?token=abc123xyz789&email=john@example.com"
```

### Resend Verification Email
```bash
curl -X POST http://localhost:3000/api/v1/auth/resend-verification \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com"
  }'
```

### User Login
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "johndoe",
    "password": "SecurePass123!"
  }'
```

### Create Product (Admin)
```bash
curl -X POST http://localhost:3000/api/v1/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-admin-jwt-token>" \
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

### Upload Product Image (Admin)
```bash
curl -X POST http://localhost:3000/api/v1/products/1/image \
  -H "Authorization: Bearer <your-admin-jwt-token>" \
  -F "image=@/path/to/your/image.jpg"
```

### Get Products with Filtering (Public)
```bash
curl -X GET "http://localhost:3000/api/v1/products?categoryId=1&minPrice=1000000&maxPrice=10000000&isFeatured=true&page=1&limit=5"
```

### Search Products (Public)
```bash
curl -X GET "http://localhost:3000/api/v1/products/search?q=laptop&categoryId=1&sortBy=price&sortOrder=ASC"
```

### Get User Points Balance
```bash
curl -X GET http://localhost:3000/api/v1/points/my-points \
  -H "Authorization: Bearer <your-jwt-token>"
```

### Request Point Redemption
```bash
curl -X POST http://localhost:3000/api/v1/points/redeem \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-jwt-token>" \
  -d '{
    "pointsToRedeem": 100,
    "redemptionType": "cash",
    "redemptionValue": 10000.00,
    "redemptionDetails": {
      "bankAccount": "1234567890",
      "bankName": "Bank ABC",
      "accountName": "John Doe"
    }
  }'
```

### Admin - Process Redemption
```bash
curl -X PUT http://localhost:3000/api/v1/points/admin/redemptions/1/process \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin-token>" \
  -d '{
    "action": "approve",
    "notes": "Approved and will be processed"
  }'
```

## 🔒 Security Features

### Password Policy
- Minimum 8 characters
- Maximum 128 characters
- Must contain uppercase, lowercase, numbers, and special characters
- Blacklisted common passwords

### Rate Limiting
- General API: 100 requests per 15 minutes
- Auth endpoints: 10 requests per 15 minutes
- Login endpoint: 5 requests per 15 minutes

### Account Security
- Account lockout after 5 failed login attempts
- Lockout duration: 30 minutes
- **Email verification required** before login
- **Email verification token** expires in 24 hours
- **Rate limiting** for verification email resends (5 minutes cooldown)
- JWT token expiration: 24 hours
- Refresh token expiration: 7 days

## 📊 Database Schema

### Users Table
```sql
- id (INT, PRIMARY KEY, AUTO_INCREMENT)
- username (VARCHAR(50), UNIQUE, NOT NULL)
- email (VARCHAR(100), UNIQUE, NOT NULL)
- phone_number (VARCHAR(20))
- password_hash (VARCHAR(255))
- role (ENUM: 'admin', 'user')
- google_id (VARCHAR(255), UNIQUE)
- profile_picture (VARCHAR(500))
- is_verified (BOOLEAN, DEFAULT FALSE)
- is_active (BOOLEAN, DEFAULT TRUE)
- login_attempts (INT, DEFAULT 0)
- locked_until (DATETIME)
- last_login (DATETIME)
- created_at (DATETIME)
- updated_at (DATETIME)
```

## 📧 Email Configuration

Aplikasi menggunakan Nodemailer untuk pengiriman email. Konfigurasi di `.env`:

```bash
# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
BASE_URL=http://localhost:3000
APP_NAME=Your App Name
```

### Untuk Gmail:
1. Enable 2-Factor Authentication
2. Generate App Password
3. Gunakan App Password sebagai `SMTP_PASS`

### Email Templates:
- **Verification Email**: Berisi link verifikasi dengan token
- **Welcome Email**: Dikirim setelah email terverifikasi
- **Responsive HTML Design** dengan fallback text

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## 📝 Logging

Aplikasi menggunakan Winston untuk logging dengan beberapa level:

- **Error logs**: `logs/error.log`
- **Combined logs**: `logs/combined.log`
- **Security logs**: `logs/security.log`
- **Exception logs**: `logs/exceptions.log`

## 🚀 Deployment

### Production Environment

1. **Set environment variables**
   ```bash
   NODE_ENV=production
   JWT_SECRET=your-super-secret-production-key
   DB_HOST=your-production-db-host
   # ... other production configs
   ```

2. **Build and start**
   ```bash
   npm start
   ```

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

## 🤝 Contributing

1. Fork the project
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

Jika Anda mengalami masalah atau memiliki pertanyaan:

1. Check existing [Issues](https://github.com/your-repo/issues)
2. Create new issue dengan template yang sesuai
3. Contact: your-email@example.com

## 🔄 Changelog

### v1.0.0 (Current)
- Initial release
- Basic authentication system
- **Email verification system** with secure token handling
- Google OAuth integration
- OWASP security implementations
- Comprehensive logging
- Rate limiting
- Input validation
- **Category Management System**
  - CRUD operations for categories
  - Image upload support
  - Slug-based URLs
  - Active/inactive status management
- **Product Management System**
  - CRUD operations for products
  - Multiple image support
  - Points and pricing system
  - Featured products
  - Stock management
  - Advanced search and filtering
  - Category relationships
  - SEO optimization
- **File Upload System**
  - Secure image upload
  - Multiple format support
  - File size validation
  - Public access to uploaded files
- **Role-based Access Control**
  - Guest access (view only)
  - User access (authenticated + email verified)
  - Admin access (full management)
- **Email System**
  - Email verification for new users
  - HTML email templates
  - Resend verification functionality
  - Welcome emails
  - Rate limiting for email sends

---

**Note**: Pastikan untuk mengubah semua konfigurasi default (secrets, passwords, etc.) sebelum deployment ke production!