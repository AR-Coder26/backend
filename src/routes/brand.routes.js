const express = require('express');
const { getPublicBrands, getPublicBrandBySlug } = require('../controllers/brand.controller');

const router = express.Router();

router.get('/', getPublicBrands);
router.get('/:slug', getPublicBrandBySlug);

module.exports = router;