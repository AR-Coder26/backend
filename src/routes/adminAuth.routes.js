const express = require('express');
const rateLimit = require('express-rate-limit');
const { login, logout, refreshAccessToken, getMe, changePassword } = require('../controllers/adminAuth.controller');
const { protectAdmin } = require('../middleware/auth.middleware');
const { adminLoginValidator, adminChangePasswordValidator } = require('../validators/auth.validator');
const validateRequest = require('../middleware/validateRequest');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts. Please try again later.' },
});

const changePasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Please try again later.' },
});

router.post('/login', loginLimiter, adminLoginValidator, validateRequest, login);
router.post('/logout', protectAdmin, logout);
router.post('/refresh', refreshAccessToken);
router.get('/me', protectAdmin, getMe);
router.patch('/change-password', protectAdmin, changePasswordLimiter, adminChangePasswordValidator, validateRequest, changePassword);

module.exports = router;