const express = require('express');
const router = express.Router();
const controller = require('../controllers/TwoFactorController');
const auth = require('../middleware/auth');

router.post('/verify', controller.verifyLoginChallenge);
router.get('/setup', auth, controller.setup);
router.post('/enable', auth, controller.enable);
router.post('/disable', auth, controller.disable);
router.get('/status', auth, controller.status);

module.exports = router;