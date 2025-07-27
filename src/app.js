const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const session = require('express-session');
const SequelizeStore = require('connect-session-sequelize')(session.Store);
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss');


require('dotenv').config();

// Import configurations
const { sequelize } = require('./config/database');

// Import security configurations with fallbacks
let corsOptions, helmetOptions, generalLimiter;
try {
  const securityConfig = require('./config/security');
  corsOptions = securityConfig.corsOptions || {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
  };
  helmetOptions = securityConfig.helmetOptions || {};
  generalLimiter = securityConfig.generalLimiter || ((req, res, next) => next());
} catch (error) {
  console.warn('⚠️ Security config not found, using fallback configurations');
  corsOptions = {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
  };
  helmetOptions = {};
  generalLimiter = (req, res, next) => next();
}

// Import passport configuration with error handling
let passport;
try {
  passport = require('./config/passport');
} catch (error) {
  console.warn('⚠️ Passport config not found, authentication may not work properly');
  passport = require('passport');
}

// Import middleware
let requestLogger, errorLogger;
try {
  const loggerUtils = require('./utils/logger');
  requestLogger = loggerUtils.requestLogger || ((req, res, next) => next());
  errorLogger = loggerUtils.errorLogger || ((req, res, next) => next());
} catch (error) {
  console.warn('⚠️ Logger utils not found, using fallback loggers');
  requestLogger = (req, res, next) => next();
  errorLogger = (req, res, next) => next();
}

let errorHandler, notFoundHandler;
try {
  const errorMiddleware = require('./middleware/errorHandler');
  errorHandler = errorMiddleware.errorHandler;
  notFoundHandler = errorMiddleware.notFoundHandler;
} catch (error) {
  console.warn('⚠️ Error handler middleware not found, using fallback');
  errorHandler = (err, req, res, next) => {
    res.status(500).json({ success: false, message: 'Internal server error' });
  };
  notFoundHandler = (req, res) => {
    res.status(404).json({ success: false, message: 'Route not found' });
  };
}

// Import routes
let authRoutes, categoryRoutes, productRoutes, pointRoutes, leaderboardRoutes, userRoutes;

try {
  authRoutes = require('./routes/auth');
} catch (error) {
  console.warn('⚠️ Auth routes not found');
  authRoutes = null;
}

try {
  categoryRoutes = require('./routes/category');
} catch (error) {
  console.warn('⚠️ Category routes not found');
  categoryRoutes = null;
}

try {
  productRoutes = require('./routes/product');
} catch (error) {
  console.warn('⚠️ Product routes not found');
  productRoutes = null;
}

try {
  pointRoutes = require('./routes/point');
} catch (error) {
  console.warn('⚠️ Point routes not found');
  pointRoutes = null;
}

try {
  userRoutes = require('./routes/user');
  console.log('✅ User routes loaded successfully');
} catch (error) {
  console.log('⚠️ User routes not found, skipping user management endpoints');
  console.log('   Error:', error.message);
  userRoutes = null;
}

try {
  leaderboardRoutes = require('./routes/leaderboard');
  console.log('✅ Leaderboard routes loaded successfully');
} catch (error) {
  console.log('⚠️ Leaderboard routes not found, skipping leaderboard endpoints');
  console.log('   Error:', error.message);
  leaderboardRoutes = null;
}

// Create Express app
const app = express();

// Trust proxy (important for rate limiting and IP detection)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet(helmetOptions));
app.use(cors(corsOptions));

// Rate limiting
app.use(generalLimiter);

// Serve static files for uploads
app.use('/uploads', express.static('uploads', {
  maxAge: '1d', // Cache for 1 day
  etag: true,
  lastModified: true
}));

// Body parsing middleware
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    // Store raw body for webhook verification if needed
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Data sanitization middleware
app.use(mongoSanitize()); // Remove NoSQL injection attempts
app.use((req, res, next) => {
  // XSS protection for request body
  if (req.body) {
    req.body = JSON.parse(xss(JSON.stringify(req.body)));
  }
  next();
});

// Session configuration
const sessionStore = new SequelizeStore({
  db: sequelize,
  checkExpirationInterval: 15 * 60 * 1000, // Clean up expired sessions every 15 minutes
  expiration: 24 * 60 * 60 * 1000 // Session expires after 24 hours
});

app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret-key',
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  name: 'sessionId', // Don't use default session name
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: parseInt(process.env.SESSION_MAX_AGE) || 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'strict'
  }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Request logging middleware
app.use(requestLogger);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version || '1.0.0'
  });
});

// API routes
const API_PREFIX = process.env.API_PREFIX || '/api/v1';

// Mount routes with error handling
if (authRoutes) {
  app.use(`${API_PREFIX}/auth`, authRoutes);
  console.log(`✅ Auth routes mounted at ${API_PREFIX}/auth`);
} else {
  console.log('❌ Auth routes not available');
}

if (userRoutes) {
  app.use(`${API_PREFIX}/users`, userRoutes);
  console.log(`✅ User routes mounted at ${API_PREFIX}/users`);
} else {
  console.log('❌ User routes not available');
  // Create a fallback route that explains the issue
  app.use(`${API_PREFIX}/users`, (req, res) => {
    res.status(501).json({
      success: false,
      message: 'User management endpoints are not available',
      error: 'User routes could not be loaded',
      suggestion: 'Please check if routes/user.js exists and is properly configured'
    });
  });
}

if (categoryRoutes) {
  app.use(`${API_PREFIX}/categories`, categoryRoutes);
  console.log(`✅ Category routes mounted at ${API_PREFIX}/categories`);
}

if (productRoutes) {
  app.use(`${API_PREFIX}/products`, productRoutes);
  console.log(`✅ Product routes mounted at ${API_PREFIX}/products`);
}

if (pointRoutes) {
  app.use(`${API_PREFIX}/points`, pointRoutes);
  console.log(`✅ Point routes mounted at ${API_PREFIX}/points`);
}

if (leaderboardRoutes) {
  app.use(`${API_PREFIX}/leaderboard`, leaderboardRoutes);
  console.log(`✅ Leaderboard routes mounted at ${API_PREFIX}/leaderboard`);
} else {
  console.log('❌ Leaderboard routes not available');
}

// Root endpoint
app.get('/', (req, res) => {
  const endpoints = {
    health: '/health'
  };

  if (authRoutes) endpoints.auth = `${API_PREFIX}/auth`;
  if (userRoutes) endpoints.users = `${API_PREFIX}/users`;
  if (categoryRoutes) endpoints.categories = `${API_PREFIX}/categories`;
  if (productRoutes) endpoints.products = `${API_PREFIX}/products`;
  if (pointRoutes) endpoints.points = `${API_PREFIX}/points`;
  if (leaderboardRoutes) endpoints.leaderboard = `${API_PREFIX}/leaderboard`; 

  endpoints.uploads = '/uploads';

  res.status(200).json({
    success: true,
    message: 'Secure Node.js Backend API',
    version: '1.0.0',
    documentation: `${req.protocol}://${req.get('host')}/docs`,
    endpoints,
    status: {
      authRoutes: !!authRoutes,
      userRoutes: !!userRoutes,
      categoryRoutes: !!categoryRoutes,
      productRoutes: !!productRoutes,
      pointRoutes: !!pointRoutes,
      leaderboardRoutes: !!leaderboardRoutes
    }
  });
});

// Error logging middleware
app.use(errorLogger);

// Handle 404 errors
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// Graceful shutdown handler
const gracefulShutdown = (signal) => {
  console.log(`Received ${signal}. Starting graceful shutdown...`);
  
  // Close server
  const server = app.get('server');
  if (server) {
    server.close(() => {
      console.log('HTTP server closed.');
      
      // Close database connection
      sequelize.close().then(() => {
        console.log('Database connection closed.');
        process.exit(0);
      }).catch((err) => {
        console.error('Error closing database connection:', err);
        process.exit(1);
      });
    });
  } else {
    process.exit(0);
  }
};

// Handle graceful shutdown
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = app;