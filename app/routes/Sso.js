const express = require('express');
const router = express.Router();
const ssoController = require('../controllers/SsoController');

// Direct SSO routes (accessible at /sso/*)
// Also available via /api/auth/sso/* for API consistency

router.get('/status',    ssoController.status);
router.get('/login',     ssoController.loginRedirect);
router.get('/callback',  ssoController.callback);
router.get('/tokens',    ssoController.getTokens);
router.get('/logout',    ssoController.logout);

module.exports = router;
