const { body } = require('express-validator');
const { noDangerousHtml } = require('./sharedValidators');

const adminLoginValidator = [
  body('email').trim().notEmpty().withMessage('Email is required').isEmail().withMessage('Provide a valid email'),
  body('password').notEmpty().withMessage('Password is required'),
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

module.exports = { adminLoginValidator, customerRegisterValidator, customerLoginValidator };