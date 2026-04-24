const db = require('../config/db');
const { sendError, sendSuccess } = require('../utils/apiResponse');

module.exports = {
    list: (req, res) => {
        const sql = `
            SELECT id, name, description, price, image_url
            FROM products
            ORDER BY id ASC
        `;

        db.query(sql, (err, rows) => {
            if (err) {
                console.error('Erreur lors de la lecture des produits:', err);
                return sendError(res, 500, 'Impossible de charger les produits.', 'DB_QUERY_ERROR');
            }

            return sendSuccess(res, rows);
        });
    }
};
