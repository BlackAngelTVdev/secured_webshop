const db = require('../config/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { sendError, sendSuccess } = require('../utils/apiResponse');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const PASSWORD_PEPPER = process.env.PASSWORD_PEPPER || 'dev-pepper-change-me';
const BCRYPT_ROUNDS = 10;

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
    }
};
