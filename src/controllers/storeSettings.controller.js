const asyncHandler = require('express-async-handler');
const StoreSettings = require('../models/StoreSettings.model');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');

const mergeAndValidateAccount = (existing, incoming, label) => {
  const merged = {
    accountTitle: incoming.accountTitle !== undefined ? incoming.accountTitle : existing.accountTitle,
    accountNumber: incoming.accountNumber !== undefined ? incoming.accountNumber : existing.accountNumber,
    instructions: incoming.instructions !== undefined ? incoming.instructions : existing.instructions,
    isActive: incoming.isActive !== undefined ? incoming.isActive : existing.isActive,
  };
  if (merged.isActive && (!merged.accountTitle || !merged.accountNumber)) {
    throw ApiError.badRequest(`${label} account title and number are required before activating it`);
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
  };

  res.status(200).json(new ApiResponse(200, publicPayload, 'Payment settings fetched'));
});

// GET /api/admin/store-settings (admin - full view for the settings form, including isActive)
const getAdminStoreSettings = asyncHandler(async (req, res) => {
  const settings = await StoreSettings.getSingleton();
  res.status(200).json(new ApiResponse(200, settings, 'Store settings fetched'));
});

// PATCH /api/admin/store-settings
const updateStoreSettings = asyncHandler(async (req, res) => {
  const { jazzCash, easyPaisa } = req.body;

  const settings = await StoreSettings.getSingleton();

  if (jazzCash) {
    settings.jazzCash = mergeAndValidateAccount(settings.jazzCash, jazzCash, 'JazzCash');
  }
  if (easyPaisa) {
    settings.easyPaisa = mergeAndValidateAccount(settings.easyPaisa, easyPaisa, 'EasyPaisa');
  }

  await settings.save();

  res.status(200).json(new ApiResponse(200, settings, 'Store settings updated successfully'));
});

module.exports = { getPublicPaymentSettings, getAdminStoreSettings, updateStoreSettings };