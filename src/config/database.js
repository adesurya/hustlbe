const { Sequelize } = require('sequelize');
const winston = require('winston');
require('dotenv').config();

// Database configuration with security best practices
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  database: process.env.DB_NAME || 'secure_app_db',
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD,
  dialect: process.env.DB_DIALECT || 'mysql',
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000
  },
  dialectOptions: {
    // Only valid MySQL2 options
    supportBigNumbers: true,
    bigNumberStrings: true,
    dateStrings: true,
    typeCast: true,
    
    // SSL configuration for production (fixed format)
    ...(process.env.NODE_ENV === 'production' && {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    }),
    
    // Prevent SQL injection
    multipleStatements: false
  },
  define: {
    timestamps: true,
    underscored: true,
    paranoid: true, // Soft deletes
    freezeTableName: true,
    // Move charset/collate to define section
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci'
  },
  // Timezone
  timezone: '+07:00'
};

// Create Sequelize instance
const sequelize = new Sequelize(
  dbConfig.database,
  dbConfig.username,
  dbConfig.password,
  dbConfig
);

// Test database connection
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    winston.info('Database connection established successfully');
    return true;
  } catch (error) {
    winston.error('Unable to connect to the database:', error.message);
    return false;
  }
};

// Sync database and create tables
const syncDatabase = async (force = false) => {
  try {
    // Sync all models (create tables if they don't exist)
    await sequelize.sync({ 
      force, // Set to true to drop and recreate tables
      alter: !force // Alter existing tables to match models if force is false
    });
    
    winston.info('Database synchronized successfully');
    return true;
  } catch (error) {
    winston.error('Error synchronizing database:', error.message);
    return false;
  }
};

// Initialize database (create tables if they don't exist)
const initializeDatabase = async () => {
  try {
    // Test connection first
    const connected = await testConnection();
    if (!connected) {
      throw new Error('Cannot connect to database');
    }

    // Check if we need to create tables
    const shouldSync = process.env.DB_SYNC === 'true' || process.env.NODE_ENV === 'development';
    
    if (shouldSync) {
      await syncDatabase(process.env.DB_FORCE_SYNC === 'true');
    }
    
    return true;
  } catch (error) {
    winston.error('Database initialization failed:', error.message);
    return false;
  }
};

// Graceful shutdown
const gracefulShutdown = async () => {
  try {
    await sequelize.close();
    winston.info('Database connection closed successfully');
  } catch (error) {
    winston.error('Error closing database connection:', error.message);
  }
};

// Handle process termination
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

module.exports = {
  sequelize,
  testConnection,
  syncDatabase,
  initializeDatabase,
  gracefulShutdown
};