const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email address'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // never comes back in a normal query — must explicitly request with .select('+password')
    },
    role: {
      type: String,
      enum: ['admin', 'staff'],
      default: 'admin', // 'staff' reserved for future if you ever hire help to manage products
    },
    refreshTokenHash: {
      type: String,
      default: null,
      select: false, // stores a bcrypt HASH of the current refresh token, never the raw token
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Hash the password before saving — only runs if password field actually changed
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare a plaintext login attempt against the stored hash
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Short-lived token sent with every authenticated admin-panel request
userSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    { id: this._id, role: this.role },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m' }
  );
};

// Long-lived token used only to silently reissue a new access token when it expires
userSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    { id: this._id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d' }
  );
};

// Store only a bcrypt HASH of the refresh token — if the database ever leaks, no valid session leaks with it
userSchema.methods.setRefreshTokenHash = async function (refreshToken) {
  const salt = await bcrypt.genSalt(10);
  this.refreshTokenHash = await bcrypt.hash(refreshToken, salt);
  await this.save({ validateBeforeSave: false });
};

userSchema.methods.compareRefreshToken = async function (candidateToken) {
  if (!this.refreshTokenHash) return false;
  return bcrypt.compare(candidateToken, this.refreshTokenHash);
};

module.exports = mongoose.model('User', userSchema);