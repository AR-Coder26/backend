const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');

const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');
const adminAuthRoutes = require('./routes/adminAuth.routes');
const customerAuthRoutes = require('./routes/customerAuth.routes');
const categoryRoutes = require('./routes/category.routes');
const categoryAdminRoutes = require('./routes/categoryAdmin.routes');
const brandRoutes = require('./routes/brand.routes');
const brandAdminRoutes = require('./routes/brandAdmin.routes');
const productRoutes = require('./routes/product.routes');
const productAdminRoutes = require('./routes/productAdmin.routes');
const orderRoutes = require('./routes/order.routes');
const customerOrderRoutes = require('./routes/customerOrder.routes');
const orderAdminRoutes = require('./routes/orderAdmin.routes');
const customerAddressRoutes = require('./routes/customerAddress.routes');
const storeSettingsRoutes = require('./routes/storeSettings.routes');
const storeSettingsAdminRoutes = require('./routes/storeSettingsAdmin.routes');
const socialMediaLinkRoutes = require('./routes/socialMediaLink.routes');
const socialMediaLinkAdminRoutes = require('./routes/socialMediaLinkAdmin.routes');
const { connectDB } = require('./config/db');

const app = express();

// Trust reverse proxy (Nginx/Vercel/Render) so req.ip and secure cookies work correctly behind it
app.set('trust proxy', 1);
// Secure HTTP headers
app.use(helmet());
// CORS - only the configured frontend origin can call this API, with cookies allowed
const allowedOrigins = (process.env.CLIENT_URL || '')
  .split(',')
  .map((url) => url.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // No Origin header at all = server-to-server call, curl, Postman, health-check pings, etc.
      // These never carry cookies anyway, so they're safe to allow through.
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.warn(`CORS blocked request from unlisted origin: ${origin}`);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);

// Body parsers (10kb limit blocks oversized payload abuse)
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

// Gzip compression - important on slow mobile connections
app.use(compression());

// Strip Mongo operators ($gt, $where, etc.) from body/query/params to block NoSQL injection
app.use(mongoSanitize());

// Block HTTP Parameter Pollution (?price=100&price=1)
app.use(hpp());

// Dev-only request logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Global rate limiter on all /api routes
const limiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
});
app.use('/api', limiter);

// Health check - use this to verify the server is alive
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API is healthy',
    timestamp: new Date().toISOString(),
  });
});

app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    next(error);
  }
});

// Feature routes (auth, products, categories, brands, orders) get mounted here starting
app.use('/api/admin/auth', adminAuthRoutes);
app.use('/api/auth', customerAuthRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/admin/categories', categoryAdminRoutes);
app.use('/api/brands', brandRoutes);
app.use('/api/admin/brands', brandAdminRoutes);
app.use('/api/products', productRoutes);
app.use('/api/admin/products', productAdminRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/my-orders', customerOrderRoutes);
app.use('/api/admin/orders', orderAdminRoutes);
app.use('/api/my-addresses', customerAddressRoutes);
app.use('/api/store-settings', storeSettingsRoutes);
app.use('/api/admin/store-settings', storeSettingsAdminRoutes);
app.use('/api/social-links', socialMediaLinkRoutes);
app.use('/api/admin/social-links', socialMediaLinkAdminRoutes);

// Unmatched routes → 404
app.use(notFound);

// Centralized error handler - must be the last middleware
app.use(errorHandler);

module.exports = app;