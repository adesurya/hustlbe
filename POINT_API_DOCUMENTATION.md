# Point Management API Documentation

## Overview

Point Management System berfungsi seperti e-wallet yang melacak setiap transaksi points pengguna. Sistem ini mendukung:
- Credit points (mendapat poin dari aktivitas)
- Debit points (penukaran/redemption poin)
- Transaction history lengkap
- Redemption management untuk admin

## Base URL
```
http://localhost:3000/api/v1/points
```

## Authentication
Semua endpoint memerlukan authentication menggunakan JWT Bearer token:
```
Authorization: Bearer <your-jwt-token>
```

---

# User Endpoints

## GET /my-points
Mendapatkan ringkasan poin pengguna saat ini.

**Access:** Private (User/Admin)

**Response (200):**
```json
{
  "success": true,
  "message": "Points summary retrieved successfully",
  "data": {
    "user": {
      "id": 1,
      "username": "johndoe",
      "email": "john@example.com",
      "currentPoints": 150
    },
    "currentBalance": 150,
    "summary": {
      "totalEarned": 200,
      "totalSpent": 50,
      "currentBalance": 150,
      "netPoints": 150
    },
    "recentTransactions": [
      {
        "id": 5,
        "transactionType": "credit",
        "amount": 10,
        "formattedAmount": "+10",
        "balanceBefore": 140,
        "balanceAfter": 150,
        "activityType": "PRODUCT_SHARE",
        "activityDescription": "Points earned for Share Product",
        "status": "completed",
        "createdAt": "2024-01-01T10:00:00.000Z"
      }
    ]
  }
}
```

## GET /my-transactions
Mendapatkan history transaksi poin pengguna.

**Access:** Private (User/Admin)

**Query Parameters:**
- `page` (integer, default: 1) - Page number
- `limit` (integer, default: 20) - Items per page
- `activityType` (string) - Filter by activity type
- `transactionType` (string) - Filter by transaction type (credit/debit)
- `startDate` (ISO 8601) - Start date filter
- `endDate` (ISO 8601) - End date filter

**Request:**
```
GET /my-transactions?page=1&limit=10&transactionType=credit&activityType=PRODUCT_SHARE
```

**Response (200):**
```json
{
  "success": true,
  "message": "Transaction history retrieved successfully",
  "data": [
    {
      "id": 1,
      "userId": 1,
      "transactionType": "credit",
      "amount": 10,
      "formattedAmount": "+10",
      "balanceBefore": 0,
      "balanceAfter": 10,
      "activityType": "PRODUCT_SHARE",
      "activityDescription": "Points earned for Share Product",
      "referenceId": "product_123",
      "referenceType": "product",
      "status": "completed",
      "metadata": {
        "productId": 123,
        "shareUrl": "https://example.com/products/123"
      },
      "createdAt": "2024-01-01T09:00:00.000Z"
    },
    {
      "id": 2,
      "userId": 1,
      "transactionType": "debit",
      "amount": 50,
      "formattedAmount": "-50",
      "balanceBefore": 100,
      "balanceAfter": 50,
      "activityType": "REDEMPTION",
      "activityDescription": "Points redeemed for cash",
      "referenceId": "redemption_456",
      "referenceType": "redemption",
      "status": "completed",
      "createdAt": "2024-01-01T08:00:00.000Z"
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

## POST /redeem
Request penukaran poin.

**Access:** Private (User/Admin)

**Request Body:**
```json
{
  "pointsToRedeem": 100,
  "redemptionType": "cash",
  "redemptionValue": 10000.00,
  "redemptionDetails": {
    "bankAccount": "1234567890",
    "bankName": "Bank ABC",
    "accountName": "John Doe"
  }
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Redemption request submitted successfully",
  "data": {
    "id": 1,
    "userId": 1,
    "pointsRedeemed": 100,
    "redemptionType": "cash",
    "redemptionValue": 10000.00,
    "redemptionDetails": {
      "bankAccount": "1234567890",
      "bankName": "Bank ABC",
      "accountName": "John Doe"
    },
    "status": "pending",
    "requestedAt": "2024-01-01T10:00:00.000Z"
  },
  "code": "RESOURCE_CREATED"
}
```

**Error Response (400) - Insufficient Balance:**
```json
{
  "success": false,
  "message": "Insufficient points for redemption",
  "code": "INSUFFICIENT_BALANCE"
}
```

## GET /my-redemptions
Mendapatkan history penukaran poin pengguna.

**Access:** Private (User/Admin)

**Query Parameters:**
- `page` (integer, default: 1) - Page number
- `limit` (integer, default: 20) - Items per page
- `status` (string) - Filter by status (pending/approved/rejected/completed/cancelled)
- `redemptionType` (string) - Filter by redemption type

**Response (200):**
```json
{
  "success": true,
  "message": "Redemption history retrieved successfully",
  "data": [
    {
      "id": 1,
      "userId": 1,
      "pointsRedeemed": 100,
      "redemptionType": "cash",
      "redemptionValue": 10000.00,
      "redemptionDetails": {
        "bankAccount": "1234567890",
        "bankName": "Bank ABC",
        "accountName": "John Doe"
      },
      "status": "approved",
      "requestedAt": "2024-01-01T09:00:00.000Z",
      "processedAt": "2024-01-01T10:00:00.000Z",
      "adminNotes": "Approved and processed"
    }
  ],
  "meta": {
    "pagination": {
      "currentPage": 1,
      "itemsPerPage": 20,
      "totalItems": 5,
      "totalPages": 1
    }
  }
}
```

## GET /activities
Mendapatkan daftar aktivitas yang bisa menghasilkan poin.

**Access:** Private (User/Admin)

**Response (200):**
```json
{
  "success": true,
  "message": "Available activities retrieved successfully",
  "data": [
    {
      "id": 1,
      "code": "PRODUCT_SHARE",
      "name": "Share Product",
      "description": "Points earned for sharing product links",
      "pointsReward": 10,
      "dailyLimit": 10,
      "totalLimit": null,
      "isActive": true
    },
    {
      "id": 2,
      "code": "CAMPAIGN_SHARE",
      "name": "Share Campaign",
      "description": "Points earned for sharing campaign links",
      "pointsReward": 15,
      "dailyLimit": 5,
      "totalLimit": null,
      "isActive": true
    },
    {
      "id": 3,
      "code": "EMAIL_VERIFY",
      "name": "Email Verification",
      "description": "One-time points for email verification",
      "pointsReward": 25,
      "dailyLimit": null,
      "totalLimit": 1,
      "isActive": true
    }
  ]
}
```

---

# Admin Endpoints

## GET /admin/transactions
Mendapatkan semua transaksi poin dari semua pengguna.

**Access:** Admin

**Query Parameters:**
- `page` (integer, default: 1) - Page number
- `limit` (integer, default: 20) - Items per page
- `userId` (integer) - Filter by specific user
- `activityType` (string) - Filter by activity type
- `transactionType` (string) - Filter by transaction type
- `startDate` (ISO 8601) - Start date filter
- `endDate` (ISO 8601) - End date filter

**Request:**
```
GET /admin/transactions?userId=1&transactionType=credit&page=1&limit=10
```

**Response (200):**
```json
{
  "success": true,
  "message": "All transactions retrieved successfully",
  "data": [
    {
      "id": 1,
      "userId": 1,
      "transactionType": "credit",
      "amount": 10,
      "formattedAmount": "+10",
      "balanceBefore": 0,
      "balanceAfter": 10,
      "activityType": "PRODUCT_SHARE",
      "activityDescription": "Points earned for Share Product",
      "referenceId": "product_123",
      "referenceType": "product",
      "status": "completed",
      "processedBy": null,
      "metadata": {
        "productId": 123
      },
      "createdAt": "2024-01-01T09:00:00.000Z"
    }
  ],
  "meta": {
    "pagination": {
      "currentPage": 1,
      "itemsPerPage": 10,
      "totalItems": 150,
      "totalPages": 15
    }
  }
}
```

## GET /admin/redemptions
Mendapatkan semua request penukaran poin.

**Access:** Admin

**Query Parameters:**
- `page` (integer, default: 1) - Page number
- `limit` (integer, default: 20) - Items per page
- `status` (string) - Filter by status
- `redemptionType` (string) - Filter by redemption type
- `userId` (integer) - Filter by specific user

**Response (200):**
```json
{
  "success": true,
  "message": "All redemptions retrieved successfully",
  "data": [
    {
      "id": 1,
      "userId": 1,
      "pointsRedeemed": 100,
      "redemptionType": "cash",
      "redemptionValue": 10000.00,
      "redemptionDetails": {
        "bankAccount": "1234567890",
        "bankName": "Bank ABC",
        "accountName": "John Doe"
      },
      "status": "pending",
      "requestedAt": "2024-01-01T09:00:00.000Z",
      "processedAt": null,
      "processedBy": null,
      "adminNotes": null,
      "user": {
        "id": 1,
        "username": "johndoe",
        "email": "john@example.com"
      }
    }
  ],
  "meta": {
    "pagination": {
      "currentPage": 1,
      "itemsPerPage": 20,
      "totalItems": 10,
      "totalPages": 1
    }
  }
}
```

## PUT /admin/redemptions/:redemptionId/process
Memproses request penukaran poin (approve/reject).

**Access:** Admin

**Path Parameters:**
- `redemptionId` (integer) - Redemption ID

**Request Body:**
```json
{
  "action": "approve",
  "notes": "Approved and will be processed within 2-3 business days"
}
```

**Response (200) - Approved:**
```json
{
  "success": true,
  "message": "Redemption approved successfully",
  "data": {
    "id": 1,
    "userId": 1,
    "pointsRedeemed": 100,
    "redemptionType": "cash",
    "redemptionValue": 10000.00,
    "status": "approved",
    "requestedAt": "2024-01-01T09:00:00.000Z",
    "processedAt": "2024-01-01T10:00:00.000Z",
    "processedBy": 2,
    "adminNotes": "Approved and will be processed within 2-3 business days",
    "transactionId": 15
  },
  "code": "RESOURCE_UPDATED"
}
```

**Request Body (Reject):**
```json
{
  "action": "reject",
  "notes": "Insufficient documentation provided"
}
```

**Response (200) - Rejected:**
```json
{
  "success": true,
  "message": "Redemption rejected successfully",
  "data": {
    "id": 1,
    "status": "rejected",
    "processedAt": "2024-01-01T10:00:00.000Z",
    "processedBy": 2,
    "adminNotes": "Insufficient documentation provided"
  },
  "code": "RESOURCE_UPDATED"
}
```

## GET /admin/statistics
Mendapatkan statistik sistem poin.

**Access:** Admin

**Response (200):**
```json
{
  "success": true,
  "message": "System statistics retrieved successfully",
  "data": {
    "overview": {
      "totalPointsIssued": 15000,
      "totalPointsRedeemed": 5000,
      "totalPointsInCirculation": 10000,
      "activeUsers": 150,
      "topEarners": [
        {
          "id": 1,
          "username": "johndoe",
          "email": "john@example.com",
          "total_earned": 500,
          "current_points": 350
        }
      ]
    },
    "activities": [
      {
        "activity_type": "PRODUCT_SHARE",
        "transaction_count": 1200,
        "total_points": 12000,
        "unique_users": 80,
        "avg_points_per_transaction": 10
      },
      {
        "activity_type": "CAMPAIGN_SHARE",
        "transaction_count": 200,
        "total_points": 3000,
        "unique_users": 50,
        "avg_points_per_transaction": 15
      }
    ],
    "redemptions": {
      "byStatus": [
        {
          "status": "pending",
          "count": 5,
          "total_points": 500
        },
        {
          "status": "approved",
          "count": 15,
          "total_points": 1500
        },
        {
          "status": "rejected",
          "count": 2,
          "total_points": 200
        }
      ],
      "byType": [
        {
          "redemption_type": "cash",
          "count": 10,
          "total_points": 1000,
          "avg_points": 100
        },
        {
          "redemption_type": "voucher",
          "count": 5,
          "total_points": 500,
          "avg_points": 100
        }
      ]
    }
  }
}
```

## POST /admin/award
Award poin secara manual kepada pengguna.

**Access:** Admin

**Request Body:**
```json
{
  "userId": 1,
  "activityCode": "MANUAL_AWARD",
  "customAmount": 50,
  "description": "Bonus points for excellent engagement",
  "referenceId": "admin_bonus_001",
  "referenceType": "manual_award"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Points awarded successfully",
  "data": {
    "transaction": {
      "id": 20,
      "userId": 1,
      "transactionType": "credit",
      "amount": 50,
      "formattedAmount": "+50",
      "balanceBefore": 100,
      "balanceAfter": 150,
      "activityType": "MANUAL_AWARD",
      "activityDescription": "Bonus points for excellent engagement",
      "referenceId": "admin_bonus_001",
      "referenceType": "manual_award",
      "status": "completed",
      "processedBy": 2,
      "metadata": {
        "awardedBy": 2,
        "manualAward": true
      },
      "createdAt": "2024-01-01T10:00:00.000Z"
    },
    "newBalance": 150,
    "pointsAwarded": 50
  },
  "code": "POINTS_AWARDED"
}
```

---

# Error Responses

## Insufficient Balance (400)
```json
{
  "success": false,
  "message": "Insufficient points for redemption",
  "code": "INSUFFICIENT_BALANCE"
}
```

## Validation Error (400)
```json
{
  "success": false,
  "message": "Validation failed",
  "data": {
    "errors": [
      {
        "field": "pointsToRedeem",
        "message": "Points to redeem must be a positive integer",
        "value": -10
      }
    ]
  },
  "code": "VALIDATION_ERROR"
}
```

## Unauthorized (401)
```json
{
  "success": false,
  "message": "Access token required",
  "code": "MISSING_TOKEN"
}
```

## Forbidden (403)
```json
{
  "success": false,
  "message": "Insufficient permissions",
  "code": "INSUFFICIENT_PERMISSIONS"
}
```

## Resource Not Found (404)
```json
{
  "success": false,
  "message": "Redemption not found",
  "code": "RESOURCE_NOT_FOUND"
}
```

---

# Usage Examples

## Example: Get My Points Balance
```bash
curl -X GET "http://localhost:3000/api/v1/points/my-points" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Example: View Transaction History
```bash
curl -X GET "http://localhost:3000/api/v1/points/my-transactions?page=1&limit=10&transactionType=credit" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Example: Request Point Redemption
```bash
curl -X POST "http://localhost:3000/api/v1/points/redeem" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
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

## Example: Admin - Process Redemption
```bash
curl -X PUT "http://localhost:3000/api/v1/points/admin/redemptions/1/process" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "action": "approve",
    "notes": "Approved and will be processed within 2-3 business days"
  }'
```

## Example: Admin - Award Points Manually
```bash
curl -X POST "http://localhost:3000/api/v1/points/admin/award" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "userId": 1,
    "activityCode": "MANUAL_AWARD",
    "customAmount": 50,
    "description": "Bonus points for excellent engagement",
    "referenceId": "admin_bonus_001",
    "referenceType": "manual_award"
  }'
```

## Example: Admin - View System Statistics
```bash
curl -X GET "http://localhost:3000/api/v1/points/admin/statistics" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

---

# Point Activity Types

## Default Activities
- `PRODUCT_SHARE` - Points earned for sharing product links (10 points, daily limit: 10)
- `CAMPAIGN_SHARE` - Points earned for sharing campaign links (15 points, daily limit: 5)
- `DAILY_LOGIN` - Points earned for daily login (5 points, daily limit: 1)
- `PROFILE_COMPLETE` - One-time points for completing profile (50 points, total limit: 1)
- `EMAIL_VERIFY` - One-time points for email verification (25 points, total limit: 1)
- `REDEMPTION` - Points deducted for redemption requests
- `REFUND` - Points refunded from cancelled redemptions
- `MANUAL_AWARD` - Points awarded manually by admin

## Redemption Types
- `cash` - Cash redemption to bank account
- `voucher` - Voucher/gift card redemption
- `discount` - Discount code redemption
- `product` - Product exchange
- `donation` - Charity donation

## Transaction Status
- `pending` - Transaction is pending processing
- `completed` - Transaction has been completed
- `failed` - Transaction failed to process
- `cancelled` - Transaction was cancelled

## Redemption Status
- `pending` - Waiting for admin approval
- `approved` - Approved by admin, points deducted
- `rejected` - Rejected by admin
- `completed` - Redemption has been fully processed
- `cancelled` - Redemption was cancelled

---

# Business Logic

## Point Earning Rules
1. **Daily Limits**: Each activity has a daily limit to prevent abuse
2. **Total Limits**: Some activities have lifetime limits (e.g., email verification)
3. **Activity Validation**: System checks if user can earn points before awarding
4. **Balance Tracking**: Every transaction updates user's current balance

## Point Redemption Flow
1. User requests redemption with required points
2. System validates user has sufficient balance
3. Redemption request created with "pending" status
4. Admin reviews and approves/rejects the request
5. If approved, points are automatically deducted
6. If rejected, no points are deducted
7. Redemption can be cancelled (with refund if already approved)

## Transaction Integrity
- All point operations use database transactions
- Balance calculations are atomic
- Triggers automatically update user's current_points
- Historical data is immutable (no deletes, only status changes)

## Security Features
- All endpoints require authentication
- Admin-only endpoints require admin role
- Input validation prevents negative amounts
- Rate limiting prevents API abuse
- Comprehensive audit logging

---

# Database Schema

## point_transactions Table
```sql
- id (INT, PRIMARY KEY)
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

## point_activities Table
```sql
- id (INT, PRIMARY KEY)
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

## point_redemptions Table
```sql
- id (INT, PRIMARY KEY)
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

---

# Integration Notes

## Email Integration
- Users receive email notifications for successful redemptions
- Admin receives notifications for new redemption requests

## Activity Integration
- Point earning activities can be triggered from other parts of the system
- Use `pointService.awardPoints()` method to award points programmatically

## Product Integration
- Product sharing can automatically award points
- Use metadata to track which products were shared

## Campaign Integration  
- Campaign sharing can automatically award points
- Track campaign performance through point statistics

---

# Performance Considerations

## Database Optimization
- Indexes on frequently queried fields (user_id, created_at, status)
- JSON metadata for flexible data storage
- Efficient pagination with limit/offset

## Caching Strategy
- Cache available activities (rarely change)
- Cache user point balances (with invalidation on transactions)
- Cache system statistics (refresh periodically)

## Rate Limiting
- API rate limits to prevent abuse
- Daily activity limits to prevent gaming
- Cooldown periods for certain activities

---

# Monitoring & Analytics

## Key Metrics to Track
- Total points issued vs redeemed
- Most popular earning activities  
- Redemption approval rates
- User engagement through point activities
- Average points per user
- Point inflation/deflation trends

## Alerts to Set Up
- Unusual point earning patterns (potential fraud)
- High redemption request volumes
- Failed transactions requiring investigation
- Users with excessively high point balances

---

**Note**: Point system is designed to be flexible and extensible. New activity types and redemption options can be easily added through the admin interface or database updates.