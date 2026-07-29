const generateSlug = (text) => {
  return text
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')       // remove special characters
    .replace(/[\s_]+/g, '-')         // spaces/underscores -> hyphen
    .replace(/-+/g, '-')             // collapse multiple hyphens
    .replace(/^-+|-+$/g, '');        // trim leading/trailing hyphens
};

module.exports = generateSlug;