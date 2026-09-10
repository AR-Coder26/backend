const express = require('express');
const rateLimit = require('express-rate-limit');
const {
  login,
  logout,
  refreshAccessToken,
  getMe,
  changePassword,
  forgotPassword,
  verifyOtp,
  resetPasswordWithOtp,
} = require('../controllers/adminAuth.controller');
const { protectAdmin } = require('../middleware/auth.middleware');
const honeypotCheck = require('../middleware/honeypot.middleware');
const {
  adminLoginValidator,
  adminChangePasswordValidator,
  adminForgotPasswordValidator,
  adminVerifyOtpValidator,
  adminResetPasswordWithOtpValidator,
} = require('../validators/auth.validator');
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

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many password reset requests. Please try again later.' },
});

const verifyOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many verification attempts. Please try again later.' },
});

const resetPasswordLimiter = rateLimit({
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

router.post(
  '/forgot-password',
  forgotPasswordLimiter,
  honeypotCheck,
  adminForgotPasswordValidator,
  validateRequest,
  forgotPassword
);
router.post('/verify-otp', verifyOtpLimiter, honeypotCheck, adminVerifyOtpValidator, validateRequest, verifyOtp);
router.post(
  '/reset-password',
  resetPasswordLimiter,
  honeypotCheck,
  adminResetPasswordWithOtpValidator,
  validateRequest,
  resetPasswordWithOtp
);

module.exports = router;