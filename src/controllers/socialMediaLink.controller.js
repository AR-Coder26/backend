const asyncHandler = require("express-async-handler");
const SocialMediaLink = require("../models/SocialMediaLink.model");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const {
  uploadBufferToCloudinary,
  deleteFromCloudinary,
} = require("../utils/cloudinaryUpload");

const MAX_ACTIVE_LINKS = SocialMediaLink.MAX_ACTIVE_LINKS;

const getPublicSocialLinks = asyncHandler(async (req, res) => {
  const links = await SocialMediaLink.find({ isActive: true })
    .sort({ displayOrder: 1, createdAt: 1 })
    .limit(MAX_ACTIVE_LINKS)
    .select("-__v")
    .lean();

  res
    .status(200)
    .json(new ApiResponse(200, links, "Social media links fetched"));
});

// GET /api/admin/social-links (admin - includes inactive, for the management table)
const getAllSocialLinksAdmin = asyncHandler(async (req, res) => {
  const links = await SocialMediaLink.find({}).sort({
    displayOrder: 1,
    createdAt: -1,
  });
  res
    .status(200)
    .json(new ApiResponse(200, links, "All social media links fetched"));
});

// GET /api/admin/social-links/:id
const getSocialLinkByIdAdmin = asyncHandler(async (req, res) => {
  const link = await SocialMediaLink.findById(req.params.id);
  if (!link) {
    throw ApiError.notFound("Social media link not found");
  }
  res.status(200).json(new ApiResponse(200, link, "Social media link fetched"));
});

// POST /api/admin/social-links
const createSocialMediaLink = asyncHandler(async (req, res) => {
  const { platformName, iconName, targetUrl, isActive, displayOrder } =
    req.body;

  const existing = await SocialMediaLink.findOne({
    platformName: { $regex: `^${platformName.trim()}$`, $options: "i" },
  });
  if (existing) {
    throw ApiError.conflict(
      "A social media link for this platform already exists",
    );
  }

  const willBeActive = isActive === undefined ? true : isActive;
  if (willBeActive) {
    const activeCount = await SocialMediaLink.countDocuments({
      isActive: true,
    });
    if (activeCount >= MAX_ACTIVE_LINKS) {
      throw ApiError.conflict(
        `Cannot add another active social link - the maximum of ${MAX_ACTIVE_LINKS} active platforms has been reached. Deactivate or delete an existing one first.`,
      );
    }
  }

  let logo = { url: null, publicId: null };
  if (req.file) {
    const result = await uploadBufferToCloudinary(
      req.file.buffer,
      "social-links",
    );
    logo = { url: result.secure_url, publicId: result.public_id };
  }

  const link = await SocialMediaLink.create({
    platformName: platformName.trim(),
    iconName,
    logo,
    targetUrl: targetUrl.trim(),
    isActive: willBeActive,
    displayOrder: displayOrder || 0,
  });

  res
    .status(201)
    .json(new ApiResponse(201, link, "Social media link created successfully"));
});

// PUT /api/admin/social-links/:id
const updateSocialMediaLink = asyncHandler(async (req, res) => {
  const link = await SocialMediaLink.findById(req.params.id);
  if (!link) {
    throw ApiError.notFound("Social media link not found");
  }

  const {
    platformName,
    iconName,
    targetUrl,
    isActive,
    displayOrder,
    removeLogo,
  } = req.body;

  if (
    platformName &&
    platformName.trim().toLowerCase() !== link.platformName.toLowerCase()
  ) {
    const existing = await SocialMediaLink.findOne({
      platformName: { $regex: `^${platformName.trim()}$`, $options: "i" },
      _id: { $ne: link._id },
    });
    if (existing) {
      throw ApiError.conflict(
        "A social media link for this platform already exists",
      );
    }
    link.platformName = platformName.trim();
  }

  const isBeingActivated = isActive === true && !link.isActive;
  if (isBeingActivated) {
    const activeCount = await SocialMediaLink.countDocuments({
      isActive: true,
      _id: { $ne: link._id },
    });
    if (activeCount >= MAX_ACTIVE_LINKS) {
      throw ApiError.conflict(
        `Cannot activate this link - the maximum of ${MAX_ACTIVE_LINKS} active platforms has been reached. Deactivate another one first.`,
      );
    }
  }

  if (iconName !== undefined) link.iconName = iconName;
  if (targetUrl !== undefined) link.targetUrl = targetUrl.trim();
  if (displayOrder !== undefined) link.displayOrder = displayOrder;
  if (isActive !== undefined) link.isActive = isActive;

  if (req.file) {
    const oldPublicId = link.logo?.publicId;
    const result = await uploadBufferToCloudinary(
      req.file.buffer,
      "social-links",
    );
    link.logo = { url: result.secure_url, publicId: result.public_id };
    await deleteFromCloudinary(oldPublicId);
  } else if (removeLogo === true || removeLogo === "true") {
    await deleteFromCloudinary(link.logo?.publicId);
    link.logo = { url: null, publicId: null };
  }

  await link.save();

  res
    .status(200)
    .json(new ApiResponse(200, link, "Social media link updated successfully"));
});

// DELETE /api/admin/social-links/:id
const deleteSocialMediaLink = asyncHandler(async (req, res) => {
  const link = await SocialMediaLink.findById(req.params.id);
  if (!link) {
    throw ApiError.notFound("Social media link not found");
  }

  await deleteFromCloudinary(link.logo?.publicId);
  await link.deleteOne();

  res
    .status(200)
    .json(new ApiResponse(200, null, "Social media link deleted successfully"));
});

const reorderSocialMediaLinks = asyncHandler(async (req, res) => {
  const { order } = req.body;

  await Promise.all(
    order.map(({ id, displayOrder }) =>
      SocialMediaLink.updateOne({ _id: id }, { $set: { displayOrder } }),
    ),
  );

  const links = await SocialMediaLink.find({}).sort({
    displayOrder: 1,
    createdAt: -1,
  });
  res
    .status(200)
    .json(new ApiResponse(200, links, "Display order updated successfully"));
});

module.exports = {
  getPublicSocialLinks,
  getAllSocialLinksAdmin,
  getSocialLinkByIdAdmin,
  createSocialMediaLink,
  updateSocialMediaLink,
  deleteSocialMediaLink,
  reorderSocialMediaLinks,
};
