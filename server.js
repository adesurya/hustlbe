#!/usr/bin/env node

/**
 * Secure Node.js Backend Server
 * Entry point for the application
 */

// Add error handling at the very beginning
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

console.log('🚀 Starting server...');

try {
  require('dotenv').config();
  console.log('✅ Environment variables loaded');
} catch (error) {
  console.error('❌ Failed to load environment variables:', error);
  process.exit(1);
}

let app;
try {
  app = require('./src/app');
  console.log('✅ App module loaded');
} catch (error) {
  console.error('❌ Failed to load app module:', error);
  process.exit(1);
}

let testConnection;
try {
  ({ testConnection } = require('./src/config/database'));
  console.log('✅ Database config loaded');
} catch (error) {
  console.error('❌ Failed to load database config:', error);
  process.exit(1);
}

let logger;
try {
  ({ logger } = require('./src/utils/logger'));
  console.log('✅ Logger loaded');
} catch (error) {
  console.error('❌ Failed to load logger:', error);
  // Fallback to console if logger fails
  logger = console;
}

// Configuration
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';
const NODE_ENV = process.env.NODE_ENV || 'development';

console.log(`📋 Configuration:`);
console.log(`   NODE_ENV: ${NODE_ENV}`);
console.log(`   HOST: ${HOST}`);
console.log(`   PORT: ${PORT}`);

/**
 * Start the server
 */
const startServer = async () => {
  try {
    console.log('🔍 Testing database connection...');
    
    // Test database connection
    const dbConnected = await testConnection();
    
    if (!dbConnected) {
      logger.error('Failed to connect to database. Exiting...');
      process.exit(1);
    }

    console.log('🎯 Starting HTTP server...');

    // Start HTTP server
    const server = app.listen(PORT, HOST, () => {
      logger.info(`🚀 Server running in ${NODE_ENV} mode`);
      logger.info(`🌐 Server URL: http://${HOST}:${PORT}`);
      logger.info(`📚 API Documentation: http://${HOST}:${PORT}/docs`);
      logger.info(`❤️  Health Check: http://${HOST}:${PORT}/health`);
      logger.info(`🔐 API Endpoints: http://${HOST}:${PORT}${process.env.API_PREFIX || '/api/v1'}`);
      
      if (NODE_ENV === 'development') {
        logger.info('📋 Available routes:');
        logger.info('   Authentication:');
        logger.info(`     POST ${process.env.API_PREFIX || '/api/v1'}/auth/register`);
        logger.info(`     POST ${process.env.API_PREFIX || '/api/v1'}/auth/login`);
        logger.info(`     GET  ${process.env.API_PREFIX || '/api/v1'}/auth/google`);
        logger.info(`     POST ${process.env.API_PREFIX || '/api/v1'}/auth/logout`);
        logger.info(`     GET  ${process.env.API_PREFIX || '/api/v1'}/auth/profile`);
        logger.info('   Categories:');
        logger.info(`     GET  ${process.env.API_PREFIX || '/api/v1'}/categories`);
        logger.info(`     POST ${process.env.API_PREFIX || '/api/v1'}/categories (Admin)`);
        logger.info(`     PUT  ${process.env.API_PREFIX || '/api/v1'}/categories/:id (Admin)`);
        logger.info('   Products:');
        logger.info(`     GET  ${process.env.API_PREFIX || '/api/v1'}/products`);
        logger.info(`     GET  ${process.env.API_PREFIX || '/api/v1'}/products/featured`);
        logger.info(`     GET  ${process.env.API_PREFIX || '/api/v1'}/products/search`);
        logger.info(`     POST ${process.env.API_PREFIX || '/api/v1'}/products (Admin)`);
        logger.info('   Points:');
        logger.info(`     GET  ${process.env.API_PREFIX || '/api/v1'}/points/my-points`);
        logger.info(`     POST ${process.env.API_PREFIX || '/api/v1'}/points/redeem`);
        logger.info('   File Access:');
        logger.info(`     GET  /uploads/categories/:filename`);
        logger.info(`     GET  /uploads/products/:filename`);
      }
    });

    // Store server instance for graceful shutdown
    app.set('server', server);

    // Server error handling
    server.on('error', (error) => {
      if (error.syscall !== 'listen') {
        throw error;
      }

      const bind = typeof PORT === 'string' ? `Pipe ${PORT}` : `Port ${PORT}`;

      switch (error.code) {
        case 'EACCES':
          logger.error(`${bind} requires elevated privileges`);
          process.exit(1);
          break;
        case 'EADDRINUSE':
          logger.error(`${bind} is already in use`);
          process.exit(1);
          break;
        default:
          throw error;
      }
    });

    // Handle server startup
    server.on('listening', () => {
      const addr = server.address();
      const bind = typeof addr === 'string' ? `pipe ${addr}` : `port ${addr.port}`;
      logger.info(`Server listening on ${bind}`);
    });

    // Handle server close
    server.on('close', () => {
      logger.info('Server closed');
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    console.error('❌ Server startup failed:', error);
    process.exit(1);
  }
};

/**
 * Handle SIGTERM signal
 */
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  const server = app.get('server');
  
  if (server) {
    server.close(() => {
      logger.info('Process terminated');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

/**
 * Handle SIGINT signal (Ctrl+C)
 */
process.on('SIGINT', () => {
  logger.info('SIGINT received. Shutting down gracefully...');
  const server = app.get('server');
  
  if (server) {
    server.close(() => {
      logger.info('Process terminated');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

// Start the server
console.log('🎬 Calling startServer...');
startServer().catch((error) => {
  console.error('❌ Fatal error during startup:', error);
  process.exit(1);
});

module.exports = app;