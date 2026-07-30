const asyncHandler = require('express-async-handler');
const Category = require('../models/Category.model');
const Product = require('../models/Product.model');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { uploadBufferToCloudinary, deleteFromCloudinary } = require('../utils/cloudinaryUpload');

// GET /api/categories (public - storefront)
const getPublicCategories = asyncHandler(async (req, res) => {
  const categories = await Category.find({ isActive: true })
    .sort({ displayOrder: 1, name: 1 })
    .select('-__v')
    .lean();

  res.status(200).json(new ApiResponse(200, categories, 'Categories fetched'));
});

// GET /api/categories/:slug (public)
const getPublicCategoryBySlug = asyncHandler(async (req, res) => {
  const category = await Category.findOne({ slug: req.params.slug, isActive: true }).lean();
  if (!category) {
    throw ApiError.notFound('Category not found');
  }
  res.status(200).json(new ApiResponse(200, category, 'Category fetched'));
});

// GET /api/admin/categories (admin - includes inactive)
const getAllCategoriesAdmin = asyncHandler(async (req, res) => {
  const categories = await Category.find({}).sort({ displayOrder: 1, createdAt: -1 });
  res.status(200).json(new ApiResponse(200, categories, 'All categories fetched'));
});

// GET /api/admin/categories/:id
const getCategoryByIdAdmin = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) {
    throw ApiError.notFound('Category not found');
  }
  res.status(200).json(new ApiResponse(200, category, 'Category fetched'));
});

// POST /api/admin/categories
const createCategory = asyncHandler(async (req, res) => {
  const { name, description, displayOrder } = req.body;

  const existing = await Category.findOne({ name: name.trim() });
  if (existing) {
    throw ApiError.conflict('A category with this name already exists');
  }

  let image = { url: null, publicId: null };
  if (req.file) {
    const result = await uploadBufferToCloudinary(req.file.buffer, 'categories');
    image = { url: result.secure_url, publicId: result.public_id };
  }

  const category = await Category.create({
    name,
    description,
    displayOrder: displayOrder || 0,
    image,
  });

  res.status(201).json(new ApiResponse(201, category, 'Category created successfully'));
});

// PUT /api/admin/categories/:id
const updateCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) {
    throw ApiError.notFound('Category not found');
  }

  const { name, description, displayOrder, isActive } = req.body;

  if (name && name.trim() !== category.name) {
    const existing = await Category.findOne({ name: name.trim(), _id: { $ne: category._id } });
    if (existing) {
      throw ApiError.conflict('A category with this name already exists');
    }
    category.name = name.trim();
  }

  if (description !== undefined) category.description = description;
  if (displayOrder !== undefined) category.displayOrder = displayOrder;
  if (isActive !== undefined) category.isActive = isActive;

  // Upload the new image FIRST, and only delete the old one after the upload succeeds -
  // this way a failed upload never leaves the category with no image at all.
  if (req.file) {
    const oldPublicId = category.image?.publicId;
    const result = await uploadBufferToCloudinary(req.file.buffer, 'categories');
    category.image = { url: result.secure_url, publicId: result.public_id };
    await deleteFromCloudinary(oldPublicId);
  }

  await category.save();

  res.status(200).json(new ApiResponse(200, category, 'Category updated successfully'));
});

// DELETE /api/admin/categories/:id
const deleteCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) {
    throw ApiError.notFound('Category not found');
  }

  const productCount = await Product.countDocuments({ category: category._id });
  if (productCount > 0) {
    throw ApiError.conflict(
      `Cannot delete this category - ${productCount} product(s) are still assigned to it. Reassign or delete them first.`
    );
  }

  await deleteFromCloudinary(category.image?.publicId);
  await category.deleteOne();

  res.status(200).json(new ApiResponse(200, null, 'Category deleted successfully'));
});

module.exports = {
  getPublicCategories,
  getPublicCategoryBySlug,
  getAllCategoriesAdmin,
  getCategoryByIdAdmin,
  createCategory,
  updateCategory,
  deleteCategory,
};