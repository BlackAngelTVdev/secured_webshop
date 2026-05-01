const db = require('../config/db');
const { sendError, sendSuccess } = require('../utils/apiResponse');

module.exports = {

    // ----------------------------------------------------------
    // GET /api/admin/users
    // ----------------------------------------------------------
    getUsers: (_req, res) => {
        db.query(
            'SELECT id, username, email, role, address, failed_login_attempts, account_locked, account_locked_at FROM users',
            (err, results) => {
                if (err) {
                    return sendError(res, 500, 'Erreur serveur', 'DB_QUERY_ERROR');
                }
                return sendSuccess(res, results);
            }
        );
    },

    // ----------------------------------------------------------
    // POST /api/admin/users/:id/unlock
    // ----------------------------------------------------------
    unlockUser: (req, res) => {
        const userId = Number(req.params.id);

        if (!Number.isInteger(userId) || userId <= 0) {
            return sendError(res, 400, 'Identifiant utilisateur invalide', 'ADMIN_BAD_USER_ID');
        }

        db.query(
            'UPDATE users SET failed_login_attempts = 0, account_locked = 0, account_locked_at = NULL WHERE id = ?',
            [userId],
            (err, result) => {
                if (err) {
                    return sendError(res, 500, 'Erreur serveur', 'DB_QUERY_ERROR');
                }

                if (!result || result.affectedRows === 0) {
                    return sendError(res, 404, 'Utilisateur introuvable', 'ADMIN_USER_NOT_FOUND');
                }

                return sendSuccess(res, { message: 'Compte deblque avec succes' });
            }
        );
    }
};
