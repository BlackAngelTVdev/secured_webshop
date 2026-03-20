const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/AdminController');
const auth       = require('../middleware/auth');

router.get('/users', auth, auth.requireAdmin, controller.getUsers);

module.exports = router;
