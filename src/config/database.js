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
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci',
    // SSL configuration for production
    ssl: process.env.NODE_ENV === 'production' ? {
      require: true,
      rejectUnauthorized: false
    } : false,
    // Connection timeout
    connectTimeout: 30000,
    acquireTimeout: 30000,
    timeout: 30000,
    // Prevent SQL injection
    multipleStatements: false
  },
  define: {
    timestamps: true,
    underscored: true,
    paranoid: true, // Soft deletes
    freezeTableName: true,
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci'
  },
  // Query options for security
  query: {
    raw: false,
    nest: true
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
  gracefulShutdown
};