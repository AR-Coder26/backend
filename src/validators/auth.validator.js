// backend/src/validators/auth.validator.js
const { body } = require('express-validator');
const { noDangerousHtml } = require('./sharedValidators');

const adminLoginValidator = [
  body('email').trim().notEmpty().withMessage('Email is required').isEmail().withMessage('Provide a valid email'),
  body('password').notEmpty().withMessage('Password is required'),
];

const adminChangePasswordValidator = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
];

const honeypotFieldValidator = body('honeypot').optional({ checkFalsy: true }).isString().withMessage('Invalid request');

const adminForgotPasswordValidator = [
  body('email').trim().notEmpty().withMessage('Email is required').isEmail().withMessage('Provide a valid email'),
  honeypotFieldValidator,
];

const adminVerifyOtpValidator = [
  body('email').trim().notEmpty().withMessage('Email is required').isEmail().withMessage('Provide a valid email'),
  body('otp')
    .trim()
    .notEmpty()
    .withMessage('Verification code is required')
    .isLength({ min: 6, max: 6 })
    .withMessage('Verification code must be 6 digits')
    .isNumeric()
    .withMessage('Verification code must contain only digits'),
  honeypotFieldValidator,
];

const adminResetPasswordWithOtpValidator = [
  body('email').trim().notEmpty().withMessage('Email is required').isEmail().withMessage('Provide a valid email'),
  body('resetToken')
    .trim()
    .notEmpty()
    .withMessage('Reset token is required')
    .isLength({ min: 64, max: 64 })
    .withMessage('Invalid reset token')
    .isHexadecimal()
    .withMessage('Invalid reset token'),
  body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
  honeypotFieldValidator,
];

const customerRegisterValidator = [
  body('name').trim().notEmpty().withMessage('Name is required').custom(noDangerousHtml),
  body('email').optional({ checkFalsy: true }).isEmail().withMessage('Provide a valid email'),
  body('phone')
    .optional({ checkFalsy: true })
    .matches(/^(\+92|0)3\d{9}$/)
    .withMessage('Provide a valid Pakistani phone number'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body().custom((value, { req }) => {
    if (!req.body.email && !req.body.phone) {
      throw new Error('Either an email or a phone number is required');
    }
    return true;
  }),
];

const customerLoginValidator = [
  body('identifier').trim().notEmpty().withMessage('Email or phone number is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

module.exports = {
  adminLoginValidator,
  adminChangePasswordValidator,
  adminForgotPasswordValidator,
  adminVerifyOtpValidator,
  adminResetPasswordWithOtpValidator,
  customerRegisterValidator,
  customerLoginValidator,
};