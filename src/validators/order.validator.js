const { body, param, query } = require('express-validator');

const createOrderValidator = [
  body('customer.name').trim().notEmpty().withMessage('Customer name is required'),
  body('customer.phone')
    .trim()
    .matches(/^(\+92|0)3\d{9}$/)
    .withMessage('Provide a valid Pakistani phone number'),
  body('customer.whatsappNumber')
    .optional({ checkFalsy: true })
    .matches(/^(\+92|0)3\d{9}$/)
    .withMessage('Provide a valid Pakistani WhatsApp number'),
  body('customer.email').optional({ checkFalsy: true }).isEmail().withMessage('Provide a valid email'),
  body('addressId').optional().isMongoId().withMessage('Invalid saved address ID'),
  body('shippingAddress').custom((value, { req }) => {
    if (req.body.addressId) return true;
    if (!value || !value.addressLine || !value.city) {
      throw new Error('Shipping address (addressLine, city) is required when not using a saved address');
    }
    return true;
  }),
  body('items').isArray({ min: 1 }).withMessage('Order must contain at least one item'),
  body('items.*.productId').isMongoId().withMessage('Invalid product ID'),
  body('items.*.variantId').isMongoId().withMessage('Invalid variant ID'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('paymentMethod').isIn(['COD', 'JazzCash', 'EasyPaisa']).withMessage('Invalid payment method'),
];

const guestOrderLookupValidator = [
  query('orderNumber').trim().notEmpty().withMessage('Order number is required'),
  query('phone').trim().notEmpty().withMessage('Phone number is required'),
];

const guestOrderCancelValidator = [
  body('orderNumber').trim().notEmpty().withMessage('Order number is required'),
  body('phone').trim().notEmpty().withMessage('Phone number is required'),
];

const orderIdValidator = [param('id').isMongoId().withMessage('Invalid order ID')];

const updateOrderStatusValidator = [
  param('id').isMongoId().withMessage('Invalid order ID'),
  body('orderStatus').optional().isIn(['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled']),
  body('adminNotes').optional().isString(),
];

module.exports = {
  createOrderValidator,
  guestOrderLookupValidator,
  guestOrderCancelValidator,
  orderIdValidator,
  updateOrderStatusValidator,
};