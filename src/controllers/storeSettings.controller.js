const asyncHandler = require('express-async-handler');
const StoreSettings = require('../models/StoreSettings.model');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');

const mergeAndValidateAccount = (existing, incoming, label, requiredFields = ['accountTitle', 'accountNumber']) => {
  const merged = { ...existing, ...incoming };
  if (merged.isActive) {
    const missing = requiredFields.filter((field) => !merged[field]);
    if (missing.length > 0) {
      throw ApiError.badRequest(`${label}: ${missing.join(', ')} required before activating it`);
    }
  }
  return merged;
};

// GET /api/store-settings (public - checkout page)
const getPublicPaymentSettings = asyncHandler(async (req, res) => {
  const settings = await StoreSettings.getSingleton();

  const publicPayload = {
    jazzCash: settings.jazzCash.isActive
      ? {
          accountTitle: settings.jazzCash.accountTitle,
          accountNumber: settings.jazzCash.accountNumber,
          instructions: settings.jazzCash.instructions,
        }
      : null,
    easyPaisa: settings.easyPaisa.isActive
      ? {
          accountTitle: settings.easyPaisa.accountTitle,
          accountNumber: settings.easyPaisa.accountNumber,
          instructions: settings.easyPaisa.instructions,
        }
      : null,
      bankTransfer: settings.bankTransfer.isActive
      ? {
          bankName: settings.bankTransfer.bankName,
          accountTitle: settings.bankTransfer.accountTitle,
          accountNumber: settings.bankTransfer.accountNumber,
          iban: settings.bankTransfer.iban,
          instructions: settings.bankTransfer.instructions,
        }
      : null,
  };
  publicPayload.minOrderValue = settings.minOrderValue;
  publicPayload.deliveryFlatRateNonKarachi = settings.deliveryFlatRateNonKarachi;

  res.status(200).json(new ApiResponse(200, publicPayload, 'Payment settings fetched'));
});

// GET /api/admin/store-settings (admin - full view for the settings form, including isActive)
const getAdminStoreSettings = asyncHandler(async (req, res) => {
  const settings = await StoreSettings.getSingleton();
  res.status(200).json(new ApiResponse(200, settings, 'Store settings fetched'));
});

// PATCH /api/admin/store-settings
const updateStoreSettings = asyncHandler(async (req, res) => {
  const { jazzCash, easyPaisa, bankTransfer, minOrderValue, deliveryFlatRateNonKarachi } = req.body;

  const settings = await StoreSettings.getSingleton();

  if (jazzCash) {
    settings.jazzCash = mergeAndValidateAccount(settings.jazzCash, jazzCash, 'JazzCash');
  }
  if (easyPaisa) {
    settings.easyPaisa = mergeAndValidateAccount(settings.easyPaisa, easyPaisa, 'EasyPaisa');
  }
  if (bankTransfer) {
    settings.bankTransfer = mergeAndValidateAccount(settings.bankTransfer, bankTransfer, 'Bank Transfer', [
      'bankName',
      'accountTitle',
      'accountNumber',
    ]);
  }
  if (minOrderValue !== undefined) {
    settings.minOrderValue = minOrderValue;
  }
  if (deliveryFlatRateNonKarachi !== undefined) {
    settings.deliveryFlatRateNonKarachi = deliveryFlatRateNonKarachi;
  }

  await settings.save();

  res.status(200).json(new ApiResponse(200, settings, 'Store settings updated successfully'));
});

module.exports = { getPublicPaymentSettings, getAdminStoreSettings, updateStoreSettings };