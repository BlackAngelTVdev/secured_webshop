// =============================================================
// Middleware d'authentification
// =============================================================

const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { sendError } = require('../utils/apiResponse');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

function extractToken(req) {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) return null;
    return authHeader.slice(7);
}

function authMiddleware(req, res, next) {
    const token = extractToken(req);

    if (!token) {
        return sendError(res, 401, 'Token manquant', 'AUTH_TOKEN_MISSING');
    }

    try {
        const payload = jwt.verify(token, JWT_SECRET);
        db.query('SELECT id, role, account_locked FROM users WHERE id = ?', [payload.id], (err, results) => {
            if (err) {
                return sendError(res, 500, 'Erreur serveur', 'DB_QUERY_ERROR');
            }

            if (!results || results.length === 0) {
                return sendError(res, 401, 'Token invalide ou expire', 'AUTH_TOKEN_INVALID');
            }

            const currentUser = results[0];
            if (Number(currentUser.account_locked) === 1) {
                return sendError(res, 423, 'Compte verrouille. Contactez un administrateur.', 'AUTH_ACCOUNT_LOCKED');
            }

            req.user = {
                ...payload,
                role: currentUser.role
            };
            next();
        });
    } catch (_err) {
        return sendError(res, 401, 'Token invalide ou expire', 'AUTH_TOKEN_INVALID');
    }
}

authMiddleware.requireAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return sendError(res, 403, 'Acces refuse', 'AUTH_FORBIDDEN');
    }
    next();
};

module.exports = authMiddleware;
