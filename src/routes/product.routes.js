const express = require('express');
const { getPublicProducts, getPublicProductBySlug } = require('../controllers/product.controller');

const router = express.Router();

router.get('/', getPublicProducts);
router.get('/:slug', getPublicProductBySlug);

module.exports = router;