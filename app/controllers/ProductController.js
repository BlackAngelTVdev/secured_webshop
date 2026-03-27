const db = require('../config/db');

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
                return res.status(500).json({ error: 'Impossible de charger les produits.' });
            }

            return res.json(rows);
        });
    }
};
