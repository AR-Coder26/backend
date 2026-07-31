const express = require('express');
const {
  getAllProductsAdmin,
  getProductByIdAdmin,
  createProduct,
  updateProduct,
  deleteProduct,
  addProductImages,
  deleteProductImage,
  addVariantImages,
  deleteVariantImage,
} = require('../controllers/product.controller');
const { protectAdmin } = require('../middleware/auth.middleware');
const validateRequest = require('../middleware/validateRequest');
const upload = require('../middleware/upload.middleware');
const {
  createProductValidator,
  updateProductValidator,
  productIdValidator,
  variantImageParamsValidator,
} = require('../validators/product.validator');

const router = express.Router();

router.use(protectAdmin);

// ---- Core CRUD ----
router.get('/', getAllProductsAdmin);
router.get('/:id', productIdValidator, validateRequest, getProductByIdAdmin);
router.post('/', upload.array('images', 8), createProductValidator, validateRequest, createProduct);
router.put('/:id', updateProductValidator, validateRequest, updateProduct);
router.delete('/:id', productIdValidator, validateRequest, deleteProduct);

// ---- General gallery images (product-level, shown before a color is picked) ----
router.post('/:id/images', productIdValidator, validateRequest, upload.array('images', 8), addProductImages);
router.delete('/:id/images', productIdValidator, validateRequest, deleteProductImage);

// ---- Variant-specific images (per color/size combination) ----
router.post(
  '/:id/variants/:variantId/images',
  variantImageParamsValidator,
  validateRequest,
  upload.array('images', 6),
  addVariantImages
);
router.delete('/:id/variants/:variantId/images', variantImageParamsValidator, validateRequest, deleteVariantImage);

module.exports = router;