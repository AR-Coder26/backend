const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const normalizePakistaniPhone = (phone) => {
  if (!phone) return phone;
  const trimmed = phone.trim();
  if (trimmed.startsWith('+92')) return trimmed;
  if (trimmed.startsWith('0')) return `+92${trimmed.slice(1)}`;
  return trimmed;
};

const addressSchema = new mongoose.Schema(
  {
    label: { type: String, trim: true, default: 'Home' }, // e.g. "Home", "Office"
    addressLine: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    postalCode: { type: String, trim: true, default: null },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const customerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      unique: true,
      sparse: true, // allows many documents to have email: null without violating uniqueness
      lowercase: true,
      trim: true,
      default: null,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email address'],
    },
    phone: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      default: null,
      match: [/^\+923\d{9}$/, 'Please provide a valid Pakistani phone number'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,
    },
    addresses: {
      type: [addressSchema],
      default: [], // saved addresses for faster reorder - the whole point of having accounts
    },
    refreshTokenHash: {
      type: String,
      default: null,
      select: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Normalize phone format and enforce "at least one of email/phone" before validation runs
customerSchema.pre('validate', function (next) {
  if (this.phone) {
    this.phone = normalizePakistaniPhone(this.phone);
  }
  if (!this.email && !this.phone) {
    this.invalidate('email', 'Either an email or a phone number is required to create an account');
  }
  next();
});

customerSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

customerSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Uses a SEPARATE secret from the Admin User model - a leaked customer token
// must never be replayable against the admin panel
customerSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    { id: this._id, type: 'customer' },
    process.env.CUSTOMER_JWT_ACCESS_SECRET,
    { expiresIn: process.env.CUSTOMER_JWT_ACCESS_EXPIRY || '15m' }
  );
};

customerSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    { id: this._id, type: 'customer' },
    process.env.CUSTOMER_JWT_REFRESH_SECRET,
    { expiresIn: process.env.CUSTOMER_JWT_REFRESH_EXPIRY || '30d' } // customers stay logged in longer than admin
  );
};

customerSchema.methods.setRefreshTokenHash = async function (refreshToken) {
  const salt = await bcrypt.genSalt(10);
  this.refreshTokenHash = await bcrypt.hash(refreshToken, salt);
  await this.save({ validateBeforeSave: false });
};

customerSchema.methods.compareRefreshToken = async function (candidateToken) {
  if (!this.refreshTokenHash) return false;
  return bcrypt.compare(candidateToken, this.refreshTokenHash);
};

// Convenience lookup used by the login controller (Phase 3) - finds a customer by whichever
// identifier (email or phone) they typed in, without the controller needing to know which one it is
customerSchema.statics.findByIdentifier = function (identifier) {
  const isEmail = identifier.includes('@');
  const query = isEmail
    ? { email: identifier.toLowerCase().trim() }
    : { phone: normalizePakistaniPhone(identifier) };
  return this.findOne(query).select('+password');
};

customerSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Customer', customerSchema);