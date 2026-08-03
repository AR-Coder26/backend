const express = require('express');
const { getMyAddresses, addMyAddress, updateMyAddress, deleteMyAddress } = require('../controllers/customerAddress.controller');
const { protectCustomer } = require('../middleware/auth.middleware');
const validateRequest = require('../middleware/validateRequest');
const { addAddressValidator, updateAddressValidator, addressIdValidator } = require('../validators/address.validator');

const router = express.Router();

router.use(protectCustomer);

router.get('/', getMyAddresses);
router.post('/', addAddressValidator, validateRequest, addMyAddress);
router.put('/:addressId', updateAddressValidator, validateRequest, updateMyAddress);
router.delete('/:addressId', addressIdValidator, validateRequest, deleteMyAddress);

module.exports = router;