const express = require('express');
const {
  getAllCategoriesAdmin,
  getCategoryByIdAdmin,
  createCategory,
  updateCategory,
  deleteCategory,
} = require('../controllers/category.controller');
const { protectAdmin } = require('../middleware/auth.middleware');
const validateRequest = require('../middleware/validateRequest');
const upload = require('../middleware/upload.middleware');
const {
  createCategoryValidator,
  updateCategoryValidator,
  categoryIdValidator,
} = require('../validators/category.validator');

const router = express.Router();

// Every route below requires a logged-in admin - applied once here instead of repeating per route
router.use(protectAdmin);

router.get('/', getAllCategoriesAdmin);
router.get('/:id', categoryIdValidator, validateRequest, getCategoryByIdAdmin);
router.post('/', upload.single('image'), createCategoryValidator, validateRequest, createCategory);
router.put('/:id', upload.single('image'), updateCategoryValidator, validateRequest, updateCategory);
router.delete('/:id', categoryIdValidator, validateRequest, deleteCategory);

module.exports = router;