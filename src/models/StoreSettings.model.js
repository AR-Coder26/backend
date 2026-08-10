const mongoose = require("mongoose");

const paymentAccountSchema = new mongoose.Schema(
  {
    accountTitle: { type: String, trim: true, maxlength: 100, default: "" },
    accountNumber: { type: String, trim: true, maxlength: 30, default: "" },
    instructions: { type: String, trim: true, maxlength: 500, default: "" },
    isActive: { type: Boolean, default: false },
  },
  { _id: false },
);

// Bank transfer needs two things a mobile wallet account doesn't: which bank it is, and an
// optional IBAN (commonly requested for interbank/online fund transfers in Pakistan - IBFT).
const bankAccountSchema = new mongoose.Schema(
  {
    bankName: { type: String, trim: true, maxlength: 100, default: "" },
    accountTitle: { type: String, trim: true, maxlength: 100, default: "" },
    accountNumber: { type: String, trim: true, maxlength: 30, default: "" },
    iban: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 34,
      default: "",
      match: [
        /^$|^PK\d{2}[A-Z]{4}\d{16}$/,
        "IBAN must be a valid Pakistani IBAN (e.g. PK36MEZN0001234567890123)",
      ],
    },
    instructions: { type: String, trim: true, maxlength: 500, default: "" },
    isActive: { type: Boolean, default: false },
  },
  { _id: false },
);

const storeSettingsSchema = new mongoose.Schema(
  {
    jazzCash: { type: paymentAccountSchema, default: () => ({}) },
    easyPaisa: { type: paymentAccountSchema, default: () => ({}) },
    bankTransfer: { type: bankAccountSchema, default: () => ({}) },

    minOrderValue: {
      type: Number,
      default: 0,
      min: [0, "Minimum order value cannot be negative"],
    },
    deliveryFlatRateNonKarachi: {
      type: Number,
      default: 200,
      min: [0, "Delivery charge cannot be negative"],
    },
  },
  { timestamps: true },
);

// Singleton accessor - this collection should only ever contain ONE document. Every read/write
// path in the app goes through this instead of Model.find()/findById(), so there's no risk of
// accidentally creating a second settings document somewhere.
storeSettingsSchema.statics.getSingleton = async function () {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

module.exports = mongoose.model("StoreSettings", storeSettingsSchema);
