const mongoose = require('mongoose');

const paymentAccountSchema = new mongoose.Schema(
  {
    accountTitle: { type: String, trim: true, maxlength: 100, default: '' },
    accountNumber: { type: String, trim: true, maxlength: 30, default: '' },
    instructions: { type: String, trim: true, maxlength: 500, default: '' },
    // Starts false on purpose - an empty/half-filled account should never be shown to customers
    // at checkout just because the document exists. Admin explicitly flips this on once real
    // details are entered (enforced in the controller, not here).
    isActive: { type: Boolean, default: false },
  },
  { _id: false }
);

const storeSettingsSchema = new mongoose.Schema(
  {
    jazzCash: { type: paymentAccountSchema, default: () => ({}) },
    easyPaisa: { type: paymentAccountSchema, default: () => ({}) },
  },
  { timestamps: true }
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

module.exports = mongoose.model('StoreSettings', storeSettingsSchema);