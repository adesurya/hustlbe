-- MySQL dump 10.13  Distrib 8.0.30, for Win64 (x86_64)
--
-- Host: localhost    Database: hustlbe
-- ------------------------------------------------------
-- Server version	8.0.30

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `audit_logs`
--

DROP TABLE IF EXISTS `audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `action` varchar(100) NOT NULL,
  `resource` varchar(100) DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text,
  `success` tinyint(1) DEFAULT '1',
  `error_message` text,
  `metadata` json DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_action` (`action`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_ip_address` (`ip_address`),
  CONSTRAINT `audit_logs_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_logs`
--

LOCK TABLES `audit_logs` WRITE;
/*!40000 ALTER TABLE `audit_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `audit_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `categories`
--

DROP TABLE IF EXISTS `categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `categories` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `slug` varchar(120) NOT NULL,
  `description` text,
  `image` varchar(500) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `sort_order` int DEFAULT '0',
  `created_by` int DEFAULT NULL,
  `updated_by` int DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`),
  UNIQUE KEY `slug` (`slug`),
  KEY `created_by` (`created_by`),
  KEY `updated_by` (`updated_by`),
  KEY `idx_name` (`name`),
  KEY `idx_slug` (`slug`),
  KEY `idx_is_active` (`is_active`),
  KEY `idx_sort_order` (`sort_order`),
  KEY `idx_categories_deleted_at` (`deleted_at`),
  CONSTRAINT `categories_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `categories_ibfk_2` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=38 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `categories`
--

LOCK TABLES `categories` WRITE;
/*!40000 ALTER TABLE `categories` DISABLE KEYS */;
INSERT INTO `categories` VALUES (1,'Electronics','electronics','Electronic devices and gadgets',NULL,1,1,NULL,NULL,'2025-07-25 18:27:24','2025-07-25 18:35:12',NULL),(2,'Fashion','fashion','Clothing and fashion accessories',NULL,1,2,NULL,NULL,'2025-07-25 18:27:24','2025-07-25 18:35:12',NULL),(3,'Home & Garden','home-garden','Home improvement and garden supplies',NULL,1,3,NULL,NULL,'2025-07-25 18:27:24','2025-07-25 18:35:12',NULL),(4,'Sports','sports','Sports equipment and accessories',NULL,1,4,NULL,NULL,'2025-07-25 18:27:24','2025-07-25 18:35:12',NULL),(5,'Books','books','Books and educational materials',NULL,1,5,NULL,NULL,'2025-07-25 18:27:24','2025-07-25 18:35:12',NULL),(31,'Updated Test Category','test-category','Updated Test Category','category_1753604964506_fc78ac16481bd2ce5f1d27c655b36e91.png',1,1,1,1,'2025-07-27 14:31:10','2025-07-27 15:43:27',NULL),(37,'Test Category4','test-category4','Test Category description',NULL,1,1,1,NULL,'2025-07-27 21:33:47','2025-07-27 21:33:47',NULL);
/*!40000 ALTER TABLE `categories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `point_activities`
--

DROP TABLE IF EXISTS `point_activities`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `point_activities` (
  `id` int NOT NULL AUTO_INCREMENT,
  `activity_code` varchar(50) NOT NULL,
  `activity_name` varchar(100) NOT NULL,
  `description` text,
  `points_reward` int NOT NULL DEFAULT '0',
  `daily_limit` int DEFAULT NULL,
  `total_limit` int DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `valid_from` datetime DEFAULT NULL,
  `valid_until` datetime DEFAULT NULL,
  `created_by` int DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `activity_code` (`activity_code`),
  KEY `created_by` (`created_by`),
  KEY `idx_activity_code` (`activity_code`),
  KEY `idx_is_active` (`is_active`),
  KEY `idx_valid_period` (`valid_from`,`valid_until`),
  CONSTRAINT `point_activities_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `point_activities`
--

LOCK TABLES `point_activities` WRITE;
/*!40000 ALTER TABLE `point_activities` DISABLE KEYS */;
INSERT INTO `point_activities` VALUES (1,'PRODUCT_SHARE','Share Product','Points earned for sharing product links',10,10,NULL,1,'2025-07-25 18:27:25',NULL,NULL,'2025-07-25 18:27:25','2025-07-25 18:35:12',NULL),(2,'CAMPAIGN_SHARE','Share Campaign','Points earned for sharing campaign links',15,5,NULL,1,'2025-07-25 18:27:25',NULL,NULL,'2025-07-25 18:27:25','2025-07-25 18:35:12',NULL),(3,'DAILY_LOGIN','Daily Login Bonus','Points earned for daily login',5,1,NULL,1,'2025-07-25 18:27:25',NULL,NULL,'2025-07-25 18:27:25','2025-07-25 18:35:12',NULL),(4,'PROFILE_COMPLETE','Complete Profile','One-time points for completing profile',50,NULL,NULL,1,'2025-07-25 18:27:25',NULL,NULL,'2025-07-25 18:27:25','2025-07-25 18:35:12',NULL),(5,'EMAIL_VERIFY','Email Verification','One-time points for email verification',25,NULL,NULL,1,'2025-07-25 18:27:25',NULL,NULL,'2025-07-25 18:27:25','2025-07-25 18:35:12',NULL),(6,'MANUAL_AWARD','MANUAL AWARD','Bonus points for excellent engagement',1000,NULL,NULL,1,'2025-07-25 18:27:25',NULL,NULL,'2025-07-25 18:27:25','2025-07-25 18:35:12',NULL);
/*!40000 ALTER TABLE `point_activities` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `point_redemptions`
--

DROP TABLE IF EXISTS `point_redemptions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `point_redemptions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `points_redeemed` int NOT NULL,
  `redemption_type` varchar(50) NOT NULL,
  `redemption_value` decimal(12,2) DEFAULT NULL,
  `redemption_details` json DEFAULT NULL,
  `status` enum('pending','approved','rejected','completed','cancelled') DEFAULT 'pending',
  `requested_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `processed_at` datetime DEFAULT NULL,
  `processed_by` int DEFAULT NULL,
  `admin_notes` text,
  `transaction_id` int DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `processed_by` (`processed_by`),
  KEY `transaction_id` (`transaction_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_status` (`status`),
  KEY `idx_requested_at` (`requested_at`),
  KEY `idx_processed_at` (`processed_at`),
  CONSTRAINT `point_redemptions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `point_redemptions_ibfk_2` FOREIGN KEY (`processed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `point_redemptions_ibfk_3` FOREIGN KEY (`transaction_id`) REFERENCES `point_transactions` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `point_redemptions`
--

LOCK TABLES `point_redemptions` WRITE;
/*!40000 ALTER TABLE `point_redemptions` DISABLE KEYS */;
INSERT INTO `point_redemptions` VALUES (1,1,100,'cash',10000.00,'{\"bankName\": \"Bank ABC\", \"accountName\": \"John Doe\", \"bankAccount\": \"1234567890\"}','approved','2025-07-27 13:12:37','2025-07-27 13:26:32',1,'Approved and will be processed',3,'2025-07-27 13:12:37','2025-07-27 13:26:32',NULL);
/*!40000 ALTER TABLE `point_redemptions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `point_transactions`
--

DROP TABLE IF EXISTS `point_transactions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `point_transactions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `transaction_type` enum('credit','debit') NOT NULL,
  `amount` int NOT NULL,
  `balance_before` int NOT NULL DEFAULT '0',
  `balance_after` int NOT NULL DEFAULT '0',
  `activity_type` varchar(50) NOT NULL,
  `activity_description` text,
  `reference_id` varchar(100) DEFAULT NULL,
  `reference_type` varchar(50) DEFAULT NULL,
  `status` enum('pending','completed','failed','cancelled') DEFAULT 'completed',
  `processed_by` int DEFAULT NULL,
  `metadata` json DEFAULT NULL,
  `expires_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `processed_by` (`processed_by`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_transaction_type` (`transaction_type`),
  KEY `idx_activity_type` (`activity_type`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_reference` (`reference_id`,`reference_type`),
  KEY `idx_expires_at` (`expires_at`),
  CONSTRAINT `point_transactions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `point_transactions_ibfk_2` FOREIGN KEY (`processed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `point_transactions`
--

LOCK TABLES `point_transactions` WRITE;
/*!40000 ALTER TABLE `point_transactions` DISABLE KEYS */;
INSERT INTO `point_transactions` VALUES (1,1,'credit',25,0,25,'EMAIL_VERIFY','Points awarded for email verification',NULL,'system','completed',NULL,NULL,NULL,'2025-07-25 18:35:12','2025-07-25 18:35:12',NULL),(2,1,'credit',100,25,125,'TEST','Test transaction',NULL,NULL,'completed',NULL,NULL,NULL,'2025-07-25 18:37:31','2025-07-25 18:37:31',NULL),(3,1,'debit',100,125,25,'REDEMPTION','Points redeemed for cash','1','redemption','completed',1,'{\"redemptionType\": \"cash\", \"redemptionDetails\": {\"bankName\": \"Bank ABC\", \"accountName\": \"John Doe\", \"bankAccount\": \"1234567890\"}}',NULL,'2025-07-27 13:26:32','2025-07-27 13:26:32',NULL),(4,13,'credit',1000,0,1000,'MANUAL_AWARD','Bonus points for excellent engagement','admin_bonus_001','manual_award','completed',NULL,'{\"awardedBy\": 1, \"manualAward\": true}',NULL,'2025-07-27 16:37:36','2025-07-27 16:37:36',NULL);
/*!40000 ALTER TABLE `point_transactions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `product_images`
--

DROP TABLE IF EXISTS `product_images`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `product_images` (
  `id` int NOT NULL AUTO_INCREMENT,
  `product_id` int NOT NULL,
  `image_path` varchar(500) NOT NULL,
  `alt_text` varchar(200) DEFAULT NULL,
  `is_primary` tinyint(1) DEFAULT '0',
  `sort_order` int DEFAULT '0',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_product_id` (`product_id`),
  KEY `idx_is_primary` (`is_primary`),
  KEY `idx_sort_order` (`sort_order`),
  CONSTRAINT `product_images_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `product_images`
--

LOCK TABLES `product_images` WRITE;
/*!40000 ALTER TABLE `product_images` DISABLE KEYS */;
/*!40000 ALTER TABLE `product_images` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `products`
--

DROP TABLE IF EXISTS `products`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `products` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(200) NOT NULL,
  `slug` varchar(220) NOT NULL,
  `description` text,
  `points` int NOT NULL DEFAULT '0',
  `price` decimal(12,2) NOT NULL DEFAULT '0.00',
  `url` varchar(500) DEFAULT NULL,
  `image` varchar(500) DEFAULT NULL,
  `category_id` int NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `is_featured` tinyint(1) DEFAULT '0',
  `stock_quantity` int DEFAULT '0',
  `view_count` int DEFAULT '0',
  `sort_order` int DEFAULT '0',
  `meta_title` varchar(200) DEFAULT NULL,
  `meta_description` text,
  `created_by` int DEFAULT NULL,
  `updated_by` int DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `slug` (`slug`),
  KEY `created_by` (`created_by`),
  KEY `updated_by` (`updated_by`),
  KEY `idx_title` (`title`),
  KEY `idx_slug` (`slug`),
  KEY `idx_category_id` (`category_id`),
  KEY `idx_is_active` (`is_active`),
  KEY `idx_is_featured` (`is_featured`),
  KEY `idx_points` (`points`),
  KEY `idx_price` (`price`),
  KEY `idx_sort_order` (`sort_order`),
  KEY `idx_view_count` (`view_count`),
  CONSTRAINT `products_ibfk_1` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `products_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `products_ibfk_3` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=20 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `products`
--

LOCK TABLES `products` WRITE;
/*!40000 ALTER TABLE `products` DISABLE KEYS */;
INSERT INTO `products` VALUES (1,'Smartphone Android Terbaru','smartphone-android-terbaru','Smartphone Android dengan teknologi terdepan, kamera berkualitas tinggi, dan performa yang luar biasa.',1500,5999999.00,'https://example.com/products/smartphone-android',NULL,1,1,1,50,0,0,'Smartphone Android Terbaru - Teknologi Terdepan','Dapatkan smartphone Android terbaru dengan fitur canggih dan harga terjangkau',NULL,NULL,'2025-07-25 18:27:24','2025-07-25 18:35:12',NULL),(2,'Laptop Gaming Professional','laptop-gaming-professional','Laptop gaming dengan spesifikasi tinggi untuk para profesional dan gamers.',2500,15999999.00,'https://example.com/products/laptop-gaming',NULL,1,1,1,25,0,0,'Laptop Gaming Professional - Performa Maksimal','Laptop gaming terbaik untuk kebutuhan profesional dan gaming',NULL,NULL,'2025-07-25 18:27:24','2025-07-25 18:35:12',NULL),(3,'Kaos Cotton Premium','kaos-cotton-premium','Kaos berbahan cotton premium yang nyaman dan berkualitas tinggi.',300,199999.00,'https://example.com/products/kaos-cotton',NULL,2,1,0,100,0,0,'Kaos Cotton Premium - Kualitas Terbaik','Kaos cotton premium dengan kualitas terbaik dan harga terjangkau',NULL,1,'2025-07-25 18:27:24','2025-07-27 16:08:26',NULL),(19,'Updated Product Title','gaming-laptop-pro','Updated description',12,3499999.00,'https://example.com/gaming-laptop-pro','product_1753592968250_febc93cdfb57745f08c30a5d20b29a20.png',1,1,1,10,0,0,'Gaming Laptop Pro',NULL,1,1,'2025-07-27 12:09:28','2025-07-27 16:03:52','2025-07-27 16:03:52');
/*!40000 ALTER TABLE `products` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `rate_limits`
--

DROP TABLE IF EXISTS `rate_limits`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `rate_limits` (
  `id` int NOT NULL AUTO_INCREMENT,
  `identifier` varchar(255) NOT NULL,
  `type` varchar(50) NOT NULL,
  `count` int DEFAULT '1',
  `reset_time` datetime NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_identifier_type` (`identifier`,`type`),
  KEY `idx_reset_time` (`reset_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `rate_limits`
--

LOCK TABLES `rate_limits` WRITE;
/*!40000 ALTER TABLE `rate_limits` DISABLE KEYS */;
/*!40000 ALTER TABLE `rate_limits` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sessions`
--

DROP TABLE IF EXISTS `sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sessions` (
  `session_id` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `expires` int unsigned NOT NULL,
  `data` mediumtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  PRIMARY KEY (`session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sessions`
--

LOCK TABLES `sessions` WRITE;
/*!40000 ALTER TABLE `sessions` DISABLE KEYS */;
/*!40000 ALTER TABLE `sessions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `email` varchar(100) NOT NULL,
  `phone_number` varchar(20) DEFAULT NULL,
  `password_hash` varchar(255) DEFAULT NULL,
  `role` enum('admin','user') DEFAULT 'user',
  `google_id` varchar(255) DEFAULT NULL,
  `profile_picture` varchar(500) DEFAULT NULL,
  `is_verified` tinyint(1) DEFAULT '0',
  `is_active` tinyint(1) DEFAULT '1',
  `login_attempts` int DEFAULT '0',
  `locked_until` datetime DEFAULT NULL,
  `last_login` datetime DEFAULT NULL,
  `password_changed_at` datetime DEFAULT NULL,
  `email_verified_at` datetime DEFAULT NULL,
  `two_factor_secret` varchar(32) DEFAULT NULL,
  `two_factor_enabled` tinyint(1) DEFAULT '0',
  `current_points` int NOT NULL DEFAULT '0',
  `email_verification_token` varchar(255) DEFAULT NULL,
  `email_verification_expires` datetime DEFAULT NULL,
  `email_verification_sent_at` datetime DEFAULT NULL,
  `refresh_token_hash` varchar(255) DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  `token_version` int NOT NULL DEFAULT '0' COMMENT 'Incremented on logout/password change to invalidate old tokens',
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `google_id` (`google_id`),
  KEY `idx_email` (`email`),
  KEY `idx_username` (`username`),
  KEY `idx_google_id` (`google_id`),
  KEY `idx_role` (`role`),
  KEY `idx_is_active` (`is_active`),
  KEY `idx_locked_until` (`locked_until`),
  KEY `idx_email_verification_token` (`email_verification_token`),
  KEY `idx_email_verification_expires` (`email_verification_expires`),
  KEY `idx_current_points` (`current_points`),
  KEY `idx_token_version` (`token_version`)
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'admin','admin@example.com',NULL,'$2a$12$y2XZ5wfQdj8Fa/8R0hH03.xwWmWJlWzexy0rIbG0p1aBOyqCXaoVm','admin',NULL,NULL,1,1,0,NULL,'2025-07-27 20:38:31',NULL,'2025-07-25 18:27:24',NULL,0,25,NULL,NULL,NULL,'$2a$10$RQugfd1QHt8UaRekY/EWxOmqqhn4uI9cEb3b3suyG7/WfwKeNfrb6','2025-07-25 18:27:24','2025-07-27 20:38:31',NULL,1),(13,'adesurya','adesurya.tkj@gmail.com','08170261628','$2a$12$LldHYI6fZpMtA22ClWTq2.SWuTtM.RO02jkd.HitWnEi0a/hSs0i2','user',NULL,NULL,1,1,0,NULL,'2025-07-27 20:38:53','2025-07-27 10:32:29','2025-07-27 10:33:22',NULL,0,1000,NULL,NULL,'2025-07-27 10:32:29','$2a$10$YrbMluUJ/2VWjIDF6V0uTOSakvnAfZSWp2G0HzoDN3qUs/SmXFpOO','2025-07-27 10:32:29','2025-07-27 20:38:53',NULL,1),(14,'newuser','user@example.com',NULL,'$2a$12$9mnXxzICdYPmwYtbI4Eif.GUPrVBOZUoc02QIOU.0M/q1zl0A4RIm','user',NULL,NULL,1,1,0,NULL,'2025-07-27 21:33:33','2025-07-27 21:13:51',NULL,NULL,0,0,NULL,NULL,NULL,'$2a$10$wNrCwbI8SVIit.TPZYfUweTAEzMrsXqJli7GEy3sEmgDjUGamTFKm','2025-07-27 21:12:41','2025-07-27 21:33:33',NULL,2);
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-07-27 22:26:08
