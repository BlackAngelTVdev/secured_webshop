const express    = require('express');
const multer     = require('multer');
const path       = require('path');
const fs         = require('fs');
const router     = express.Router();
const controller = require('../controllers/ProfileController');
const auth       = require('../middleware/auth');

// Configuration de multer pour l'upload de photos
const uploadDirectory = path.join(__dirname, '../public/uploads');
fs.mkdirSync(uploadDirectory, { recursive: true });

const storage = multer.diskStorage({
    destination: uploadDirectory,
    filename: (_req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

router.get('/',      auth, controller.get);
router.post('/',     auth, controller.update);
router.post('/photo', auth, upload.single('photo'), controller.uploadPhoto);

module.exports = router;
