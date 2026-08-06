const asyncHandler = require('express-async-handler');
const Order = require('../models/Order.model');
const Product = require('../models/Product.model');
const StoreSettings = require('../models/StoreSettings.model');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { generateOrderWhatsAppLink } = require('../utils/whatsappLink');
const { sendNewOrderAlertEmail } = require('../utils/mailer');

const attachWhatsAppLink = (order) => ({
  ...order.toObject(),
  whatsappLink: generateOrderWhatsAppLink(order),
});

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const restoreOrderStock = async (order) => {
  await Promise.all(
    order.items.map((item) =>
      Product.updateOne(
        { _id: item.product, 'variants.sku': item.variantSku },
        { $inc: { 'variants.$.stock': item.quantity } }
      )
    )
  );
};

const VALID_STATUS_TRANSITIONS = {
  Pending: ['Confirmed', 'Cancelled'],
  Confirmed: ['Shipped', 'Cancelled'],
  Shipped: ['Delivered', 'Cancelled'],
  Delivered: [],
  Cancelled: [],
};

// POST /api/orders (public - attachCustomerIfLoggedIn middleware may set req.customer)
const createOrder = asyncHandler(async (req, res) => {
  const { customer, addressId, shippingAddress, items, paymentMethod } = req.body;

  // Never trust that a manual payment method (JazzCash/EasyPaisa) is actually available just
  // because it's in the enum - the admin may not have configured/activated it yet in StoreSettings.
  if (paymentMethod === 'JazzCash' || paymentMethod === 'EasyPaisa') {
    const settings = await StoreSettings.getSingleton();
    const methodKey = paymentMethod === 'JazzCash' ? 'jazzCash' : 'easyPaisa';
    if (!settings[methodKey].isActive) {
      throw ApiError.badRequest(`${paymentMethod} is not currently available. Please choose a different payment method.`);
    }
  }

  let resolvedAddress = shippingAddress;
  if (addressId) {
    if (!req.customer) {
      throw ApiError.badRequest('You must be logged in to use a saved address');
    }
    const savedAddress = req.customer.addresses.id(addressId);
    if (!savedAddress) {
      throw ApiError.badRequest('Saved address not found');
    }
    resolvedAddress = {
      addressLine: savedAddress.addressLine,
      city: savedAddress.city,
      postalCode: savedAddress.postalCode,
    };
  }

  const orderItems = [];
  const decrementPlan = [];

  for (const item of items) {
    const product = await Product.findById(item.productId);
    if (!product || !product.isActive) {
      throw ApiError.badRequest('One of the products in your order is no longer available');
    }

    const variant = product.variants.id(item.variantId);
    if (!variant) {
      throw ApiError.badRequest(`Selected variant not found for ${product.name}`);
    }

    const quantity = Number(item.quantity);

    orderItems.push({
      product: product._id,
      variantSku: variant.sku,
      productName: product.name,
      color: variant.color,
      size: variant.size,
      fabricStatus: variant.fabricStatus,
      unitPrice: variant.price,
      quantity,
      subtotal: variant.price * quantity,
    });

    decrementPlan.push({
      productId: product._id,
      variantId: variant._id,
      quantity,
      color: variant.color,
      size: variant.size,
    });
  }

  const decremented = [];
  try {
    for (const plan of decrementPlan) {
      const updated = await Product.findOneAndUpdate(
        { _id: plan.productId, 'variants._id': plan.variantId, 'variants.stock': { $gte: plan.quantity } },
        { $inc: { 'variants.$.stock': -plan.quantity } }
      );
      if (!updated) {
        throw ApiError.conflict(`Insufficient stock for ${plan.color} (${plan.size})`);
      }
      decremented.push(plan);
    }

    const subtotal = orderItems.reduce((sum, i) => sum + i.subtotal, 0);
    const minOrderValue = Number(process.env.MIN_ORDER_VALUE) || 0;
    if (subtotal < minOrderValue) {
      throw ApiError.badRequest(`Minimum order value is Rs. ${minOrderValue}`);
    }

    const isKarachi = resolvedAddress.city.trim().toLowerCase() === 'karachi';
    const deliveryCharge = isKarachi ? 0 : Number(process.env.DELIVERY_FLAT_RATE_NON_KARACHI) || 0;

    const order = await Order.create({
      customerAccount: req.customer ? req.customer._id : null,
      customer: {
        name: customer.name,
        phone: customer.phone,
        whatsappNumber: customer.whatsappNumber || customer.phone,
        email: customer.email || null,
      },
      shippingAddress: resolvedAddress,
      items: orderItems,
      pricing: { subtotal, deliveryCharge, totalAmount: subtotal + deliveryCharge },
      isFreeDelivery: isKarachi,
      paymentMethod,
    });

    res.status(201).json(new ApiResponse(201, attachWhatsAppLink(order), 'Order placed successfully'));

    sendNewOrderAlertEmail(order);
  } catch (err) {
    if (decremented.length > 0) {
      await Promise.all(
        decremented.map((plan) =>
          Product.updateOne(
            { _id: plan.productId, 'variants._id': plan.variantId },
            { $inc: { 'variants.$.stock': plan.quantity } }
          )
        )
      );
    }
    throw err;
  }
});

// GET /api/orders/lookup?orderNumber=X&phone=Y (public - guest order tracking, no login needed)
const lookupGuestOrder = asyncHandler(async (req, res) => {
  const { orderNumber, phone } = req.query;

  const order = await Order.findOne({ orderNumber, 'customer.phone': phone });
  if (!order) {
    throw ApiError.notFound('Order not found. Check your order number and phone number.');
  }

  res.status(200).json(new ApiResponse(200, attachWhatsAppLink(order), 'Order fetched'));
});

// PATCH /api/orders/cancel (public - guest cancellation)
const cancelGuestOrder = asyncHandler(async (req, res) => {
  const { orderNumber, phone, cancelReason } = req.body;

  const order = await Order.findOne({ orderNumber, 'customer.phone': phone });
  if (!order) {
    throw ApiError.notFound('Order not found. Check your order number and phone number.');
  }

  if (!order.canBeCancelled) {
    throw ApiError.conflict(`This order can no longer be cancelled (current status: ${order.orderStatus})`);
  }

  await restoreOrderStock(order);

  order.orderStatus = 'Cancelled';
  order.cancelReason = cancelReason || 'Cancelled by customer';
  order.cancelledAt = new Date();
  order.isSeenByAdmin = false; // customer-initiated change - admin needs to notice this
  await order.save();

  res.status(200).json(new ApiResponse(200, attachWhatsAppLink(order), 'Order cancelled successfully'));
});

// GET /api/my-orders (protectCustomer)
const getMyOrders = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.min(50, Math.max(1, Number(limit)));
  const skip = (pageNum - 1) * limitNum;

  const [orders, total] = await Promise.all([
    Order.find({ customerAccount: req.customer._id }).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
    Order.countDocuments({ customerAccount: req.customer._id }),
  ]);

  res.status(200).json(
    new ApiResponse(
      200,
      { orders: orders.map(attachWhatsAppLink), total, page: pageNum, totalPages: Math.ceil(total / limitNum) },
      'Orders fetched'
    )
  );
});

// GET /api/my-orders/:id (protectCustomer)
const getMyOrderById = asyncHandler(async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, customerAccount: req.customer._id });
  if (!order) {
    throw ApiError.notFound('Order not found');
  }
  res.status(200).json(new ApiResponse(200, attachWhatsAppLink(order), 'Order fetched'));
});

// PATCH /api/my-orders/:id/cancel (protectCustomer)
const cancelMyOrder = asyncHandler(async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, customerAccount: req.customer._id });
  if (!order) {
    throw ApiError.notFound('Order not found');
  }

  if (!order.canBeCancelled) {
    throw ApiError.conflict(`This order can no longer be cancelled (current status: ${order.orderStatus})`);
  }

  await restoreOrderStock(order);

  order.orderStatus = 'Cancelled';
  order.cancelReason = req.body.cancelReason || 'Cancelled by customer';
  order.cancelledAt = new Date();
  order.isSeenByAdmin = false; // customer-initiated change - admin needs to notice this
  await order.save();

  res.status(200).json(new ApiResponse(200, attachWhatsAppLink(order), 'Order cancelled successfully'));
});

// GET /api/admin/orders
const getAllOrdersAdmin = asyncHandler(async (req, res) => {
  const { status, search, page = 1, limit = 20 } = req.query;

  const query = {};
  if (status) query.orderStatus = status;
  if (search) {
    const safeSearch = escapeRegex(search);
    query.$or = [
      { orderNumber: new RegExp(safeSearch, 'i') },
      { 'customer.phone': new RegExp(safeSearch, 'i') },
      { 'customer.name': new RegExp(safeSearch, 'i') },
    ];
  }

  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.min(100, Math.max(1, Number(limit)));
  const skip = (pageNum - 1) * limitNum;

  const [orders, total] = await Promise.all([
    Order.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
    Order.countDocuments(query),
  ]);

  res.status(200).json(
    new ApiResponse(
      200,
      { orders: orders.map(attachWhatsAppLink), total, page: pageNum, totalPages: Math.ceil(total / limitNum) },
      'Orders fetched'
    )
  );
});

// GET /api/admin/orders/:id
const getOrderByIdAdmin = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) {
    throw ApiError.notFound('Order not found');
  }

  // Opening the order detail is a natural "admin has seen this" signal for the dashboard badge
  if (!order.isSeenByAdmin) {
    order.isSeenByAdmin = true;
    await order.save();
  }

  res.status(200).json(new ApiResponse(200, attachWhatsAppLink(order), 'Order fetched'));
});

// GET /api/admin/orders/notifications/count
const getUnseenOrdersCount = asyncHandler(async (req, res) => {
  const count = await Order.countDocuments({ isSeenByAdmin: false });
  res.status(200).json(new ApiResponse(200, { count }, 'Unseen order count fetched'));
});

// PATCH /api/admin/orders/:id/mark-seen
const markOrderSeen = asyncHandler(async (req, res) => {
  const order = await Order.findByIdAndUpdate(req.params.id, { isSeenByAdmin: true }, { new: true });
  if (!order) {
    throw ApiError.notFound('Order not found');
  }
  res.status(200).json(new ApiResponse(200, attachWhatsAppLink(order), 'Order marked as seen'));
});

// PATCH /api/admin/orders/:id/status
const updateOrderStatus = asyncHandler(async (req, res) => {
  const { orderStatus, adminNotes, cancelReason } = req.body;

  const order = await Order.findById(req.params.id);
  if (!order) {
    throw ApiError.notFound('Order not found');
  }

  if (orderStatus && orderStatus !== order.orderStatus) {
    const allowedNextStatuses = VALID_STATUS_TRANSITIONS[order.orderStatus] || [];
    if (!allowedNextStatuses.includes(orderStatus)) {
      throw ApiError.conflict(`Cannot change status from ${order.orderStatus} to ${orderStatus}`);
    }

    if (orderStatus === 'Cancelled') {
      await restoreOrderStock(order);
      order.cancelReason = cancelReason || 'Cancelled by admin';
      order.cancelledAt = new Date();
    }

    order.orderStatus = orderStatus;
  }

  if (adminNotes !== undefined) {
    order.adminNotes = adminNotes;
  }

  await order.save();

  res.status(200).json(new ApiResponse(200, attachWhatsAppLink(order), 'Order updated successfully'));
});

module.exports = {
  createOrder,
  lookupGuestOrder,
  cancelGuestOrder,
  getMyOrders,
  getMyOrderById,
  cancelMyOrder,
  getAllOrdersAdmin,
  getOrderByIdAdmin,
  getUnseenOrdersCount,
  markOrderSeen,
  updateOrderStatus,
};