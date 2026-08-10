const { body } = require('express-validator');
const { noDangerousHtml } = require('./sharedValidators');
const IBAN_REGEX = /^$|^PK\d{2}[A-Z]{4}\d{16}$/i;

const paymentAccountFieldRules = (prefix) => [
  body(`${prefix}.accountTitle`).optional({ checkFalsy: true }).trim().isLength({ max: 100 }).custom(noDangerousHtml),
  body(`${prefix}.accountNumber`).optional({ checkFalsy: true }).trim().isLength({ max: 30 }).custom(noDangerousHtml),
  body(`${prefix}.instructions`).optional({ checkFalsy: true }).trim().isLength({ max: 500 }).custom(noDangerousHtml),
  body(`${prefix}.isActive`).optional().isBoolean(),
];

const bankTransferFieldRules = [
  body('bankTransfer.bankName').optional({ checkFalsy: true }).trim().isLength({ max: 100 }).custom(noDangerousHtml),
  body('bankTransfer.accountTitle').optional({ checkFalsy: true }).trim().isLength({ max: 100 }).custom(noDangerousHtml),
  body('bankTransfer.accountNumber').optional({ checkFalsy: true }).trim().isLength({ max: 30 }).custom(noDangerousHtml),
  body('bankTransfer.iban')
    .optional({ checkFalsy: true })
    .trim()
    .matches(IBAN_REGEX)
    .withMessage('IBAN must be a valid Pakistani IBAN (e.g. PK36MEZN0001234567890123)'),
  body('bankTransfer.instructions').optional({ checkFalsy: true }).trim().isLength({ max: 500 }).custom(noDangerousHtml),
  body('bankTransfer.isActive').optional().isBoolean(),
];

const updateStoreSettingsValidator = [
  ...paymentAccountFieldRules('jazzCash'),
  ...paymentAccountFieldRules('easyPaisa'),
  ...bankTransferFieldRules,
  body('minOrderValue').optional().isFloat({ min: 0 }).withMessage('Minimum order value cannot be negative'),
  body('deliveryFlatRateNonKarachi')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Delivery charge cannot be negative'),
];

module.exports = { updateStoreSettingsValidator };