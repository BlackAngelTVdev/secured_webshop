const db = require('../config/db');
const { sendError, sendSuccess } = require('../utils/apiResponse');

module.exports = {

    // ----------------------------------------------------------
    // GET /api/profile
    // ----------------------------------------------------------
    get: (req, res) => {
        const userId = req.user.id;

        db.query('SELECT id, username, email, role, address, photo_path FROM users WHERE id = ?', [userId], (err, results) => {
            if (err) {
                return sendError(res, 500, 'Erreur serveur', 'DB_QUERY_ERROR');
            }
            if (results.length === 0) {
                return sendError(res, 404, 'Utilisateur introuvable', 'USER_NOT_FOUND');
            }
            return sendSuccess(res, results[0]);
        });
    },

    // ----------------------------------------------------------
    // POST /api/profile
    // ----------------------------------------------------------
    update: (req, res) => {
        const userId = req.user.id;
        const { address } = req.body;

        db.query('UPDATE users SET address = ? WHERE id = ?', [address, userId], (err) => {
            if (err) {
                return sendError(res, 500, 'Erreur serveur', 'DB_QUERY_ERROR');
            }
            return sendSuccess(res, { message: 'Profil mis a jour' });
        });
    },

    // ----------------------------------------------------------
    // POST /api/profile/photo
    // ----------------------------------------------------------
    uploadPhoto: (req, res) => {
        const userId = req.user.id;

        if (!req.file) {
            return sendError(res, 400, 'Aucun fichier recu', 'UPLOAD_FILE_MISSING');
        }

        const photoPath = '/uploads/' + req.file.filename;

        db.query('UPDATE users SET photo_path = ? WHERE id = ?', [photoPath, userId], (err) => {
            if (err) {
                return sendError(res, 500, 'Erreur serveur', 'DB_QUERY_ERROR');
            }
            return sendSuccess(res, { message: 'Photo mise a jour', photo_path: photoPath });
        });
    }
};
