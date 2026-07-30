const express = require('express');
const {
  getAllBrandsAdmin,
  getBrandByIdAdmin,
  createBrand,
  updateBrand,
  deleteBrand,
} = require('../controllers/brand.controller');
const { protectAdmin } = require('../middleware/auth.middleware');
const validateRequest = require('../middleware/validateRequest');
const upload = require('../middleware/upload.middleware');
const { createBrandValidator, updateBrandValidator, brandIdValidator } = require('../validators/brand.validator');

const router = express.Router();

router.use(protectAdmin);

router.get('/', getAllBrandsAdmin);
router.get('/:id', brandIdValidator, validateRequest, getBrandByIdAdmin);
router.post('/', upload.single('logo'), createBrandValidator, validateRequest, createBrand);
router.put('/:id', upload.single('logo'), updateBrandValidator, validateRequest, updateBrand);
router.delete('/:id', brandIdValidator, validateRequest, deleteBrand);

module.exports = router;