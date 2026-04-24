const db = require('../config/db');
const { sendError, sendSuccess } = require('../utils/apiResponse');

module.exports = {

    // ----------------------------------------------------------
    // GET /api/admin/users
    // ----------------------------------------------------------
    getUsers: (_req, res) => {
        db.query('SELECT id, username, email, role, address FROM users', (err, results) => {
            if (err) {
                return sendError(res, 500, 'Erreur serveur', 'DB_QUERY_ERROR');
            }
            return sendSuccess(res, results);
        });
    }
};
