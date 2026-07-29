const crypto = require('crypto');

/**
 * Generates a unique SKU from product slug + color + size + random suffix.
 * Format: LAWNKAMIZ-RED-M-A1B2C3
 */
const generateSku = ({ productSlug, color, size }) => {
  const cleanSlugPart = productSlug.slice(0, 15).toUpperCase().replace(/-/g, '');
  const cleanColor = color.slice(0, 6).toUpperCase().replace(/[^A-Z0-9]/g, '');
  const cleanSize = size.toUpperCase();
  const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();

  return `${cleanSlugPart}-${cleanColor}-${cleanSize}-${randomSuffix}`;
};

module.exports = generateSku;