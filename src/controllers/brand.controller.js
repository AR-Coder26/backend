const asyncHandler = require('express-async-handler');
const Brand = require('../models/Brand.model');
const Product = require('../models/Product.model');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { uploadBufferToCloudinary, deleteFromCloudinary } = require('../utils/cloudinaryUpload');

// GET /api/brands (public - storefront)
const getPublicBrands = asyncHandler(async (req, res) => {
  const brands = await Brand.find({ isActive: true }).sort({ name: 1 }).select('-__v').lean();
  res.status(200).json(new ApiResponse(200, brands, 'Brands fetched'));
});

// GET /api/brands/:slug (public)
const getPublicBrandBySlug = asyncHandler(async (req, res) => {
  const brand = await Brand.findOne({ slug: req.params.slug, isActive: true }).lean();
  if (!brand) {
    throw ApiError.notFound('Brand not found');
  }
  res.status(200).json(new ApiResponse(200, brand, 'Brand fetched'));
});

// GET /api/admin/brands (admin - includes inactive)
const getAllBrandsAdmin = asyncHandler(async (req, res) => {
  const brands = await Brand.find({}).sort({ createdAt: -1 });
  res.status(200).json(new ApiResponse(200, brands, 'All brands fetched'));
});

// GET /api/admin/brands/:id
const getBrandByIdAdmin = asyncHandler(async (req, res) => {
  const brand = await Brand.findById(req.params.id);
  if (!brand) {
    throw ApiError.notFound('Brand not found');
  }
  res.status(200).json(new ApiResponse(200, brand, 'Brand fetched'));
});

// POST /api/admin/brands
const createBrand = asyncHandler(async (req, res) => {
  const { name } = req.body;

  const existing = await Brand.findOne({ name: name.trim() });
  if (existing) {
    throw ApiError.conflict('A brand with this name already exists');
  }

  let logo = { url: null, publicId: null };
  if (req.file) {
    const result = await uploadBufferToCloudinary(req.file.buffer, 'brands');
    logo = { url: result.secure_url, publicId: result.public_id };
  }

  const brand = await Brand.create({ name, logo });

  res.status(201).json(new ApiResponse(201, brand, 'Brand created successfully'));
});

// PUT /api/admin/brands/:id
const updateBrand = asyncHandler(async (req, res) => {
  const brand = await Brand.findById(req.params.id);
  if (!brand) {
    throw ApiError.notFound('Brand not found');
  }

  const { name, isActive } = req.body;

  if (name && name.trim() !== brand.name) {
    const existing = await Brand.findOne({ name: name.trim(), _id: { $ne: brand._id } });
    if (existing) {
      throw ApiError.conflict('A brand with this name already exists');
    }
    brand.name = name.trim();
  }

  if (isActive !== undefined) brand.isActive = isActive;

  if (req.file) {
    const oldPublicId = brand.logo?.publicId;
    const result = await uploadBufferToCloudinary(req.file.buffer, 'brands');
    brand.logo = { url: result.secure_url, publicId: result.public_id };
    await deleteFromCloudinary(oldPublicId);
  }

  await brand.save();

  res.status(200).json(new ApiResponse(200, brand, 'Brand updated successfully'));
});

// DELETE /api/admin/brands/:id
const deleteBrand = asyncHandler(async (req, res) => {
  const brand = await Brand.findById(req.params.id);
  if (!brand) {
    throw ApiError.notFound('Brand not found');
  }

  const productCount = await Product.countDocuments({ brand: brand._id });
  if (productCount > 0) {
    throw ApiError.conflict(
      `Cannot delete this brand - ${productCount} product(s) are still assigned to it. Reassign or delete them first.`
    );
  }

  await deleteFromCloudinary(brand.logo?.publicId);
  await brand.deleteOne();

  res.status(200).json(new ApiResponse(200, null, 'Brand deleted successfully'));
});

module.exports = {
  getPublicBrands,
  getPublicBrandBySlug,
  getAllBrandsAdmin,
  getBrandByIdAdmin,
  createBrand,
  updateBrand,
  deleteBrand,
};