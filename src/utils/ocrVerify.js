const Tesseract = require('tesseract.js');
const { BRAND_NAME } = require('./branding');

// Strips spaces/hyphens/underscores and lowercases before comparing - screenshots have imperfect
// OCR due to chat-bubble backgrounds and fonts, so exact character matching would reject too
// many genuine screenshots (e.g. OCR reading a hyphen as a space).
const normalizeForMatch = (text) => text.toLowerCase().replace(/[\s\-_]+/g, '');

// Verifies a WhatsApp confirmation screenshot contains BOTH the exact order number AND the
// branding line - checking only one or the other would let a screenshot of a DIFFERENT order,
// or a message with the branding stripped out, pass verification.
const verifyConfirmationScreenshot = async (imageBuffer, orderNumber) => {
  const { data } = await Tesseract.recognize(imageBuffer, 'eng');
  const extractedText = data.text || '';

  const normalizedExtracted = normalizeForMatch(extractedText);
  const hasOrderNumber = normalizedExtracted.includes(normalizeForMatch(orderNumber));
  const hasBranding = normalizedExtracted.includes(normalizeForMatch(BRAND_NAME));

  return {
    verified: hasOrderNumber && hasBranding,
    hasOrderNumber,
    hasBranding,
    rawText: extractedText, // returned so a failed attempt can be inspected/debugged if needed
  };
};

module.exports = { verifyConfirmationScreenshot };