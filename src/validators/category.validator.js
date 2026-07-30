const { body, param } = require('express-validator');

const createCategoryValidator = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Category name is required')
    .isLength({ max: 60 })
    .withMessage('Category name cannot exceed 60 characters'),
  body('description')
    .optional({ checkFalsy: true })
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),
  body('displayOrder').optional().isInt().withMessage('Display order must be a number'),
];

const updateCategoryValidator = [
  param('id').isMongoId().withMessage('Invalid category ID'),
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Category name cannot be empty')
    .isLength({ max: 60 })
    .withMessage('Category name cannot exceed 60 characters'),
  body('description').optional({ checkFalsy: true }).isLength({ max: 500 }),
  body('displayOrder').optional().isInt(),
  body('isActive').optional().isBoolean(),
];

const categoryIdValidator = [param('id').isMongoId().withMessage('Invalid category ID')];

module.exports = { createCategoryValidator, updateCategoryValidator, categoryIdValidator };