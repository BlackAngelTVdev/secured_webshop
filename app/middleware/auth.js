// =============================================================
// Middleware d'authentification
// =============================================================

const jwt = require('jsonwebtoken');
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
        req.user = payload;
        next();
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
