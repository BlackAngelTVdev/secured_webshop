// =============================================================
// Middleware d'authentification
// =============================================================

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

function extractToken(req) {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) return null;
    return authHeader.slice(7);
}

function authMiddleware(req, res, next) {
    const token = extractToken(req);

    if (!token) {
        return res.status(401).json({ error: 'Token manquant' });
    }

    try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.user = payload;
        next();
    } catch (_err) {
        return res.status(401).json({ error: 'Token invalide ou expire' });
    }
}

authMiddleware.requireAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Acces refuse' });
    }
    next();
};

module.exports = authMiddleware;
