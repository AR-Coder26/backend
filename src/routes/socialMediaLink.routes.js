const express = require('express');
const { getPublicSocialLinks } = require('../controllers/socialMediaLink.controller');

const router = express.Router();

router.get('/', getPublicSocialLinks);

module.exports = router;