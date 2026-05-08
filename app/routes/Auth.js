const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/AuthController');
const ssoController = require('../controllers/SsoController');
const loginRateLimit = require('../middleware/loginRateLimit');

// JWT-based authentication routes (local)
router.post('/login',    loginRateLimit, controller.login);
router.post('/register', controller.register);
router.post('/refresh', controller.refresh);

// SSO Bridge authentication routes (OAuth portal)
router.get('/sso/status',    ssoController.status);
router.get('/sso/login',     ssoController.loginRedirect);
router.get('/sso/callback',  ssoController.callback);
router.get('/sso/logout',    ssoController.logout);

module.exports = router;
