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

const app = express();

// Trust reverse proxy (Nginx/Vercel/Render) so req.ip and secure cookies work correctly behind it
app.set('trust proxy', 1);
// Secure HTTP headers
app.use(helmet());
// CORS - only the configured frontend origin can call this API, with cookies allowed
app.use(
  cors({
    origin: process.env.CLIENT_URL,
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

// Unmatched routes → 404
app.use(notFound);

// Centralized error handler - must be the last middleware
app.use(errorHandler);

module.exports = app;