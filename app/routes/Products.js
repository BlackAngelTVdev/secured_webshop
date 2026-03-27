const express = require('express');

const router = express.Router();
const controller = require('../controllers/ProductController');

router.get('/', controller.list);

module.exports = router;
