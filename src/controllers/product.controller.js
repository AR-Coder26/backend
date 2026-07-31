const asyncHandler = require('express-async-handler');
const Product = require('../models/Product.model');
const Category = require('../models/Category.model');
const Brand = require('../models/Brand.model');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { uploadBufferToCloudinary, deleteFromCloudinary } = require('../utils/cloudinaryUpload');

// Mirrors the Product model's virtuals (totalStock, isOutOfStock, minPrice, maxPrice) manually,
// because .lean() queries (used here for listing performance) skip virtual computation entirely -
// virtuals only run on full Mongoose Document instances, not on plain lean objects.
const attachComputedFields = (product) => {
  const totalStock = product.variants.reduce((sum, v) => sum + v.stock, 0);
  const prices = product.variants.map((v) => v.price);
  return {
    ...product,
    totalStock,
    isOutOfStock: totalStock <= 0,
    minPrice: prices.length ? Math.min(...prices) : 0,
    maxPrice: prices.length ? Math.max(...prices) : 0,
  };
};

const parseVariants = (variants) => {
  try {
    return typeof variants === 'string' ? JSON.parse(variants) : variants;
  } catch (err) {
    throw ApiError.badRequest('variants must be valid JSON');
  }
};

// GET /api/products (public - storefront, with filters + pagination)
const getPublicProducts = asyncHandler(async (req, res) => {
  const {
    category,
    brand,
    fabricType,
    fabricStatus,
    size,
    discount,
    minPrice,
    maxPrice,
    search,
    sort,
    page = 1,
    limit = 12,
  } = req.query;

  const query = { isActive: true };

  if (category) {
    const categoryDoc = await Category.findOne({ slug: category, isActive: true }).select('_id').lean();
    if (!categoryDoc) {
      return res
        .status(200)
        .json(new ApiResponse(200, { products: [], total: 0, page: Number(page), totalPages: 0 }, 'No products found'));
    }
    query.category = categoryDoc._id;
  }

  if (brand) {
    const brandDoc = await Brand.findOne({ slug: brand, isActive: true }).select('_id').lean();
    if (!brandDoc) {
      return res
        .status(200)
        .json(new ApiResponse(200, { products: [], total: 0, page: Number(page), totalPages: 0 }, 'No products found'));
    }
    query.brand = brandDoc._id;
  }

  if (fabricType) query.fabricType = fabricType;
  if (discount) query.discountPercentage = { $gte: Number(discount) }; // e.g. "30% off" button sends discount=30

  // These two are independent facet filters (a product can match on size via one variant and
  // fabricStatus via a different variant) - that's standard e-commerce filter behavior.
  if (fabricStatus) query['variants.fabricStatus'] = fabricStatus;
  if (size) query['variants.size'] = size;

  if (minPrice || maxPrice) {
    const priceCondition = {};
    if (minPrice) priceCondition.$gte = Number(minPrice);
    if (maxPrice) priceCondition.$lte = Number(maxPrice);
    // $elemMatch here (unlike size/fabricStatus above) ensures the SAME variant satisfies both
    // bounds - a single price has to fall within the range, it can't be split across variants.
    query.variants = { $elemMatch: { price: priceCondition } };
  }

  if (search) {
    query.$text = { $search: search };
  }

  const sortOption = sort === 'oldest' ? { createdAt: 1 } : { createdAt: -1 };

  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.min(50, Math.max(1, Number(limit)));
  const skip = (pageNum - 1) * limitNum;

  const [products, total] = await Promise.all([
    Product.find(query)
      .populate('category', 'name slug')
      .populate('brand', 'name slug')
      .select('-__v')
      .sort(sortOption)
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Product.countDocuments(query),
  ]);

  res.status(200).json(
    new ApiResponse(
      200,
      {
        products: products.map(attachComputedFields),
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum),
      },
      'Products fetched'
    )
  );
});

// GET /api/products/:slug (public)
const getPublicProductBySlug = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ slug: req.params.slug, isActive: true })
    .populate('category', 'name slug')
    .populate('brand', 'name slug')
    .select('-__v')
    .lean();

  if (!product) {
    throw ApiError.notFound('Product not found');
  }

  res.status(200).json(new ApiResponse(200, attachComputedFields(product), 'Product fetched'));
});

// GET /api/admin/products (admin - includes inactive)
const getAllProductsAdmin = asyncHandler(async (req, res) => {
  const { search, category, brand, isActive, page = 1, limit = 20 } = req.query;

  const query = {};
  if (search) query.$text = { $search: search };
  if (category) query.category = category;
  if (brand) query.brand = brand;
  if (isActive !== undefined) query.isActive = isActive === 'true';

  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.min(100, Math.max(1, Number(limit)));
  const skip = (pageNum - 1) * limitNum;

  const [products, total] = await Promise.all([
    Product.find(query)
      .populate('category', 'name slug')
      .populate('brand', 'name slug')
      .select('-__v')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Product.countDocuments(query),
  ]);

  res.status(200).json(
    new ApiResponse(
      200,
      {
        products: products.map(attachComputedFields),
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum),
      },
      'All products fetched'
    )
  );
});

// GET /api/admin/products/:id
const getProductByIdAdmin = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id)
    .populate('category', 'name slug')
    .populate('brand', 'name slug')
    .select('-__v')
    .lean();

  if (!product) {
    throw ApiError.notFound('Product not found');
  }

  res.status(200).json(new ApiResponse(200, attachComputedFields(product), 'Product fetched'));
});

// POST /api/admin/products (multipart: text fields + variants JSON + general gallery images)
const createProduct = asyncHandler(async (req, res) => {
  const {
    name,
    description,
    category,
    brand,
    fabricType,
    pieceCount,
    isCustomStitchingAvailable,
    discountPercentage,
    variants,
  } = req.body;

  const categoryExists = await Category.findById(category).select('_id').lean();
  if (!categoryExists) {
    throw ApiError.badRequest('Invalid category ID');
  }

  const brandExists = await Brand.findById(brand).select('_id').lean();
  if (!brandExists) {
    throw ApiError.badRequest('Invalid brand ID');
  }

  const parsedVariants = parseVariants(variants);
  if (!Array.isArray(parsedVariants) || parsedVariants.length === 0) {
    throw ApiError.badRequest('Product must have at least one variant');
  }

  const cleanVariants = parsedVariants.map((v) => ({
    color: v.color,
    size: v.size,
    fabricStatus: v.fabricStatus,
    price: v.price,
    comparePrice: v.comparePrice ?? null,
    stock: v.stock ?? 0,
    images: [],
  }));

  let images = [];
  if (req.files && req.files.length > 0) {
    const uploadPromises = req.files.map((file) => uploadBufferToCloudinary(file.buffer, 'products/gallery'));
    const results = await Promise.all(uploadPromises);
    images = results.map((r) => ({ url: r.secure_url, publicId: r.public_id }));
  }

  const product = await Product.create({
    name,
    description,
    category,
    brand,
    fabricType,
    pieceCount,
    isCustomStitchingAvailable,
    discountPercentage: discountPercentage || 0,
    variants: cleanVariants,
    images,
  });

  const populated = await Product.findById(product._id)
    .populate('category', 'name slug')
    .populate('brand', 'name slug');

  res.status(201).json(new ApiResponse(201, populated, 'Product created successfully'));
});

// PUT /api/admin/products/:id (plain JSON - no files here; images go through their own endpoints)
const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    throw ApiError.notFound('Product not found');
  }

  const {
    name,
    description,
    category,
    brand,
    fabricType,
    pieceCount,
    isCustomStitchingAvailable,
    discountPercentage,
    isActive,
    variants,
  } = req.body;

  if (category !== undefined) {
    const categoryExists = await Category.findById(category).select('_id').lean();
    if (!categoryExists) throw ApiError.badRequest('Invalid category ID');
    product.category = category;
  }

  if (brand !== undefined) {
    const brandExists = await Brand.findById(brand).select('_id').lean();
    if (!brandExists) throw ApiError.badRequest('Invalid brand ID');
    product.brand = brand;
  }

  if (name !== undefined) product.name = name;
  if (description !== undefined) product.description = description;
  if (fabricType !== undefined) product.fabricType = fabricType;
  if (pieceCount !== undefined) product.pieceCount = pieceCount;
  if (isCustomStitchingAvailable !== undefined) product.isCustomStitchingAvailable = isCustomStitchingAvailable;
  if (discountPercentage !== undefined) product.discountPercentage = discountPercentage;
  if (isActive !== undefined) product.isActive = isActive;

  if (variants !== undefined) {
    const incomingVariants = parseVariants(variants);

    if (!Array.isArray(incomingVariants) || incomingVariants.length === 0) {
      throw ApiError.badRequest('Product must have at least one variant');
    }

    const incomingIds = incomingVariants.filter((v) => v._id).map((v) => String(v._id));

    const removedVariants = product.variants.filter((v) => !incomingIds.includes(String(v._id)));
    const imagesToDelete = removedVariants.flatMap((v) => v.images.map((img) => img.publicId));
    await Promise.all(imagesToDelete.map((publicId) => deleteFromCloudinary(publicId)));

    product.variants = incomingVariants.map((incoming) => {
      const existing = incoming._id ? product.variants.id(incoming._id) : null;
      return {
        _id: existing ? existing._id : undefined,
        sku: incoming.sku || existing?.sku,
        color: incoming.color,
        size: incoming.size,
        fabricStatus: incoming.fabricStatus,
        price: incoming.price,
        comparePrice: incoming.comparePrice ?? null,
        stock: incoming.stock,
        images: existing ? existing.images : [],
      };
    });
  }

  await product.save();

  const populated = await Product.findById(product._id)
    .populate('category', 'name slug')
    .populate('brand', 'name slug');

  res.status(200).json(new ApiResponse(200, populated, 'Product updated successfully'));
});

// DELETE /api/admin/products/:id
const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    throw ApiError.notFound('Product not found');
  }

  const allImagePublicIds = [
    ...product.images.map((img) => img.publicId),
    ...product.variants.flatMap((v) => v.images.map((img) => img.publicId)),
  ];

  await Promise.all(allImagePublicIds.map((publicId) => deleteFromCloudinary(publicId)));
  await product.deleteOne();

  res.status(200).json(new ApiResponse(200, null, 'Product deleted successfully'));
});

// POST /api/admin/products/:id/images (general gallery images)
const addProductImages = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    throw ApiError.notFound('Product not found');
  }

  if (!req.files || req.files.length === 0) {
    throw ApiError.badRequest('At least one image is required');
  }

  const uploadPromises = req.files.map((file) => uploadBufferToCloudinary(file.buffer, 'products/gallery'));
  const results = await Promise.all(uploadPromises);
  product.images.push(...results.map((r) => ({ url: r.secure_url, publicId: r.public_id })));

  await product.save();

  res.status(200).json(new ApiResponse(200, product, 'Product images uploaded successfully'));
});

// DELETE /api/admin/products/:id/images?publicId=...
const deleteProductImage = asyncHandler(async (req, res) => {
  const { publicId } = req.query;
  if (!publicId) {
    throw ApiError.badRequest('publicId query parameter is required');
  }

  const product = await Product.findById(req.params.id);
  if (!product) {
    throw ApiError.notFound('Product not found');
  }

  const imageExists = product.images.some((img) => img.publicId === publicId);
  if (!imageExists) {
    throw ApiError.notFound('Image not found on this product');
  }

  product.images = product.images.filter((img) => img.publicId !== publicId);
  await product.save();
  await deleteFromCloudinary(publicId);

  res.status(200).json(new ApiResponse(200, product, 'Product image removed successfully'));
});

// POST /api/admin/products/:id/variants/:variantId/images
const addVariantImages = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    throw ApiError.notFound('Product not found');
  }

  const variant = product.variants.id(req.params.variantId);
  if (!variant) {
    throw ApiError.notFound('Variant not found');
  }

  if (!req.files || req.files.length === 0) {
    throw ApiError.badRequest('At least one image is required');
  }

  const uploadPromises = req.files.map((file) => uploadBufferToCloudinary(file.buffer, 'products/variants'));
  const results = await Promise.all(uploadPromises);
  variant.images.push(...results.map((r) => ({ url: r.secure_url, publicId: r.public_id })));

  await product.save();

  res.status(200).json(new ApiResponse(200, product, 'Variant images uploaded successfully'));
});

// DELETE /api/admin/products/:id/variants/:variantId/images?publicId=...
const deleteVariantImage = asyncHandler(async (req, res) => {
  const { publicId } = req.query;
  if (!publicId) {
    throw ApiError.badRequest('publicId query parameter is required');
  }

  const product = await Product.findById(req.params.id);
  if (!product) {
    throw ApiError.notFound('Product not found');
  }

  const variant = product.variants.id(req.params.variantId);
  if (!variant) {
    throw ApiError.notFound('Variant not found');
  }

  const imageExists = variant.images.some((img) => img.publicId === publicId);
  if (!imageExists) {
    throw ApiError.notFound('Image not found on this variant');
  }

  variant.images = variant.images.filter((img) => img.publicId !== publicId);
  await product.save();
  await deleteFromCloudinary(publicId);

  res.status(200).json(new ApiResponse(200, product, 'Variant image removed successfully'));
});

module.exports = {
  getPublicProducts,
  getPublicProductBySlug,
  getAllProductsAdmin,
  getProductByIdAdmin,
  createProduct,
  updateProduct,
  deleteProduct,
  addProductImages,
  deleteProductImage,
  addVariantImages,
  deleteVariantImage,
};