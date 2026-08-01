const express = require('express');
const rateLimit = require('express-rate-limit');
const { createOrder, lookupGuestOrder, cancelGuestOrder } = require('../controllers/order.controller');
const { attachCustomerIfLoggedIn } = require('../middleware/auth.middleware');
const validateRequest = require('../middleware/validateRequest');
const {
  createOrderValidator,
  guestOrderLookupValidator,
  guestOrderCancelValidator,
} = require('../validators/order.validator');

const router = express.Router();

const orderCreateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many orders placed. Please try again later.' },
});

router.post('/', orderCreateLimiter, attachCustomerIfLoggedIn, createOrderValidator, validateRequest, createOrder);
router.get('/lookup', guestOrderLookupValidator, validateRequest, lookupGuestOrder);
router.patch('/cancel', guestOrderCancelValidator, validateRequest, cancelGuestOrder);

module.exports = router;