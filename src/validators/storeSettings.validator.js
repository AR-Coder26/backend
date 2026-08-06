const { body } = require('express-validator');
const { noDangerousHtml } = require('./sharedValidators');

const paymentAccountFieldRules = (prefix) => [
  body(`${prefix}.accountTitle`).optional({ checkFalsy: true }).trim().isLength({ max: 100 }).custom(noDangerousHtml),
  body(`${prefix}.accountNumber`).optional({ checkFalsy: true }).trim().isLength({ max: 30 }).custom(noDangerousHtml),
  body(`${prefix}.instructions`).optional({ checkFalsy: true }).trim().isLength({ max: 500 }).custom(noDangerousHtml),
  body(`${prefix}.isActive`).optional().isBoolean(),
];

const updateStoreSettingsValidator = [...paymentAccountFieldRules('jazzCash'), ...paymentAccountFieldRules('easyPaisa')];

module.exports = { updateStoreSettingsValidator };