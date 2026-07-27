const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    // TODO: Add fields — name, email, password, role, phone, avatar, shippingAddress,
    //       isActive, refreshToken, resetPasswordToken, resetPasswordExpire, etc.
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);

