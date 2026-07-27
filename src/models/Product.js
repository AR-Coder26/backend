const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    // TODO: Add fields — name, slug, description, price, comparePrice, images, category, brand,
    //       sizes, colors, stock, isFeatured, isActive, ratings, numReviews, tags, etc.
  },
  { timestamps: true }
);

module.exports = mongoose.model('Product', productSchema);

