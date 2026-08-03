const asyncHandler = require('express-async-handler');
const jwt = require('jsonwebtoken');
const Customer = require('../models/Customer.model');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { setAuthCookies, clearAuthCookies, COOKIE_NAMES } = require('../utils/token');

// POST /api/auth/register
const register = asyncHandler(async (req, res) => {
  const { name, email, phone, password } = req.body;

  const orConditions = [];
  if (email) orConditions.push({ email: email.toLowerCase().trim() });
  if (phone) orConditions.push({ phone });

  const existing = await Customer.findOne({ $or: orConditions });
  if (existing) {
    throw ApiError.conflict('An account with this email or phone number already exists');
  }

  const customer = await Customer.create({
    name,
    email: email || null,
    phone: phone || null,
    password,
  });

  const accessToken = customer.generateAccessToken();
  const refreshToken = customer.generateRefreshToken();
  await customer.setRefreshTokenHash(refreshToken);

  setAuthCookies(res, {
    accessToken,
    refreshToken,
    accessCookieName: COOKIE_NAMES.customer.access,
    refreshCookieName: COOKIE_NAMES.customer.refresh,
    accessExpiry: process.env.CUSTOMER_JWT_ACCESS_EXPIRY || '15m',
    refreshExpiry: process.env.CUSTOMER_JWT_REFRESH_EXPIRY || '30d',
  });

  res
    .status(201)
    .json(
      new ApiResponse(
        201,
        { id: customer._id, name: customer.name, email: customer.email, phone: customer.phone },
        'Account created successfully'
      )
    );
});

// POST /api/auth/login
const login = asyncHandler(async (req, res) => {
  const { identifier, password } = req.body;

  const customer = await Customer.findByIdentifier(identifier);
  if (!customer || !customer.isActive) {
    throw ApiError.unauthorized('Invalid credentials');
  }

  const isPasswordValid = await customer.comparePassword(password);
  if (!isPasswordValid) {
    throw ApiError.unauthorized('Invalid credentials');
  }

  const accessToken = customer.generateAccessToken();
  const refreshToken = customer.generateRefreshToken();
  await customer.setRefreshTokenHash(refreshToken);

  setAuthCookies(res, {
    accessToken,
    refreshToken,
    accessCookieName: COOKIE_NAMES.customer.access,
    refreshCookieName: COOKIE_NAMES.customer.refresh,
    accessExpiry: process.env.CUSTOMER_JWT_ACCESS_EXPIRY || '15m',
    refreshExpiry: process.env.CUSTOMER_JWT_REFRESH_EXPIRY || '30d',
  });

  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { id: customer._id, name: customer.name, email: customer.email, phone: customer.phone },
        'Logged in successfully'
      )
    );
});

// POST /api/auth/logout
const logout = asyncHandler(async (req, res) => {
  clearAuthCookies(res, {
    accessCookieName: COOKIE_NAMES.customer.access,
    refreshCookieName: COOKIE_NAMES.customer.refresh,
  });

  if (req.customer) {
    try {
      req.customer.refreshTokenHash = null;
      await req.customer.save({ validateBeforeSave: false });
    } catch (err) {
      console.error('Failed to invalidate customer refresh token on logout:', err.message);
    }
  }

  res.status(200).json(new ApiResponse(200, null, 'Logged out successfully'));
});

// POST /api/auth/refresh
const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken = req.cookies?.[COOKIE_NAMES.customer.refresh];
  if (!incomingRefreshToken) {
    throw ApiError.unauthorized('Refresh token missing. Please log in again.');
  }

  let decoded;
  try {
    decoded = jwt.verify(incomingRefreshToken, process.env.CUSTOMER_JWT_REFRESH_SECRET);
  } catch (err) {
    throw ApiError.unauthorized('Refresh token expired or invalid. Please log in again.');
  }

  const customer = await Customer.findById(decoded.id).select('+refreshTokenHash');
  if (!customer || !customer.isActive) {
    throw ApiError.unauthorized('Account not found or deactivated.');
  }

  const isValidRefreshToken = await customer.compareRefreshToken(incomingRefreshToken);
  if (!isValidRefreshToken) {
    throw ApiError.unauthorized('Refresh token no longer valid. Please log in again.');
  }

  const newAccessToken = customer.generateAccessToken();
  const newRefreshToken = customer.generateRefreshToken();
  await customer.setRefreshTokenHash(newRefreshToken);

  setAuthCookies(res, {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
    accessCookieName: COOKIE_NAMES.customer.access,
    refreshCookieName: COOKIE_NAMES.customer.refresh,
    accessExpiry: process.env.CUSTOMER_JWT_ACCESS_EXPIRY || '15m',
    refreshExpiry: process.env.CUSTOMER_JWT_REFRESH_EXPIRY || '30d',
  });

  res.status(200).json(new ApiResponse(200, null, 'Access token refreshed'));
});

// GET /api/auth/me
const getMe = asyncHandler(async (req, res) => {
  res.status(200).json(
    new ApiResponse(
      200,
      {
        id: req.customer._id,
        name: req.customer.name,
        email: req.customer.email,
        phone: req.customer.phone,
        addresses: req.customer.addresses,
      },
      'Customer profile fetched'
    )
  );
});

module.exports = { register, login, logout, refreshAccessToken, getMe };