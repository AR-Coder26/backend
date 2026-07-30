const { body, param } = require('express-validator');

const createBrandValidator = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Brand name is required')
    .isLength({ max: 60 })
    .withMessage('Brand name cannot exceed 60 characters'),
];

const updateBrandValidator = [
  param('id').isMongoId().withMessage('Invalid brand ID'),
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Brand name cannot be empty')
    .isLength({ max: 60 })
    .withMessage('Brand name cannot exceed 60 characters'),
  body('isActive').optional().isBoolean(),
];

const brandIdValidator = [param('id').isMongoId().withMessage('Invalid brand ID')];

module.exports = { createBrandValidator, updateBrandValidator, brandIdValidator };