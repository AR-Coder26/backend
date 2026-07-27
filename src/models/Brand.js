const mongoose = require('mongoose');

const brandSchema = new mongoose.Schema(
  {
    // TODO: Add fields — name, slug, description, logo, isActive, etc.
  },
  { timestamps: true }
);

module.exports = mongoose.model('Brand', brandSchema);

