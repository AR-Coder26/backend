const express = require('express');
const {
  getAllSocialLinksAdmin,
  getSocialLinkByIdAdmin,
  createSocialMediaLink,
  updateSocialMediaLink,
  deleteSocialMediaLink,
  reorderSocialMediaLinks,
} = require('../controllers/socialMediaLink.controller');
const { protectAdmin } = require('../middleware/auth.middleware');
const validateRequest = require('../middleware/validateRequest');
const upload = require('../middleware/upload.middleware');
const {
  createSocialMediaLinkValidator,
  updateSocialMediaLinkValidator,
  socialMediaLinkIdValidator,
  reorderSocialMediaLinksValidator,
} = require('../validators/socialMediaLink.validator');

const router = express.Router();

// Every route below requires a logged-in admin - applied once here instead of repeating per route
router.use(protectAdmin);

// IMPORTANT: /reorder must be registered BEFORE the /:id routes below, otherwise Express would
// match "reorder" as an :id param on the GET/PUT/DELETE routes instead of hitting this handler.
router.patch('/reorder', reorderSocialMediaLinksValidator, validateRequest, reorderSocialMediaLinks);

router.get('/', getAllSocialLinksAdmin);
router.get('/:id', socialMediaLinkIdValidator, validateRequest, getSocialLinkByIdAdmin);
router.post('/', upload.single('logo'), createSocialMediaLinkValidator, validateRequest, createSocialMediaLink);
router.put('/:id', upload.single('logo'), updateSocialMediaLinkValidator, validateRequest, updateSocialMediaLink);
router.delete('/:id', socialMediaLinkIdValidator, validateRequest, deleteSocialMediaLink);

module.exports = router;