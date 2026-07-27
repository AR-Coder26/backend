const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
  {
    // TODO: Add fields — user, items, shippingAddress, paymentInfo, totalPrice,
    //       status, isPaid, paidAt, isDelivered, deliveredAt, etc.
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', orderSchema);

