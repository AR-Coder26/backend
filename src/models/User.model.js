const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please provide a valid email address",
      ],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must be at least 8 characters"],
      select: false, // never comes back in a normal query — must explicitly request with .select('+password')
    },
    role: {
      type: String,
      enum: ["admin", "staff"],
      default: "admin", // 'staff' reserved for future if you ever hire help to manage products
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

    // ---- Forgot-password / OTP defense state (never returned by default queries) ----
    // HMAC-SHA256 hash of the current 6-digit OTP - never the plain code.
    passwordResetOtpHash: {
      type: String,
      default: null,
      select: false,
    },
    // Strict 5-minute validity window for the OTP above.
    passwordResetOtpExpiresAt: {
      type: Date,
      default: null,
      select: false,
    },
    // Failed verification attempts against the current OTP. Reset to 0 whenever a fresh OTP is
    // issued, and whenever it hits OTP_MAX_ATTEMPTS the account is locked and this resets to 0.
    passwordResetOtpAttempts: {
      type: Number,
      default: 0,
      select: false,
    },
    // Set once the attempt cap is hit; blocks BOTH new OTP requests and OTP verification until
    // this timestamp passes. null/undefined means "not locked".
    passwordResetLockUntil: {
      type: Date,
      default: null,
      select: false,
    },
    // Timestamp of the last OTP that was actually issued - used as a short resend cooldown so an
    // attacker (or a fat thumb) can't spam /forgot-password to keep resetting the attempt counter.
    passwordResetLastRequestedAt: {
      type: Date,
      default: null,
      select: false,
    },
    // bcrypt hash of the opaque, single-use token issued after a CORRECT OTP verification. The
    // raw token is only ever handed to the client once, in the verify-otp response - mirrors how
    // refreshTokenHash is handled: if the DB leaks, no usable secret leaks with it.
    passwordResetTokenHash: {
      type: String,
      default: null,
      select: false,
    },
    // Short (10-minute) validity window for the reset token above.
    passwordResetTokenExpiresAt: {
      type: Date,
      default: null,
      select: false,
    },
  },
  { timestamps: true },
);

// Hash the password before saving — only runs if password field actually changed
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
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
    { expiresIn: process.env.JWT_ACCESS_EXPIRY || "15m" },
  );
};

// Long-lived token used only to silently reissue a new access token when it expires
userSchema.methods.generateRefreshToken = function () {
  return jwt.sign({ id: this._id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRY || "7d",
  });
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

// ---- Forgot-password / OTP defense methods ----

// True while the account is inside its post-lockout cooldown window.
userSchema.methods.isPasswordResetLocked = function () {
  return Boolean(
    this.passwordResetLockUntil && this.passwordResetLockUntil > new Date(),
  );
};

// Issues a brand-new OTP challenge: stores its hash + expiry, resets the attempt counter, stamps
// the resend-cooldown timestamp, and clears any stale lock (a fresh, un-locked account should
// never carry a lock forward). Single write.
userSchema.methods.setPasswordResetOtp = async function (otpHash, expiresAt) {
  this.passwordResetOtpHash = otpHash;
  this.passwordResetOtpExpiresAt = expiresAt;
  this.passwordResetOtpAttempts = 0;
  this.passwordResetLastRequestedAt = new Date();
  this.passwordResetLockUntil = null;
  await this.save({ validateBeforeSave: false });
};

// Records one failed OTP guess. If this attempt reaches maxAttempts, locks the account for
// lockDurationMs AND invalidates the OTP immediately (so it can't keep being guessed against
// during the lock). Returns true if this call triggered the lockout, false otherwise.
userSchema.methods.registerFailedOtpAttempt = async function (
  maxAttempts,
  lockDurationMs,
) {
  this.passwordResetOtpAttempts += 1;
  let lockedOut = false;

  if (this.passwordResetOtpAttempts >= maxAttempts) {
    this.passwordResetLockUntil = new Date(Date.now() + lockDurationMs);
    this.passwordResetOtpHash = null;
    this.passwordResetOtpExpiresAt = null;
    this.passwordResetOtpAttempts = 0;
    lockedOut = true;
  }

  await this.save({ validateBeforeSave: false });
  return lockedOut;
};

// Called on a CORRECT OTP: the OTP is single-use, so it's cleared here, and in the same write we
// issue the short-lived reset token that the client will present to /reset-password next.
userSchema.methods.completeOtpVerification = async function (
  resetTokenHash,
  resetTokenExpiresAt,
) {
  this.passwordResetOtpHash = null;
  this.passwordResetOtpExpiresAt = null;
  this.passwordResetOtpAttempts = 0;
  this.passwordResetTokenHash = resetTokenHash;
  this.passwordResetTokenExpiresAt = resetTokenExpiresAt;
  await this.save({ validateBeforeSave: false });
};

// Compares a candidate raw reset token against the stored bcrypt hash, honoring its own expiry.
userSchema.methods.compareResetToken = async function (candidateToken) {
  if (!this.passwordResetTokenHash || !this.passwordResetTokenExpiresAt)
    return false;
  if (this.passwordResetTokenExpiresAt < new Date()) return false;
  return bcrypt.compare(candidateToken, this.passwordResetTokenHash);
};

module.exports = mongoose.model("User", userSchema);
