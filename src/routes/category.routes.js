const express = require('express');
const { getPublicCategories, getPublicCategoryBySlug } = require('../controllers/category.controller');

const router = express.Router();

router.get('/', getPublicCategories);
router.get('/:slug', getPublicCategoryBySlug);

module.exports = router;