const asyncHandler = require('express-async-handler');
const Customer = require('../models/Customer.model');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');

// GET /api/my-addresses
const getMyAddresses = asyncHandler(async (req, res) => {
  const customer = await Customer.findById(req.customer._id).select('addresses');
  res.status(200).json(new ApiResponse(200, customer.addresses, 'Addresses fetched'));
});

// POST /api/my-addresses
const addMyAddress = asyncHandler(async (req, res) => {
  const { label, addressLine, city, postalCode, isDefault } = req.body;

  const customer = await Customer.findById(req.customer._id);

  const shouldBeDefault = isDefault === true || customer.addresses.length === 0;
  if (shouldBeDefault) {
    customer.addresses.forEach((addr) => {
      addr.isDefault = false;
    });
  }

  customer.addresses.push({ label, addressLine, city, postalCode, isDefault: shouldBeDefault });
  await customer.save();

  res.status(201).json(new ApiResponse(201, customer.addresses, 'Address added successfully'));
});

// PUT /api/my-addresses/:addressId
const updateMyAddress = asyncHandler(async (req, res) => {
  const customer = await Customer.findById(req.customer._id);
  const address = customer.addresses.id(req.params.addressId);
  if (!address) {
    throw ApiError.notFound('Address not found');
  }

  const { label, addressLine, city, postalCode, isDefault } = req.body;

  if (label !== undefined) address.label = label;
  if (addressLine !== undefined) address.addressLine = addressLine;
  if (city !== undefined) address.city = city;
  if (postalCode !== undefined) address.postalCode = postalCode;

  if (isDefault === true) {
    customer.addresses.forEach((addr) => {
      addr.isDefault = String(addr._id) === String(address._id);
    });
  }

  await customer.save();

  res.status(200).json(new ApiResponse(200, customer.addresses, 'Address updated successfully'));
});

// DELETE /api/my-addresses/:addressId
const deleteMyAddress = asyncHandler(async (req, res) => {
  const customer = await Customer.findById(req.customer._id);
  const address = customer.addresses.id(req.params.addressId);
  if (!address) {
    throw ApiError.notFound('Address not found');
  }

  const wasDefault = address.isDefault;
  address.deleteOne();

  if (wasDefault && customer.addresses.length > 0) {
    customer.addresses[0].isDefault = true;
  }

  await customer.save();

  res.status(200).json(new ApiResponse(200, customer.addresses, 'Address deleted successfully'));
});

module.exports = { getMyAddresses, addMyAddress, updateMyAddress, deleteMyAddress };