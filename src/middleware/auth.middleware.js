const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const ApiError = require('../utils/ApiError');
const User = require('../models/User.model');
const Customer = require('../models/Customer.model');
const { COOKIE_NAMES } = require('../utils/token');

// Blocks the request unless a valid admin access-token cookie is present.
const protectAdmin = asyncHandler(async (req, res, next) => {
  const token = req.cookies?.[COOKIE_NAMES.admin.access];
  if (!token) {
    throw ApiError.unauthorized('Not authenticated. Please log in.');
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
  } catch (err) {
    throw ApiError.unauthorized('Session expired or invalid. Please log in again.');
  }

  const admin = await User.findById(decoded.id);
  if (!admin || !admin.isActive) {
    throw ApiError.unauthorized('Account not found or deactivated.');
  }

  req.admin = admin;
  next();
});

// Blocks the request unless a valid customer access-token cookie is present.
const protectCustomer = asyncHandler(async (req, res, next) => {
  const token = req.cookies?.[COOKIE_NAMES.customer.access];
  if (!token) {
    throw ApiError.unauthorized('Please log in to continue.');
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.CUSTOMER_JWT_ACCESS_SECRET);
  } catch (err) {
    throw ApiError.unauthorized('Session expired or invalid. Please log in again.');
  }

  const customer = await Customer.findById(decoded.id);
  if (!customer || !customer.isActive) {
    throw ApiError.unauthorized('Account not found or deactivated.');
  }

  req.customer = customer;
  next();
});

// Used on routes where login is OPTIONAL - e.g. placing an order as a guest OR while logged in.
// If the cookie is missing or invalid, this silently proceeds as a guest instead of blocking the request.
const attachCustomerIfLoggedIn = asyncHandler(async (req, res, next) => {
  const token = req.cookies?.[COOKIE_NAMES.customer.access];
  if (!token) return next();

  try {
    const decoded = jwt.verify(token, process.env.CUSTOMER_JWT_ACCESS_SECRET);
    const customer = await Customer.findById(decoded.id);
    if (customer && customer.isActive) {
      req.customer = customer;
    }
  } catch (err) {
    // Invalid/expired token on an optional-auth route - proceed as guest, do not block checkout.
  }

  next();
});

module.exports = { protectAdmin, protectCustomer, attachCustomerIfLoggedIn };