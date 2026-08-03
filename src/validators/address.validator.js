const { body, param } = require('express-validator');
const { noDangerousHtml } = require('./sharedValidators');

const addAddressValidator = [
  body('label').optional({ checkFalsy: true }).trim().isLength({ max: 30 }).custom(noDangerousHtml),
  body('addressLine')
    .trim()
    .notEmpty()
    .withMessage('Address is required')
    .isLength({ max: 200 })
    .custom(noDangerousHtml),
  body('city').trim().notEmpty().withMessage('City is required').isLength({ max: 50 }).custom(noDangerousHtml),
  body('postalCode').optional({ checkFalsy: true }).trim().isLength({ max: 10 }),
  body('isDefault').optional().isBoolean(),
];

const updateAddressValidator = [
  param('addressId').isMongoId().withMessage('Invalid address ID'),
  body('label').optional({ checkFalsy: true }).trim().isLength({ max: 30 }).custom(noDangerousHtml),
  body('addressLine').optional().trim().notEmpty().isLength({ max: 200 }).custom(noDangerousHtml),
  body('city').optional().trim().notEmpty().isLength({ max: 50 }).custom(noDangerousHtml),
  body('postalCode').optional({ checkFalsy: true }).trim().isLength({ max: 10 }),
  body('isDefault').optional().isBoolean(),
];

const addressIdValidator = [param('addressId').isMongoId().withMessage('Invalid address ID')];

module.exports = { addAddressValidator, updateAddressValidator, addressIdValidator };