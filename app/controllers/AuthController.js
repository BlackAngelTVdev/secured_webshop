const db = require('../config/db');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { sendError, sendSuccess } = require('../utils/apiResponse');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/tokens');
const TwoFactorController = require('./TwoFactorController');

const PASSWORD_PEPPER = process.env.PASSWORD_PEPPER || 'dev-pepper-change-me';
const BCRYPT_ROUNDS = 10;

function composePasswordInput(password, salt) {
    return `${password}|${salt}|${PASSWORD_PEPPER}`;
}

function generateSalt() {
    return crypto.randomBytes(16).toString('hex');
}

function validatePasswordStrength(password) {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?\s]/.test(password);

    if (password.length < minLength) {
        return { valid: false, error: 'Le mot de passe doit contenir au moins 8 caractères' };
    }
    if (!hasUpperCase) {
        return { valid: false, error: 'Le mot de passe doit contenir au moins une majuscule' };
    }
    if (!hasLowerCase) {
        return { valid: false, error: 'Le mot de passe doit contenir au moins une minuscule' };
    }
    if (!hasSpecialChar) {
        return { valid: false, error: 'Le mot de passe doit contenir au moins un caractère spécial (!@#$%^&* etc.)' };
    }

    return { valid: true };
}

module.exports = {

    // ----------------------------------------------------------
    // POST /api/auth/login
    // ----------------------------------------------------------
    login: (req, res) => {
        const { email, password } = req.body;

        if (!email || !password) {
            return sendError(res, 400, 'Email et mot de passe requis', 'AUTH_BAD_REQUEST');
        }

        const query = 'SELECT * FROM users WHERE email = ?';

        db.query(query, [email], (err, results) => {
            if (err) {
                return sendError(res, 500, 'Erreur serveur', 'DB_QUERY_ERROR');
            }

            if (results.length === 0) {
                return sendError(res, 401, 'Email ou mot de passe incorrect', 'AUTH_INVALID_CREDENTIALS');
            }

            const user = results[0];
            const hashPrefix = '$2';
            const isHash = typeof user.password === 'string' && user.password.startsWith(hashPrefix);
            const hasSalt = typeof user.password_salt === 'string' && user.password_salt.length > 0;

            let isValidPassword = false;
            if (isHash && hasSalt) {
                isValidPassword = bcrypt.compareSync(composePasswordInput(password, user.password_salt), user.password);
            } else if (isHash) {
                // Compatibilite avec anciens hashes sans sel/poivre applicatif.
                isValidPassword = bcrypt.compareSync(password, user.password);
            } else {
                isValidPassword = password === user.password;
            }

            if (!isValidPassword) {
                return sendError(res, 401, 'Email ou mot de passe incorrect', 'AUTH_INVALID_CREDENTIALS');
            }

            if (user.two_fa_enabled && user.two_fa_secret) {
                const challengeId = TwoFactorController.createLoginChallenge(user);
                return sendSuccess(res, {
                    requires2FA: true,
                    challengeId,
                    user: {
                        id: user.id,
                        username: user.username,
                        email: user.email,
                        role: user.role
                    }
                });
            }

            if (!hasSalt) {
                const newSalt = generateSalt();
                const upgradedHash = bcrypt.hashSync(composePasswordInput(password, newSalt), BCRYPT_ROUNDS);
                db.query('UPDATE users SET password = ?, password_salt = ? WHERE id = ?', [upgradedHash, newSalt, user.id], () => {});
            }

            const token = signAccessToken(user);
            const refreshToken = signRefreshToken(user);

            return sendSuccess(res, {
                message: 'Connexion réussie',
                token,
                refreshToken,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    role: user.role
                }
            });
        });
    },

    // ----------------------------------------------------------
    // POST /api/auth/register
    // ----------------------------------------------------------
    register: (req, res) => {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return sendError(res, 400, 'Tous les champs sont requis', 'AUTH_BAD_REQUEST');
        }

        const passwordValidation = validatePasswordStrength(password);
        if (!passwordValidation.valid) {
            return sendError(res, 400, passwordValidation.error, 'AUTH_WEAK_PASSWORD');
        }

        const passwordSalt = generateSalt();
        const passwordHash = bcrypt.hashSync(composePasswordInput(password, passwordSalt), BCRYPT_ROUNDS);

        const insertSql = 'INSERT INTO users (username, email, password, password_salt, role) VALUES (?, ?, ?, ?, ?)';

        db.query(insertSql, [username, email, passwordHash, passwordSalt, 'user'], (err, result) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    return sendError(res, 409, 'Cet email existe deja', 'AUTH_EMAIL_EXISTS');
                }
                return sendError(res, 500, 'Erreur serveur', 'DB_QUERY_ERROR');
            }

            const user = {
                id: result.insertId,
                username,
                email,
                role: 'user'
            };
            const token = signAccessToken(user);
            const refreshToken = signRefreshToken(user);

            return sendSuccess(res, { message: 'Inscription reussie', token, refreshToken, user }, 201);
        });
    },

    // ----------------------------------------------------------
    // POST /api/auth/refresh
    // ----------------------------------------------------------
    refresh: (req, res) => {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return sendError(res, 400, 'Refresh token requis', 'AUTH_REFRESH_TOKEN_MISSING');
        }

        let payload;
        try {
            payload = verifyRefreshToken(refreshToken);
        } catch (_err) {
            return sendError(res, 401, 'Refresh token invalide ou expire', 'AUTH_REFRESH_TOKEN_INVALID');
        }

        db.query('SELECT id, username, email, role FROM users WHERE id = ?', [payload.id], (err, results) => {
            if (err) {
                return sendError(res, 500, 'Erreur serveur', 'DB_QUERY_ERROR');
            }

            if (!results || results.length === 0) {
                return sendError(res, 401, 'Refresh token invalide ou expire', 'AUTH_REFRESH_TOKEN_INVALID');
            }

            const user = results[0];
            const token = signAccessToken(user);
            const nextRefreshToken = signRefreshToken(user);

            return sendSuccess(res, {
                message: 'Session renouvelee',
                token,
                refreshToken: nextRefreshToken,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    role: user.role
                }
            });
        });
    }
};
