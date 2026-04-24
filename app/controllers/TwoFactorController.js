const crypto = require('crypto');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const db = require('../config/db');
const jwt = require('jsonwebtoken');
const { sendError, sendSuccess } = require('../utils/apiResponse');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const PENDING_SETUP_TTL_MS = 10 * 60 * 1000;

const loginChallenges = new Map();
const pendingSetups = new Map();

function signToken(user) {
    return jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: '2h' }
    );
}

function cleanupExpiredEntries() {
    const now = Date.now();

    for (const [challengeId, challenge] of loginChallenges.entries()) {
        if (challenge.expiresAt <= now) {
            loginChallenges.delete(challengeId);
        }
    }

    for (const [userId, setup] of pendingSetups.entries()) {
        if (setup.expiresAt <= now) {
            pendingSetups.delete(userId);
        }
    }
}

setInterval(cleanupExpiredEntries, 60 * 1000).unref();

const TwoFactorController = {
    createLoginChallenge: (user) => {
        const challengeId = `2fa_${crypto.randomUUID()}`;

        loginChallenges.set(challengeId, {
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role
            },
            secret: user.two_fa_secret,
            expiresAt: Date.now() + CHALLENGE_TTL_MS
        });

        return challengeId;
    },

    verifyLoginChallenge: (req, res) => {
        const { challengeId, code } = req.body;

        if (!challengeId || !code) {
            return sendError(res, 400, 'Challenge et code 2FA requis', 'AUTH_2FA_BAD_REQUEST');
        }

        const challenge = loginChallenges.get(challengeId);
        if (!challenge) {
            return sendError(res, 401, 'Challenge 2FA invalide ou expire', 'AUTH_2FA_CHALLENGE_INVALID');
        }

        if (challenge.expiresAt <= Date.now()) {
            loginChallenges.delete(challengeId);
            return sendError(res, 401, 'Challenge 2FA invalide ou expire', 'AUTH_2FA_CHALLENGE_EXPIRED');
        }

        const verified = speakeasy.totp.verify({
            secret: challenge.secret,
            encoding: 'base32',
            token: String(code).replace(/\s+/g, ''),
            window: 1
        });

        if (!verified) {
            return sendError(res, 401, 'Code 2FA invalide', 'AUTH_2FA_INVALID_CODE');
        }

        loginChallenges.delete(challengeId);
        const token = signToken(challenge.user);

        return sendSuccess(res, {
            message: 'Connexion 2FA reussie',
            token,
            user: challenge.user
        });
    },

    setup: (req, res) => {
        const userId = req.user && req.user.id;
        if (!userId) {
            return sendError(res, 401, 'Utilisateur non authentifie', 'AUTH_TOKEN_INVALID');
        }

        db.query('SELECT email FROM users WHERE id = ?', [userId], (err, results) => {
            if (err) {
                return sendError(res, 500, 'Erreur serveur', 'DB_QUERY_ERROR');
            }

            if (!results || results.length === 0) {
                return sendError(res, 404, 'Utilisateur introuvable', 'AUTH_USER_NOT_FOUND');
            }

            const userEmail = results[0].email;
            const secret = speakeasy.generateSecret({
                name: `SecureShop (${userEmail})`,
                issuer: 'SecureShop',
                length: 20
            });

            pendingSetups.set(userId, {
                secret: secret.base32,
                expiresAt: Date.now() + PENDING_SETUP_TTL_MS
            });

            qrcode.toDataURL(secret.otpauth_url, (qrError, qrCodeDataUrl) => {
                if (qrError) {
                    return sendError(res, 500, 'Impossible de generer le QR code', 'AUTH_2FA_QR_GENERATION_ERROR');
                }

                return sendSuccess(res, {
                    message: 'Configuration 2FA prete',
                    secret: secret.base32,
                    otpauthUrl: secret.otpauth_url,
                    qrCodeDataUrl,
                    expiresInSeconds: Math.floor(PENDING_SETUP_TTL_MS / 1000)
                });
            });
        });
    },

    enable: (req, res) => {
        const userId = req.user && req.user.id;
        const { code } = req.body;

        if (!userId) {
            return sendError(res, 401, 'Utilisateur non authentifie', 'AUTH_TOKEN_INVALID');
        }

        if (!code) {
            return sendError(res, 400, 'Code 2FA requis', 'AUTH_2FA_BAD_REQUEST');
        }

        const pendingSetup = pendingSetups.get(userId);
        if (!pendingSetup) {
            return sendError(res, 400, 'Configuration 2FA non preparee', 'AUTH_2FA_SETUP_MISSING');
        }

        if (pendingSetup.expiresAt <= Date.now()) {
            pendingSetups.delete(userId);
            return sendError(res, 400, 'Configuration 2FA expiree. Relancez la preparation.', 'AUTH_2FA_SETUP_EXPIRED');
        }

        const verified = speakeasy.totp.verify({
            secret: pendingSetup.secret,
            encoding: 'base32',
            token: String(code).replace(/\s+/g, ''),
            window: 1
        });

        if (!verified) {
            return sendError(res, 401, 'Code 2FA invalide', 'AUTH_2FA_INVALID_CODE');
        }

        db.query(
            'UPDATE users SET two_fa_enabled = 1, two_fa_secret = ? WHERE id = ?',
            [pendingSetup.secret, userId],
            (err) => {
                if (err) {
                    return sendError(res, 500, 'Erreur serveur', 'DB_QUERY_ERROR');
                }

                pendingSetups.delete(userId);
                return sendSuccess(res, { message: '2FA activee avec succes' });
            }
        );
    },

    disable: (req, res) => {
        const userId = req.user && req.user.id;
        const { code } = req.body;

        if (!userId) {
            return sendError(res, 401, 'Utilisateur non authentifie', 'AUTH_TOKEN_INVALID');
        }

        if (!code) {
            return sendError(res, 400, 'Code 2FA requis', 'AUTH_2FA_BAD_REQUEST');
        }

        db.query('SELECT two_fa_enabled, two_fa_secret FROM users WHERE id = ?', [userId], (err, results) => {
            if (err) {
                return sendError(res, 500, 'Erreur serveur', 'DB_QUERY_ERROR');
            }

            if (!results || results.length === 0) {
                return sendError(res, 404, 'Utilisateur introuvable', 'AUTH_USER_NOT_FOUND');
            }

            const user = results[0];
            if (!user.two_fa_enabled || !user.two_fa_secret) {
                return sendError(res, 400, 'La 2FA est deja desactivee', 'AUTH_2FA_ALREADY_DISABLED');
            }

            const verified = speakeasy.totp.verify({
                secret: user.two_fa_secret,
                encoding: 'base32',
                token: String(code).replace(/\s+/g, ''),
                window: 1
            });

            if (!verified) {
                return sendError(res, 401, 'Code 2FA invalide', 'AUTH_2FA_INVALID_CODE');
            }

            db.query('UPDATE users SET two_fa_enabled = 0, two_fa_secret = NULL WHERE id = ?', [userId], (updateErr) => {
                if (updateErr) {
                    return sendError(res, 500, 'Erreur serveur', 'DB_QUERY_ERROR');
                }

                pendingSetups.delete(userId);
                return sendSuccess(res, { message: '2FA desactivee avec succes' });
            });
        });
    },

    status: (req, res) => {
        const userId = req.user && req.user.id;
        if (!userId) {
            return sendError(res, 401, 'Utilisateur non authentifie', 'AUTH_TOKEN_INVALID');
        }

        db.query('SELECT two_fa_enabled FROM users WHERE id = ?', [userId], (err, results) => {
            if (err) {
                return sendError(res, 500, 'Erreur serveur', 'DB_QUERY_ERROR');
            }

            if (!results || results.length === 0) {
                return sendError(res, 404, 'Utilisateur introuvable', 'AUTH_USER_NOT_FOUND');
            }

            return sendSuccess(res, {
                enabled: Boolean(results[0].two_fa_enabled)
            });
        });
    }
};

module.exports = TwoFactorController;
