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
const { corsOptions, helmetOptions, generalLimiter } = require('./config/security');
const passport = require('./config/passport');

// Import middleware
const { requestLogger, errorLogger } = require('./utils/logger');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

// Import routes
const authRoutes = require('./routes/auth');
const categoryRoutes = require('./routes/category');
const productRoutes = require('./routes/product');
const pointRoutes = require('./routes/point');

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
  secret: process.env.SESSION_SECRET,
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

app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/categories`, categoryRoutes);
app.use(`${API_PREFIX}/products`, productRoutes);
app.use(`${API_PREFIX}/points`, pointRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Secure Node.js Backend API',
    version: '1.0.0',
    documentation: `${req.protocol}://${req.get('host')}/docs`,
    endpoints: {
      health: '/health',
      auth: `${API_PREFIX}/auth`,
      categories: `${API_PREFIX}/categories`,
      products: `${API_PREFIX}/products`,
      points: `${API_PREFIX}/points`,
      uploads: '/uploads'
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