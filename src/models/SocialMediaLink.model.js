const mongoose = require("mongoose");

const MAX_ACTIVE_SOCIAL_LINKS = 6;
const SUPPORTED_SOCIAL_ICONS = [
  "facebook",
  "instagram",
  "x",
  "tiktok",
  "youtube",
  "threads",
  "pinterest",
  "linkedin",
  "snapchat",
  "whatsapp",
  "telegram",
  "link",
];

const socialMediaLinkSchema = new mongoose.Schema(
  {
    platformName: {
      type: String,
      required: [true, "Platform name is required"],
      trim: true,
      maxlength: [40, "Platform name cannot exceed 40 characters"],
    },
    iconName: {
      type: String,
      required: [true, "An icon is required"],
      enum: {
        values: SUPPORTED_SOCIAL_ICONS,
        message: "Unsupported icon - choose one of the standard platform icons",
      },
      default: "link",
    },
    logo: {
      url: { type: String, default: null },
      publicId: { type: String, default: null },
    },
    targetUrl: {
      type: String,
      required: [true, "Target URL is required"],
      trim: true,
      match: [/^https?:\/\/.+/i, "Target URL must be a full http(s) URL"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // Controls Footer icon order - lower number shows first, same convention as
    // Category.displayOrder.
    displayOrder: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

socialMediaLinkSchema.pre("save", async function (next) {
  if (this.isActive && this.isModified("isActive")) {
    const activeCount = await mongoose
      .model("SocialMediaLink")
      .countDocuments({ isActive: true, _id: { $ne: this._id } });

    if (activeCount >= MAX_ACTIVE_SOCIAL_LINKS) {
      return next(
        new Error(
          `Cannot have more than ${MAX_ACTIVE_SOCIAL_LINKS} active social media links at once.`,
        ),
      );
    }
  }
  next();
});

socialMediaLinkSchema.index({ isActive: 1, displayOrder: 1 });

const SocialMediaLink = mongoose.model(
  "SocialMediaLink",
  socialMediaLinkSchema,
);
SocialMediaLink.MAX_ACTIVE_LINKS = MAX_ACTIVE_SOCIAL_LINKS;
SocialMediaLink.SUPPORTED_ICONS = SUPPORTED_SOCIAL_ICONS;

module.exports = SocialMediaLink;
