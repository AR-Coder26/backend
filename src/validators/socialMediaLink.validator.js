const { body, param } = require('express-validator');
const { noDangerousHtml } = require('./sharedValidators');
const SocialMediaLink = require('../models/SocialMediaLink.model');

const createSocialMediaLinkValidator = [
  body('platformName')
    .trim()
    .notEmpty()
    .withMessage('Platform name is required')
    .isLength({ max: 40 })
    .withMessage('Platform name cannot exceed 40 characters')
    .custom(noDangerousHtml),
  body('iconName')
    .trim()
    .notEmpty()
    .withMessage('An icon is required')
    .isIn(SocialMediaLink.SUPPORTED_ICONS)
    .withMessage('Unsupported icon - choose one of the standard platform icons'),
  body('targetUrl')
    .trim()
    .notEmpty()
    .withMessage('Target URL is required')
    .isURL({ require_protocol: true, protocols: ['http', 'https'] })
    .withMessage('Target URL must be a full http(s) URL'),
  body('isActive').optional().isBoolean().withMessage('isActive must be true or false'),
  body('displayOrder').optional().isInt().withMessage('Display order must be a number'),
];

const updateSocialMediaLinkValidator = [
  param('id').isMongoId().withMessage('Invalid social media link ID'),
  body('platformName')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Platform name cannot be empty')
    .isLength({ max: 40 })
    .withMessage('Platform name cannot exceed 40 characters')
    .custom(noDangerousHtml),
  body('iconName')
    .optional()
    .trim()
    .isIn(SocialMediaLink.SUPPORTED_ICONS)
    .withMessage('Unsupported icon - choose one of the standard platform icons'),
  body('targetUrl')
    .optional()
    .trim()
    .isURL({ require_protocol: true, protocols: ['http', 'https'] })
    .withMessage('Target URL must be a full http(s) URL'),
  body('isActive').optional().isBoolean().withMessage('isActive must be true or false'),
  body('displayOrder').optional().isInt().withMessage('Display order must be a number'),
  // Explicit signal to clear a custom-uploaded logo and revert to the standard iconName SVG -
  // see updateSocialMediaLink's handling of this flag in the controller.
  body('removeLogo').optional().isBoolean().withMessage('removeLogo must be true or false'),
];

const socialMediaLinkIdValidator = [param('id').isMongoId().withMessage('Invalid social media link ID')];

// Bulk reorder payload: [{ id, displayOrder }, ...] - one request per full drag-and-drop
// reorder action instead of N separate PATCH calls. See reorderSocialMediaLinks.
const reorderSocialMediaLinksValidator = [
  body('order').isArray({ min: 1 }).withMessage('order must be a non-empty array'),
  body('order.*.id').isMongoId().withMessage('Each order entry needs a valid id'),
  body('order.*.displayOrder').isInt().withMessage('Each order entry needs a numeric displayOrder'),
];

module.exports = {
  createSocialMediaLinkValidator,
  updateSocialMediaLinkValidator,
  socialMediaLinkIdValidator,
  reorderSocialMediaLinksValidator,
};