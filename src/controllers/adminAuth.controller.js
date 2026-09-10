const asyncHandler = require("express-async-handler");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/User.model");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const {
  setAuthCookies,
  clearAuthCookies,
  COOKIE_NAMES,
} = require("../utils/token");
const {
  generateOtp,
  hashOtp,
  compareOtp,
  generateResetToken,
} = require("../utils/otp");
const { tarpitDelay } = require("../utils/tarpit");
const { logSecurityEvent } = require("../utils/securityLog");
const {
  sendAdminOtpEmail,
  sendAdminLockoutAlertEmail,
  sendAdminPasswordResetConfirmationEmail,
} = require("../utils/mailer");
const {
  OTP_EXPIRY_MS,
  OTP_MAX_ATTEMPTS,
  OTP_LOCK_DURATION_MS,
  OTP_RESEND_COOLDOWN_MS,
  RESET_TOKEN_EXPIRY_MS,
} = require("../config/otpPolicy");

// Deliberately generic and IDENTICAL regardless of whether the email exists, is locked, or is on
// cooldown - this is what stops the endpoint from being usable to enumerate valid admin emails.
const GENERIC_OTP_REQUEST_MESSAGE =
  "If an account with that email exists, a verification code has been sent to it.";
const GENERIC_OTP_INVALID_MESSAGE = "Invalid or expired verification code.";
const GENERIC_RESET_TOKEN_INVALID_MESSAGE = "Invalid or expired reset token.";

// POST /api/admin/auth/login
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const admin = await User.findOne({
    email: email.toLowerCase().trim(),
  }).select("+password");
  if (!admin || !admin.isActive) {
    throw ApiError.unauthorized("Invalid email or password");
  }

  const isPasswordValid = await admin.comparePassword(password);
  if (!isPasswordValid) {
    throw ApiError.unauthorized("Invalid email or password");
  }

  const accessToken = admin.generateAccessToken();
  const refreshToken = admin.generateRefreshToken();
  await admin.setRefreshTokenHash(refreshToken);

  setAuthCookies(res, {
    accessToken,
    refreshToken,
    accessCookieName: COOKIE_NAMES.admin.access,
    refreshCookieName: COOKIE_NAMES.admin.refresh,
    accessExpiry: process.env.JWT_ACCESS_EXPIRY || "15m",
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || "7d",
  });

  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        {
          id: admin._id,
          name: admin.name,
          email: admin.email,
          role: admin.role,
        },
        "Logged in successfully",
      ),
    );
});

// POST /api/admin/auth/logout
const logout = asyncHandler(async (req, res) => {
  clearAuthCookies(res, {
    accessCookieName: COOKIE_NAMES.admin.access,
    refreshCookieName: COOKIE_NAMES.admin.refresh,
  });

  if (req.admin) {
    try {
      req.admin.refreshTokenHash = null;
      await req.admin.save({ validateBeforeSave: false });
    } catch (err) {
      console.error(
        "Failed to invalidate admin refresh token on logout:",
        err.message,
      );
    }
  }

  res.status(200).json(new ApiResponse(200, null, "Logged out successfully"));
});

// POST /api/admin/auth/refresh
const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken = req.cookies?.[COOKIE_NAMES.admin.refresh];
  if (!incomingRefreshToken) {
    throw ApiError.unauthorized("Refresh token missing. Please log in again.");
  }

  let decoded;
  try {
    decoded = jwt.verify(incomingRefreshToken, process.env.JWT_REFRESH_SECRET);
  } catch (err) {
    throw ApiError.unauthorized(
      "Refresh token expired or invalid. Please log in again.",
    );
  }

  const admin = await User.findById(decoded.id).select("+refreshTokenHash");
  if (!admin || !admin.isActive) {
    throw ApiError.unauthorized("Account not found or deactivated.");
  }

  const isValidRefreshToken =
    await admin.compareRefreshToken(incomingRefreshToken);
  if (!isValidRefreshToken) {
    throw ApiError.unauthorized(
      "Refresh token no longer valid. Please log in again.",
    );
  }

  const newAccessToken = admin.generateAccessToken();
  const newRefreshToken = admin.generateRefreshToken();
  await admin.setRefreshTokenHash(newRefreshToken);

  setAuthCookies(res, {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
    accessCookieName: COOKIE_NAMES.admin.access,
    refreshCookieName: COOKIE_NAMES.admin.refresh,
    accessExpiry: process.env.JWT_ACCESS_EXPIRY || "15m",
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || "7d",
  });

  res.status(200).json(new ApiResponse(200, null, "Access token refreshed"));
});

// GET /api/admin/auth/me
const getMe = asyncHandler(async (req, res) => {
  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        {
          id: req.admin._id,
          name: req.admin.name,
          email: req.admin.email,
          role: req.admin.role,
        },
        "Admin profile fetched",
      ),
    );
});

// PATCH /api/admin/auth/change-password
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const admin = await User.findById(req.admin._id).select("+password");

  const isCurrentValid = await admin.comparePassword(currentPassword);
  if (!isCurrentValid) {
    throw ApiError.unauthorized("Current password is incorrect");
  }

  if (currentPassword === newPassword) {
    throw ApiError.badRequest(
      "New password must be different from the current password",
    );
  }

  admin.password = newPassword;
  admin.refreshTokenHash = null;
  await admin.save();

  clearAuthCookies(res, {
    accessCookieName: COOKIE_NAMES.admin.access,
    refreshCookieName: COOKIE_NAMES.admin.refresh,
  });

  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        null,
        "Password changed successfully. Please log in again.",
      ),
    );
});

// POST /api/admin/auth/forgot-password
// Body: { email, honeypot? }
const forgotPassword = asyncHandler(async (req, res) => {
  const ip = req.ip;
  const userAgent = req.get("User-Agent") || "unknown";
  const email = (req.body.email || "").toLowerCase().trim();

  // Honeypot tripped: return the EXACT same success response a legitimate request would get,
  // and do no real work. Logging already happened in honeypot.middleware.js.
  if (req.isHoneypotTriggered) {
    return res
      .status(200)
      .json(new ApiResponse(200, null, GENERIC_OTP_REQUEST_MESSAGE));
  }

  const admin = await User.findOne({ email }).select(
    "+passwordResetOtpHash +passwordResetOtpExpiresAt +passwordResetLockUntil +passwordResetLastRequestedAt",
  );

  // Unknown/inactive email: same generic message, no email sent - prevents account enumeration.
  if (!admin || !admin.isActive) {
    await logSecurityEvent({
      event: "OTP_REQUEST_UNKNOWN_EMAIL",
      email,
      ip,
      userAgent,
    });
    return res
      .status(200)
      .json(new ApiResponse(200, null, GENERIC_OTP_REQUEST_MESSAGE));
  }

  // Locked accounts cannot mint a fresh OTP - otherwise an attacker could just call
  // /forgot-password again to wipe the lock's protective effect on the OTP guessing surface.
  if (admin.isPasswordResetLocked()) {
    await logSecurityEvent({
      event: "OTP_REQUEST_BLOCKED_LOCKED",
      admin: admin._id,
      email,
      ip,
      userAgent,
    });
    return res
      .status(200)
      .json(new ApiResponse(200, null, GENERIC_OTP_REQUEST_MESSAGE));
  }

  // Resend cooldown: stops rapid re-requesting from resetting the attempt counter or flooding
  // the admin's inbox.
  const cooldownActive =
    admin.passwordResetLastRequestedAt &&
    Date.now() - admin.passwordResetLastRequestedAt.getTime() <
      OTP_RESEND_COOLDOWN_MS;

  if (cooldownActive) {
    await logSecurityEvent({
      event: "OTP_REQUEST_COOLDOWN",
      admin: admin._id,
      email,
      ip,
      userAgent,
    });
    return res
      .status(200)
      .json(new ApiResponse(200, null, GENERIC_OTP_REQUEST_MESSAGE));
  }

  const otp = generateOtp();
  const otpHash = hashOtp(otp);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

  await admin.setPasswordResetOtp(otpHash, expiresAt);
  await sendAdminOtpEmail(admin, otp);
  await logSecurityEvent({
    event: "OTP_REQUESTED",
    admin: admin._id,
    email,
    ip,
    userAgent,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, null, GENERIC_OTP_REQUEST_MESSAGE));
});

// POST /api/admin/auth/verify-otp
// Body: { email, otp, honeypot? }
const verifyOtp = asyncHandler(async (req, res) => {
  const ip = req.ip;
  const userAgent = req.get("User-Agent") || "unknown";
  const email = (req.body.email || "").toLowerCase().trim();
  const { otp } = req.body;

  if (req.isHoneypotTriggered) {
    await tarpitDelay();
    throw ApiError.unauthorized(GENERIC_OTP_INVALID_MESSAGE);
  }

  const admin = await User.findOne({ email }).select(
    "+passwordResetOtpHash +passwordResetOtpExpiresAt +passwordResetOtpAttempts +passwordResetLockUntil",
  );

  if (!admin || !admin.isActive) {
    await tarpitDelay();
    await logSecurityEvent({
      event: "OTP_VERIFY_FAILED_UNKNOWN_EMAIL",
      email,
      ip,
      userAgent,
    });
    throw ApiError.unauthorized(GENERIC_OTP_INVALID_MESSAGE);
  }

  if (admin.isPasswordResetLocked()) {
    await tarpitDelay();
    await logSecurityEvent({
      event: "OTP_VERIFY_BLOCKED_LOCKED",
      admin: admin._id,
      email,
      ip,
      userAgent,
    });
    const minutesRemaining = Math.max(
      1,
      Math.ceil((admin.passwordResetLockUntil.getTime() - Date.now()) / 60000),
    );
    throw new ApiError(
      423,
      `Account temporarily locked due to multiple failed attempts. Try again in ${minutesRemaining} minute(s).`,
    );
  }

  const hasActiveOtp =
    admin.passwordResetOtpHash &&
    admin.passwordResetOtpExpiresAt &&
    admin.passwordResetOtpExpiresAt > new Date();

  if (!hasActiveOtp) {
    await tarpitDelay();
    await logSecurityEvent({
      event: "OTP_VERIFY_FAILED_NO_ACTIVE_OTP",
      admin: admin._id,
      email,
      ip,
      userAgent,
    });
    throw ApiError.unauthorized(GENERIC_OTP_INVALID_MESSAGE);
  }

  const isValidOtp = compareOtp(otp, admin.passwordResetOtpHash);

  if (!isValidOtp) {
    const lockedOut = await admin.registerFailedOtpAttempt(
      OTP_MAX_ATTEMPTS,
      OTP_LOCK_DURATION_MS,
    );
    await tarpitDelay();

    if (lockedOut) {
      await logSecurityEvent({
        event: "OTP_LOCKOUT_TRIGGERED",
        admin: admin._id,
        email,
        ip,
        userAgent,
        meta: { maxAttempts: OTP_MAX_ATTEMPTS },
      });
      await sendAdminLockoutAlertEmail(admin, {
        ip,
        userAgent,
        at: new Date(),
      });
      const lockHours = Math.round(OTP_LOCK_DURATION_MS / 3600000);
      throw new ApiError(
        423,
        `Too many failed attempts. Your account has been locked for ${lockHours} hour(s) for security.`,
      );
    }

    const attemptsRemaining = OTP_MAX_ATTEMPTS - admin.passwordResetOtpAttempts;
    await logSecurityEvent({
      event: "OTP_VERIFY_FAILED",
      admin: admin._id,
      email,
      ip,
      userAgent,
      meta: { attemptsRemaining },
    });
    throw ApiError.unauthorized(
      `Invalid verification code. ${attemptsRemaining} attempt(s) remaining before lockout.`,
    );
  }

  // Correct OTP - single use. Clear it and issue a short-lived, single-use reset token in one write.
  const rawResetToken = generateResetToken();
  const resetTokenHash = await bcrypt.hash(rawResetToken, 10);
  await admin.completeOtpVerification(
    resetTokenHash,
    new Date(Date.now() + RESET_TOKEN_EXPIRY_MS),
  );

  await logSecurityEvent({
    event: "OTP_VERIFIED",
    admin: admin._id,
    email,
    ip,
    userAgent,
  });

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        {
          resetToken: rawResetToken,
          expiresInMinutes: RESET_TOKEN_EXPIRY_MS / 60000,
        },
        "Verification successful. Use this token to set a new password.",
      ),
    );
});

// POST /api/admin/auth/reset-password
// Body: { email, resetToken, newPassword, honeypot? }
const resetPasswordWithOtp = asyncHandler(async (req, res) => {
  const ip = req.ip;
  const userAgent = req.get("User-Agent") || "unknown";
  const email = (req.body.email || "").toLowerCase().trim();
  const { resetToken, newPassword } = req.body;

  if (req.isHoneypotTriggered) {
    await tarpitDelay();
    throw ApiError.unauthorized(GENERIC_RESET_TOKEN_INVALID_MESSAGE);
  }

  const admin = await User.findOne({ email }).select(
    "+passwordResetTokenHash +passwordResetTokenExpiresAt +password",
  );

  if (!admin || !admin.isActive) {
    await tarpitDelay();
    await logSecurityEvent({
      event: "RESET_TOKEN_INVALID",
      email,
      ip,
      userAgent,
    });
    throw ApiError.unauthorized(GENERIC_RESET_TOKEN_INVALID_MESSAGE);
  }

  const isValidToken = await admin.compareResetToken(resetToken);

  if (!isValidToken) {
    await tarpitDelay();
    await logSecurityEvent({
      event: "RESET_TOKEN_MISMATCH",
      admin: admin._id,
      email,
      ip,
      userAgent,
    });
    throw ApiError.unauthorized(GENERIC_RESET_TOKEN_INVALID_MESSAGE);
  }

  // Token is single-use regardless of outcome from here, so clear it in the same save as the
  // password change. Also kill any existing refresh-token session, same as changePassword does.
  admin.password = newPassword;
  admin.refreshTokenHash = null;
  admin.passwordResetTokenHash = null;
  admin.passwordResetTokenExpiresAt = null;
  await admin.save();

  await sendAdminPasswordResetConfirmationEmail(admin);
  await logSecurityEvent({
    event: "PASSWORD_RESET_SUCCESS",
    admin: admin._id,
    email,
    ip,
    userAgent,
  });

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        null,
        "Password reset successfully. Please log in with your new password.",
      ),
    );
});

module.exports = {
  login,
  logout,
  refreshAccessToken,
  getMe,
  changePassword,
  forgotPassword,
  verifyOtp,
  resetPasswordWithOtp,
};