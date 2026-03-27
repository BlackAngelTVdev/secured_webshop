const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/AuthController');
const loginRateLimit = require('../middleware/loginRateLimit');

router.post('/login',    loginRateLimit, controller.login);
router.post('/register', controller.register);

module.exports = router;
