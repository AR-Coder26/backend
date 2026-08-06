const express = require('express');
const { getPublicPaymentSettings } = require('../controllers/storeSettings.controller');

const router = express.Router();

router.get('/', getPublicPaymentSettings);

module.exports = router;