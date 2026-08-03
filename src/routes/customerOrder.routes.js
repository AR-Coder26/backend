const express = require('express');
const { getMyOrders, getMyOrderById, cancelMyOrder } = require('../controllers/order.controller');
const { protectCustomer } = require('../middleware/auth.middleware');
const validateRequest = require('../middleware/validateRequest');
const { orderIdValidator, customerCancelValidator } = require('../validators/order.validator');

const router = express.Router();

router.use(protectCustomer);

router.get('/', getMyOrders);
router.get('/:id', orderIdValidator, validateRequest, getMyOrderById);
router.patch('/:id/cancel', customerCancelValidator, validateRequest, cancelMyOrder);

module.exports = router;