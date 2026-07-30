const asyncHandler = require('express-async-handler');
const jwt = require('jsonwebtoken');
const User = require('../models/User.model');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { setAuthCookies, clearAuthCookies, COOKIE_NAMES } = require('../utils/token');

// POST /api/admin/auth/login
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const admin = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');
  if (!admin || !admin.isActive) {
    // Deliberately identical message whether the email doesn't exist or the password is wrong
    throw ApiError.unauthorized('Invalid email or password');
  }

  const isPasswordValid = await admin.comparePassword(password);
  if (!isPasswordValid) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  const accessToken = admin.generateAccessToken();
  const refreshToken = admin.generateRefreshToken();
  await admin.setRefreshTokenHash(refreshToken);

  setAuthCookies(res, {
    accessToken,
    refreshToken,
    accessCookieName: COOKIE_NAMES.admin.access,
    refreshCookieName: COOKIE_NAMES.admin.refresh,
    accessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
  });

  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { id: admin._id, name: admin.name, email: admin.email, role: admin.role },
        'Logged in successfully'
      )
    );
});

// POST /api/admin/auth/logout
const logout = asyncHandler(async (req, res) => {
  if (req.admin) {
    req.admin.refreshTokenHash = null;
    await req.admin.save({ validateBeforeSave: false });
  }

  clearAuthCookies(res, {
    accessCookieName: COOKIE_NAMES.admin.access,
    refreshCookieName: COOKIE_NAMES.admin.refresh,
  });

  res.status(200).json(new ApiResponse(200, null, 'Logged out successfully'));
});

// POST /api/admin/auth/refresh
const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken = req.cookies?.[COOKIE_NAMES.admin.refresh];
  if (!incomingRefreshToken) {
    throw ApiError.unauthorized('Refresh token missing. Please log in again.');
  }

  let decoded;
  try {
    decoded = jwt.verify(incomingRefreshToken, process.env.JWT_REFRESH_SECRET);
  } catch (err) {
    throw ApiError.unauthorized('Refresh token expired or invalid. Please log in again.');
  }

  const admin = await User.findById(decoded.id).select('+refreshTokenHash');
  if (!admin || !admin.isActive) {
    throw ApiError.unauthorized('Account not found or deactivated.');
  }

  const isValidRefreshToken = await admin.compareRefreshToken(incomingRefreshToken);
  if (!isValidRefreshToken) {
    throw ApiError.unauthorized('Refresh token no longer valid. Please log in again.');
  }

  // Rotate: issue a brand new refresh token and invalidate the old one on every use.
  const newAccessToken = admin.generateAccessToken();
  const newRefreshToken = admin.generateRefreshToken();
  await admin.setRefreshTokenHash(newRefreshToken);

  setAuthCookies(res, {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
    accessCookieName: COOKIE_NAMES.admin.access,
    refreshCookieName: COOKIE_NAMES.admin.refresh,
    accessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
  });

  res.status(200).json(new ApiResponse(200, null, 'Access token refreshed'));
});

// GET /api/admin/auth/me
const getMe = asyncHandler(async (req, res) => {
  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { id: req.admin._id, name: req.admin.name, email: req.admin.email, role: req.admin.role },
        'Admin profile fetched'
      )
    );
});

module.exports = { login, logout, refreshAccessToken, getMe };