const express = require('express');
const { getAdminStoreSettings, updateStoreSettings } = require('../controllers/storeSettings.controller');
const { protectAdmin } = require('../middleware/auth.middleware');
const validateRequest = require('../middleware/validateRequest');
const { updateStoreSettingsValidator } = require('../validators/storeSettings.validator');

const router = express.Router();

router.use(protectAdmin);

router.get('/', getAdminStoreSettings);
router.patch('/', updateStoreSettingsValidator, validateRequest, updateStoreSettings);

module.exports = router;