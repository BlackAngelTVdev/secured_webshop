const db = require('../config/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { sendError, sendSuccess } = require('../utils/apiResponse');
const { signRefreshToken, verifyRefreshToken } = require('../utils/tokens');
const loginRateLimit = require('../middleware/loginRateLimit');
const TwoFactorController = require('./TwoFactorController');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const PASSWORD_PEPPER = process.env.PASSWORD_PEPPER || 'dev-pepper-change-me';
const BCRYPT_ROUNDS = 10;

const MAX_ATTEMPTS = loginRateLimit.MAX_ATTEMPTS;
const ACCOUNT_LOCK_THRESHOLD = Math.ceil(MAX_ATTEMPTS /2);

function composePasswordInput(password, salt) {
    return `${password}|${salt}|${PASSWORD_PEPPER}`;
}

function generateSalt() {
    return crypto.randomBytes(16).toString('hex');
}

function signToken(user) {
    return jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: '2h' }
    );
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

            // Vérifier si le compte est verrouillé
            if (Number(user.account_locked) === 1) {
                return sendError(res, 423, 'Compte verrouillé. Contactez un administrateur.', 'AUTH_ACCOUNT_LOCKED');
            }

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
                // Incrémenter le compteur d'essais échoués
                const newAttempts = Number(user.failed_login_attempts || 0) + 1;
                
                // Vérifier si on atteint le seuil de verrouillage
                if (newAttempts >= ACCOUNT_LOCK_THRESHOLD) {
                    // Verrouiller le compte
                    db.query(
                        'UPDATE users SET failed_login_attempts = ?, account_locked = 1, account_locked_at = NOW() WHERE id = ?',
                        [newAttempts, user.id],
                        () => {}
                    );
                    return sendError(res, 423, 'Trop d\'essais échoués. Compte verrouillé. Contactez un administrateur.', 'AUTH_ACCOUNT_LOCKED');
                } else {
                    // Juste incrémenter le compteur
                    db.query(
                        'UPDATE users SET failed_login_attempts = ? WHERE id = ?',
                        [newAttempts, user.id],
                        () => {}
                    );
                }
                return sendError(res, 401, 'Email ou mot de passe incorrect', 'AUTH_INVALID_CREDENTIALS');
            }

            // Réinitialiser le compteur d'essais échoués si la connexion est réussie
            db.query(
                'UPDATE users SET failed_login_attempts = 0 WHERE id = ?',
                [user.id],
                () => {}
            );

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

            const token = signToken(user);

            return sendSuccess(res, {
                message: 'Connexion réussie',
                token,
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
            const token = signToken(user);

            return sendSuccess(res, { message: 'Inscription reussie', token, user }, 201);
        });
    },

    // ----------------------------------------------------------
    // POST /api/auth/refresh
    // ----------------------------------------------------------
    refresh: (req, res) => {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return sendError(res, 400, 'Refresh token requis', 'AUTH_REFRESH_TOKEN_REQUIRED');
        }

        let payload;
        try {
            payload = verifyRefreshToken(refreshToken);
        } catch (_error) {
            return sendError(res, 401, 'Refresh token invalide', 'AUTH_REFRESH_TOKEN_INVALID');
        }

        const user = {
            id: payload.id,
            email: payload.email,
            role: payload.role
        };

        const token = signToken(user);
        const nextRefreshToken = signRefreshToken(user);

        return sendSuccess(res, {
            message: 'Session renouvelee',
            token,
            refreshToken: nextRefreshToken,
            user: {
                id: user.id,
                email: user.email,
                role: user.role
            }
        });
    }
};
