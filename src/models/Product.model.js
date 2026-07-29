const mongoose = require('mongoose');
const generateSlug = require('../utils/generateSlug');
const generateSku = require('../utils/generateSku');

const FABRIC_TYPES = ['Lawn', 'Cotton', 'Khaddar', 'Chiffon', 'Silk', 'Georgette', 'Linen', 'Other'];
const SIZES = ['S', 'M', 'L', 'XL'];
const FABRIC_STATUS = ['stitched', 'unstitched'];

const imageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true }, // needed to delete/replace on Cloudinary later
  },
  { _id: false }
);

// Approved Variant Schema Matrix (client-locked structure)
const variantSchema = new mongoose.Schema({
  sku: {
    type: String,
    uppercase: true,
    trim: true,
    // uniqueness enforced by the sparse unique index on 'variants.sku' at the bottom of this file —
    // Mongoose does NOT create a real unique index from `unique: true` written inside an array subdocument
  },
  color: {
    type: String,
    required: [true, 'Variant color is required'],
    trim: true,
  },
  size: {
    type: String,
    required: [true, 'Variant size is required'],
    enum: { values: SIZES, message: '{VALUE} is not a supported size' },
  },
  fabricStatus: {
    type: String,
    required: [true, 'Variant must specify stitched or unstitched'],
    enum: { values: FABRIC_STATUS, message: '{VALUE} is not a valid fabric status' },
  },
  price: {
    type: Number,
    required: [true, 'Variant price is required'],
    min: [0, 'Price cannot be negative'],
  },
  comparePrice: {
    type: Number,
    default: null, // original price before discount — shown with strikethrough on the frontend
    validate: {
      validator: function (value) {
        return value === null || value === undefined || value >= this.price;
      },
      message: 'Compare price must be greater than or equal to the actual price',
    },
  },
  stock: {
    type: Number,
    required: [true, 'Variant stock is required'],
    min: [0, 'Stock cannot be negative'],
    default: 0,
  },
  images: {
    type: [imageSchema],
    default: [],
  },
});

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      maxlength: [150, 'Product name cannot exceed 150 characters'],
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      index: true,
    },
    description: {
      type: String,
      required: [true, 'Product description is required'],
      trim: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Product category is required'],
      index: true,
    },
    brand: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Brand',
      required: [true, 'Product brand is required'],
      index: true,
    },
    fabricType: {
      type: String,
      required: [true, 'Fabric type is required'],
      enum: { values: FABRIC_TYPES, message: '{VALUE} is not a supported fabric type' },
      index: true, // powers the "Fabric" filter (Lawn, Cotton, Chiffon, etc.)
    },
    pieceCount: {
      type: Number,
      required: [true, 'Piece count is required'],
      enum: { values: [1, 2, 3], message: '{VALUE} is not a valid piece count (must be 1, 2, or 3)' },
    },
    isCustomStitchingAvailable: {
      type: Boolean,
      default: false, // admin ticks this at upload time for products offering custom stitching
    },
    discountPercentage: {
      type: Number,
      default: 0,
      min: [0, 'Discount cannot be negative'],
      max: [100, 'Discount cannot exceed 100%'],
      index: true, // powers the dedicated "30% OFF" homepage filter
    },
    images: {
      type: [imageSchema],
      default: [], // general/cover gallery shown before a color variant is selected
    },
    variants: {
      type: [variantSchema],
      validate: {
        validator: function (arr) {
          return Array.isArray(arr) && arr.length > 0;
        },
        message: 'Product must have at least one variant',
      },
    },
    isActive: {
      type: Boolean,
      default: true, // admin toggle to hide a product without deleting it
      index: true,
    },
  },
  { timestamps: true }
);

// ---- Virtuals (computed fields, not stored in DB) ----

// Sum of stock across every variant — used to decide "Out of Stock" badge on the whole product
productSchema.virtual('totalStock').get(function () {
  return this.variants.reduce((sum, v) => sum + v.stock, 0);
});

productSchema.virtual('isOutOfStock').get(function () {
  return this.totalStock <= 0;
});

// Lowest/highest variant price — used for "Starting from Rs. X" on listing cards
productSchema.virtual('minPrice').get(function () {
  if (!this.variants.length) return 0;
  return Math.min(...this.variants.map((v) => v.price));
});

productSchema.virtual('maxPrice').get(function () {
  if (!this.variants.length) return 0;
  return Math.max(...this.variants.map((v) => v.price));
});

// Without these two lines, virtuals would NOT appear when you send product data as JSON to the frontend
productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });

// ---- Hooks ----

// Auto-generate slug from name; if two products share a name, append -1, -2, etc. to stay unique
productSchema.pre('save', async function (next) {
  if (this.isModified('name') || this.isNew) {
    const baseSlug = generateSlug(this.name);
    let slug = baseSlug;
    let counter = 1;

    const ProductModel = this.constructor;
    // eslint-disable-next-line no-await-in-loop
    while (await ProductModel.findOne({ slug, _id: { $ne: this._id } }).select('_id').lean()) {
      slug = `${baseSlug}-${counter}`;
      counter += 1;
    }
    this.slug = slug;
  }
  next();
});

// Auto-generate a SKU for any variant left blank (admin can also type a custom one)
productSchema.pre('save', function (next) {
  const baseSlug = this.slug || generateSlug(this.name);
  this.variants.forEach((variant) => {
    if (!variant.sku) {
      variant.sku = generateSku({
        productSlug: baseSlug,
        color: variant.color,
        size: variant.size,
      });
    }
  });
  next();
});

// ---- Indexes ----

productSchema.index({ name: 'text', description: 'text' }); // powers search bar
productSchema.index({ category: 1, isActive: 1, createdAt: -1 });
productSchema.index({ brand: 1, isActive: 1 });
productSchema.index({ 'variants.sku': 1 }, { unique: true, sparse: true }); // real SKU-uniqueness enforcement
productSchema.index({ 'variants.size': 1 });
productSchema.index({ 'variants.fabricStatus': 1 });

module.exports = mongoose.model('Product', productSchema);