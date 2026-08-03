const DANGEROUS_HTML_PATTERN = /<script|<iframe|javascript:|on\w+\s*=/i;

// Rejects obviously dangerous HTML/script patterns outright instead of HTML-entity-encoding the
// value (express-validator's .escape() would corrupt legitimate text for a JSON API + React
// frontend, since React text nodes don't decode HTML entities - "<3" would render as "&lt;3").
const noDangerousHtml = (value) => {
  if (typeof value === 'string' && DANGEROUS_HTML_PATTERN.test(value)) {
    throw new Error('Input contains disallowed content');
  }
  return true;
};

module.exports = { noDangerousHtml };