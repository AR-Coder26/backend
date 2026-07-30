const express = require('express');
const rateLimit = require('express-rate-limit');
const {
  register,
  login,
  logout,
  refreshAccessToken,
  getMe,
} = require('../controllers/customerAuth.controller');
const { protectCustomer } = require('../middleware/auth.middleware');
const { customerRegisterValidator, customerLoginValidator } = require('../validators/auth.validator');
const validateRequest = require('../middleware/validateRequest');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Please try again later.' },
});

router.post('/register', authLimiter, customerRegisterValidator, validateRequest, register);
router.post('/login', authLimiter, customerLoginValidator, validateRequest, login);
router.post('/logout', protectCustomer, logout);
router.post('/refresh', refreshAccessToken);
router.get('/me', protectCustomer, getMe);

module.exports = router;