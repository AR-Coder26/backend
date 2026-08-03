const { body, param } = require('express-validator');
const { noDangerousHtml } = require('./sharedValidators');

const FABRIC_TYPES = ['Lawn', 'Cotton', 'Khaddar', 'Chiffon', 'Silk', 'Georgette', 'Linen', 'Other'];
const SIZES = ['S', 'M', 'L', 'XL'];
const FABRIC_STATUS = ['stitched', 'unstitched'];

const validateVariantsPayload = (value) => {
  let parsed;
  try {
    parsed = typeof value === 'string' ? JSON.parse(value) : value;
  } catch (err) {
    throw new Error('Variants must be valid JSON');
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('At least one variant is required');
  }

  for (const v of parsed) {
    if (!v.color || !v.size || !v.fabricStatus || v.price === undefined || v.stock === undefined) {
      throw new Error('Each variant needs color, size, fabricStatus, price, and stock');
    }
    noDangerousHtml(v.color);
    if (!SIZES.includes(v.size)) {
      throw new Error(`Invalid variant size: ${v.size}`);
    }
    if (!FABRIC_STATUS.includes(v.fabricStatus)) {
      throw new Error(`Invalid variant fabricStatus: ${v.fabricStatus}`);
    }
    if (Number(v.price) < 0 || Number(v.stock) < 0) {
      throw new Error('Variant price and stock cannot be negative');
    }
  }

  return true;
};

const createProductValidator = [
  body('name').trim().notEmpty().withMessage('Product name is required').isLength({ max: 150 }).custom(noDangerousHtml),
  body('description').trim().notEmpty().withMessage('Description is required').custom(noDangerousHtml),
  body('category').notEmpty().withMessage('Category is required').isMongoId().withMessage('Invalid category ID'),
  body('brand').notEmpty().withMessage('Brand is required').isMongoId().withMessage('Invalid brand ID'),
  body('fabricType')
    .notEmpty()
    .withMessage('Fabric type is required')
    .isIn(FABRIC_TYPES)
    .withMessage('Invalid fabric type'),
  body('pieceCount')
    .notEmpty()
    .withMessage('Piece count is required')
    .isIn(['1', '2', '3'])
    .withMessage('Piece count must be 1, 2, or 3'),
  body('discountPercentage').optional().isFloat({ min: 0, max: 100 }).withMessage('Discount must be between 0 and 100'),
  body('variants').custom(validateVariantsPayload),
];

const updateProductValidator = [
  param('id').isMongoId().withMessage('Invalid product ID'),
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Product name cannot be empty')
    .isLength({ max: 150 })
    .custom(noDangerousHtml),
  body('description').optional().trim().notEmpty().withMessage('Description cannot be empty').custom(noDangerousHtml),
  body('category').optional().isMongoId().withMessage('Invalid category ID'),
  body('brand').optional().isMongoId().withMessage('Invalid brand ID'),
  body('fabricType').optional().isIn(FABRIC_TYPES).withMessage('Invalid fabric type'),
  body('pieceCount').optional().isIn([1, 2, 3, '1', '2', '3']).withMessage('Piece count must be 1, 2, or 3'),
  body('discountPercentage').optional().isFloat({ min: 0, max: 100 }),
  body('isActive').optional().isBoolean(),
  body('variants').optional().custom(validateVariantsPayload),
];

const productIdValidator = [param('id').isMongoId().withMessage('Invalid product ID')];

const variantImageParamsValidator = [
  param('id').isMongoId().withMessage('Invalid product ID'),
  param('variantId').isMongoId().withMessage('Invalid variant ID'),
];

module.exports = {
  createProductValidator,
  updateProductValidator,
  productIdValidator,
  variantImageParamsValidator,
};