const WINDOW_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;
const { sendError } = require('../utils/apiResponse');

// Fenetre et limite de tentatives par IP.

// Stockage en memoire: suffisant pour un exercice/local, a remplacer par Redis en prod.
const attemptsByIp = new Map();

// Supprime les compteurs dont la fenetre est terminee.
function cleanupExpired(now) {
    for (const [ip, entry] of attemptsByIp.entries()) {
        if (entry.resetTime <= now) {
            attemptsByIp.delete(ip);
        }
    }
}

module.exports = (req, res, next) => {
    const now = Date.now();
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';

    // Evite que la map grossisse indefiniment.
    cleanupExpired(now);

    const existing = attemptsByIp.get(ip);
    if (!existing || existing.resetTime <= now) {
        // Premiere tentative (ou nouvelle fenetre): on initialise le compteur.
        attemptsByIp.set(ip, { count: 1, resetTime: now + WINDOW_MS });
        return next();
    }

    if (existing.count >= MAX_ATTEMPTS) {
        // Trop de tentatives: on bloque temporairement cette IP.
        const retryAfterSeconds = Math.ceil((existing.resetTime - now) / 1000);
        res.set('Retry-After', String(retryAfterSeconds));
        return sendError(res, 429, 'Trop de tentatives de connexion. Reessayez dans une minute.', 'AUTH_RATE_LIMIT');
    }

    // Tentative autorisee: on incremente et on laisse passer.
    existing.count += 1;
    attemptsByIp.set(ip, existing);
    next();
};
