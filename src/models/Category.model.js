const mongoose = require('mongoose');
const generateSlug = require('../utils/generateSlug');

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
      unique: true,
      maxlength: [60, 'Category name cannot exceed 60 characters'],
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
      default: '',
    },
    image: {
      url: { type: String, default: null },
      publicId: { type: String, default: null }, // Cloudinary public_id, needed to delete/replace image later
    },
    isActive: {
      type: Boolean,
      default: true, // admin can hide a category without deleting it
    },
    displayOrder: {
      type: Number,
      default: 0, // controls homepage/menu ordering — lower number shows first
    },
  },
  { timestamps: true }
);

// Auto-generate slug from name whenever name changes
categorySchema.pre('save', function (next) {
  if (this.isModified('name')) {
    this.slug = generateSlug(this.name);
  }
  next();
});

categorySchema.index({ isActive: 1, displayOrder: 1 });

module.exports = mongoose.model('Category', categorySchema);

