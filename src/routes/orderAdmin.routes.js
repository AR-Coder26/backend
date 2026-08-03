const express = require('express');
const {
  getAllOrdersAdmin,
  getOrderByIdAdmin,
  getUnseenOrdersCount,
  markOrderSeen,
  updateOrderStatus,
} = require('../controllers/order.controller');
const { protectAdmin } = require('../middleware/auth.middleware');
const validateRequest = require('../middleware/validateRequest');
const { orderIdValidator, updateOrderStatusValidator } = require('../validators/order.validator');

const router = express.Router();

router.use(protectAdmin);

router.get('/', getAllOrdersAdmin);

router.get('/notifications/count', getUnseenOrdersCount);

router.get('/:id', orderIdValidator, validateRequest, getOrderByIdAdmin);
router.patch('/:id/status', updateOrderStatusValidator, validateRequest, updateOrderStatus);
router.patch('/:id/mark-seen', orderIdValidator, validateRequest, markOrderSeen);

module.exports = router;