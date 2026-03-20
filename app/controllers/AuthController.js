const db = require('../config/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

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
            return res.status(400).json({ error: 'Email et mot de passe requis' });
        }

        const query = 'SELECT * FROM users WHERE email = ?';

        db.query(query, [email], (err, results) => {
            if (err) {
                return res.status(500).json({ error: 'Erreur serveur' });
            }

            if (results.length === 0) {
                return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
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
                return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
            }

            if (!hasSalt) {
                const newSalt = generateSalt();
                const upgradedHash = bcrypt.hashSync(composePasswordInput(password, newSalt), BCRYPT_ROUNDS);
                db.query('UPDATE users SET password = ?, password_salt = ? WHERE id = ?', [upgradedHash, newSalt, user.id], () => {});
            }

            const token = signToken(user);

            res.json({
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
            return res.status(400).json({ error: 'Tous les champs sont requis' });
        }

        const passwordValidation = validatePasswordStrength(password);
        if (!passwordValidation.valid) {
            return res.status(400).json({ error: passwordValidation.error });
        }

        const passwordSalt = generateSalt();
        const passwordHash = bcrypt.hashSync(composePasswordInput(password, passwordSalt), BCRYPT_ROUNDS);

        const insertSql = 'INSERT INTO users (username, email, password, password_salt, role) VALUES (?, ?, ?, ?, ?)';

        db.query(insertSql, [username, email, passwordHash, passwordSalt, 'user'], (err, result) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(409).json({ error: 'Cet email existe deja' });
                }
                return res.status(500).json({ error: 'Erreur serveur' });
            }

            const user = {
                id: result.insertId,
                username,
                email,
                role: 'user'
            };
            const token = signToken(user);

            res.status(201).json({ message: 'Inscription reussie', token, user });
        });
    }
};
