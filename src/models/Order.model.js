const mongoose = require('mongoose');

const PAYMENT_METHODS = ['COD', 'JazzCash', 'EasyPaisa'];
const ORDER_STATUSES = ['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'];

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    variantSku: {
      type: String,
      required: true,
    },
    productName: {
      type: String,
      required: true,
    },
    color: { type: String, required: true },
    size: { type: String, required: true },
    fabricStatus: { type: String, required: true },
    unitPrice: {
      type: Number,
      required: true,
      min: [0, 'Unit price cannot be negative'],
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be at least 1'],
    },
    subtotal: {
      type: Number,
      required: true,
      min: [0, 'Subtotal cannot be negative'],
    },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      unique: true,
      index: true,
    },
    // null for guest checkout orders; populated with the logged-in customer's _id when they order while signed in.
    // The 'customer' snapshot object below is still always filled in either way - see the note above this schema.
    customerAccount: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      default: null,
      index: true,
    },
    customer: {
      name: { type: String, required: [true, 'Customer name is required'], trim: true },
      phone: {
        type: String,
        required: [true, 'Customer phone number is required'],
        trim: true,
        match: [/^(\+92|0)3\d{9}$/, 'Please provide a valid Pakistani mobile number'],
      },
      whatsappNumber: {
        type: String,
        trim: true,
        match: [/^(\+92|0)3\d{9}$/, 'Please provide a valid Pakistani WhatsApp number'],
      },
      email: {
        type: String,
        trim: true,
        lowercase: true,
        default: null,
      },
    },
    shippingAddress: {
      addressLine: { type: String, required: [true, 'Address is required'], trim: true },
      city: { type: String, required: [true, 'City is required'], trim: true },
      postalCode: { type: String, trim: true, default: null },
    },
    items: {
      type: [orderItemSchema],
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length > 0,
        message: 'Order must contain at least one item',
      },
    },
    pricing: {
      subtotal: { type: Number, required: true, min: 0 },
      deliveryCharge: { type: Number, required: true, min: 0, default: 0 },
      totalAmount: { type: Number, required: true, min: 0 },
    },
    isFreeDelivery: {
      type: Boolean,
      default: false, // true when city === Karachi, per current business rule
    },
    paymentMethod: {
      type: String,
      required: [true, 'Payment method is required'],
      enum: { values: PAYMENT_METHODS, message: '{VALUE} is not a supported payment method' },
    },
    paymentProof: {
      url: { type: String, default: null },
      publicId: { type: String, default: null }, // screenshot proof for manual JazzCash/EasyPaisa transfers
    },
    orderStatus: {
      type: String,
      enum: { values: ORDER_STATUSES, message: '{VALUE} is not a valid order status' },
      default: 'Pending',
      index: true,
    },
    cancelReason: {
      type: String,
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    adminNotes: {
      type: String,
      default: '',
    },
    isSeenByAdmin: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

// Human-readable, sortable order number: ORD-20260728-0001
orderSchema.pre('save', async function (next) {
  if (!this.isNew) return next();

  const OrderModel = this.constructor;
  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
    now.getDate()
  ).padStart(2, '0')}`;

  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  const countToday = await OrderModel.countDocuments({
    createdAt: { $gte: startOfDay, $lte: endOfDay },
  });

  const sequence = String(countToday + 1).padStart(4, '0');
  this.orderNumber = `ORD-${datePart}-${sequence}`;

  next();
});

// SECURITY-CRITICAL: recompute pricing from the actual items array on every save.
// Never trust a subtotal/total sent from the client — always derive it server-side.
orderSchema.pre('save', function (next) {
  if (this.isModified('items') || this.isNew) {
    const computedSubtotal = this.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    this.pricing.subtotal = computedSubtotal;
    this.pricing.totalAmount = computedSubtotal + (this.pricing.deliveryCharge || 0);
  }
  next();
});

// Business rule: customer can cancel any time before the order is marked Delivered
orderSchema.virtual('canBeCancelled').get(function () {
  return !['Delivered', 'Cancelled'].includes(this.orderStatus);
});

orderSchema.set('toJSON', { virtuals: true });
orderSchema.set('toObject', { virtuals: true });

orderSchema.index({ 'customer.phone': 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ customerAccount: 1, createdAt: -1 });

module.exports = mongoose.model('Order', orderSchema);