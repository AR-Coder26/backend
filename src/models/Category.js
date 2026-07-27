const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    // TODO: Add fields — name, slug, description, image, parent, isActive, etc.
  },
  { timestamps: true }
);

module.exports = mongoose.model('Category', categorySchema);

