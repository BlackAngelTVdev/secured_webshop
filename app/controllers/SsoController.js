const db = require('../config/db');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { sendError, sendSuccess } = require('../utils/apiResponse');
const { signAccessToken, signRefreshToken } = require('../utils/tokens');

// Configuration SSO depuis le .env
const API_KEY = process.env.API_KEY || null;
const SSO_PORTAL = (process.env.SSO_PORTAL || '').replace(/\/$/, '');
const APP_URL = (process.env.APP_URL || 'https://localhost:8443').replace(/\/$/, '');

// Initialize SSO Bridge (lazy-load)
let ssoBridge = null;
function initializeSsoBridge() {
    try {
        if (!API_KEY) {
            console.warn('SSO: API_KEY manquante dans .env');
            return null;
        }
        const { createSSOBridge } = require('sso-bridge');
        return createSSOBridge({
            apiKey: API_KEY,
            ssoPortal: SSO_PORTAL,
        });
    } catch (error) {
        console.error('SSO: Erreur lors de l\'initialisation du bridge :', error.message);
        return null;
    }
}

// ============================================================
// Utilitaires pour gestion User SSO
// ============================================================

/**
 * Normalize username from email or raw username
 * Examples: "john.doe@example.com" => "john-doe", "JohnDoe" => "johndoe"
 */
function normalizeUsername(rawEmail) {
    const localPart = rawEmail.includes('@')
        ? rawEmail.split('@')[0]
        : rawEmail;
    const cleaned = localPart
        .trim()
        .toLowerCase()
        .replace(/\./g, '-')
        .replace(/[^a-z0-9_-]/g, '');
    return (cleaned || 'sso_user').slice(0, 40);
}

/**
 * Ensure username is unique in database
 */
async function makeUniqueUsername(baseUsername) {
    return new Promise((resolve, reject) => {
        let candidate = baseUsername;
        let suffix = 1;

        function checkAndIncrement() {
            const query = 'SELECT id FROM users WHERE username = ?';
            db.query(query, [candidate], (err, results) => {
                if (err) return reject(err);
                if (results.length === 0) {
                    return resolve(candidate);
                }
                candidate = `${baseUsername}_${suffix}`.slice(0, 40);
                suffix += 1;
                checkAndIncrement();
            });
        }
        checkAndIncrement();
    });
}

/**
 * Find or create user from SSO response
 * Priority: email match > username match > create new
 */
async function findOrCreateSsoUser(payload) {
    const email = payload.email ? payload.email.trim().toLowerCase() : null;
    const usernameFromSso = payload.username ? payload.username.trim() : '';

    return new Promise((resolve, reject) => {
        // Step 1: Try to find by email
        if (email) {
            const queryEmail = 'SELECT * FROM users WHERE email = ?';
            return db.query(queryEmail, [email], (err, results) => {
                if (err) return reject(err);
                if (results.length > 0) return resolve(results[0]);

                // Step 2: Try to find by username
                if (usernameFromSso) {
                    const queryUsername = 'SELECT * FROM users WHERE username = ?';
                    return db.query(queryUsername, [usernameFromSso], (err, results) => {
                        if (err) return reject(err);
                        if (results.length > 0) return resolve(results[0]);

                        // Step 3: Create new SSO user
                        createNewSsoUser(email, usernameFromSso)
                            .then(resolve)
                            .catch(reject);
                    });
                }

                // Step 3 (no username available): Create new SSO user
                createNewSsoUser(email, usernameFromSso)
                    .then(resolve)
                    .catch(reject);
            });
        }

        // If no email, try username only
        if (usernameFromSso) {
            const queryUsername = 'SELECT * FROM users WHERE username = ?';
            return db.query(queryUsername, [usernameFromSso], (err, results) => {
                if (err) return reject(err);
                if (results.length > 0) return resolve(results[0]);

                // Create new SSO user
                createNewSsoUser(email, usernameFromSso)
                    .then(resolve)
                    .catch(reject);
            });
        }

        reject(new Error('SSO: Ni email ni username fourni'));
    });
}

/**
 * Create a new user account from SSO data
 */
async function createNewSsoUser(email, usernameFromSso) {
    return new Promise(async (resolve, reject) => {
        try {
            const baseUsername = normalizeUsername(email || usernameFromSso || 'sso_user');
            const uniqueUsername = await makeUniqueUsername(baseUsername);
            
            // Generate random password (user won't use it for SSO path)
            const randomPassword = crypto.randomBytes(32).toString('hex');
            const passwordSalt = crypto.randomBytes(16).toString('hex');
            const PASSWORD_PEPPER = process.env.PASSWORD_PEPPER || 'dev-pepper-change-me';
            const passwordInput = `${randomPassword}|${passwordSalt}|${PASSWORD_PEPPER}`;
            const hashedPassword = bcrypt.hashSync(passwordInput, 10);
            
            const insertQuery = `
                INSERT INTO users (username, email, password, password_salt, role, account_locked, failed_login_attempts)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `;
            
            db.query(
                insertQuery,
                [uniqueUsername, email || null, hashedPassword, passwordSalt, 'user', 0, 0],
                (err, results) => {
                    if (err) return reject(err);
                    
                    // Fetch the newly created user
                    const selectQuery = 'SELECT * FROM users WHERE id = ?';
                    db.query(selectQuery, [results.insertId], (err, rows) => {
                        if (err) return reject(err);
                        resolve(rows[0]);
                    });
                }
            );
        } catch (error) {
            reject(error);
        }
    });
}

// ============================================================
// SSO Controller Methods
// ============================================================

module.exports = {

    /**
     * GET /sso/status
     * Affiche l'état SSO et les endpoints disponibles
     */
    status: (req, res) => {
        const ssoEnabled = !!API_KEY;
        const appUrl = APP_URL;
        
        if (!ssoEnabled) {
            return sendError(res, 503, 'SSO non configuré (API_KEY manquante)', 'SSO_NOT_CONFIGURED');
        }
        
        return sendSuccess(res, 200, {
            status: 'ok',
            message: 'SSO Bridge configuré et prêt',
            links: {
                login: `${appUrl}/sso/login`,
                callback: `${appUrl}/sso/callback?correlationId=XXX`,
                logout: `${appUrl}/sso/logout`,
            },
        });
    },

    /**
     * GET /sso/login
     * Phase 1 : Redirection vers le portail SSO
     */
    loginRedirect: async (req, res) => {
        try {
            if (!API_KEY || !SSO_PORTAL) {
                return sendError(res, 503, 'SSO non configuré', 'SSO_NOT_CONFIGURED');
            }

            if (!ssoBridge) {
                ssoBridge = initializeSsoBridge();
            }

            if (!ssoBridge) {
                return sendError(res, 500, 'Impossible d\'initialiser le bridge SSO', 'SSO_BRIDGE_INIT_FAILED');
            }

            // Generate correlation ID
            const cid = await ssoBridge.generateCorrelationId();
            
            // Build callback URL
            const callbackUrl = `${APP_URL}/sso/callback?correlationId=${cid}`;
            
            // Build portal redirect URL
            const finalUrl = `${SSO_PORTAL}/redirect?correlationId=${cid}&redirectUri=${encodeURIComponent(callbackUrl)}`;
            
            // Store correlation ID in session (Express cookie-based session)
            req.session = req.session || {};
            req.session.sso_correlation_id = cid;
            
            return res.redirect(finalUrl);
        } catch (error) {
            console.error('SSO loginRedirect error:', error);
            return sendError(res, 500, `Erreur SSO : ${error.message}`, 'SSO_LOGIN_FAILED');
        }
    },

    /**
     * GET /sso/callback?correlationId=XXX
     * Phase 2 : Retour du portail SSO & Validation
     */
    callback: async (req, res) => {
        try {
            const cid = req.query.correlationId;
            
            if (!cid) {
                return sendError(res, 400, 'Paramètre correlationId manquant', 'SSO_CALLBACK_BAD_REQUEST');
            }

            if (!API_KEY || !SSO_PORTAL) {
                return sendError(res, 503, 'SSO non configuré', 'SSO_NOT_CONFIGURED');
            }

            if (!ssoBridge) {
                ssoBridge = initializeSsoBridge();
            }

            if (!ssoBridge) {
                return sendError(res, 500, 'Impossible d\'initialiser le bridge SSO', 'SSO_BRIDGE_INIT_FAILED');
            }

            // Fetch SSO user info from bridge
            const ssoResult = await ssoBridge.retrieveLoginInfo(cid);
            
            if (ssoResult.error || !ssoResult.email) {
                const errorMsg = ssoResult.error || 'Utilisateur inconnu';
                return sendError(res, 401, `Erreur SSO : ${errorMsg}`, 'SSO_AUTH_FAILED');
            }

            // Find or create user in database
            const user = await findOrCreateSsoUser(ssoResult);
            
            if (!user) {
                return sendError(res, 500, 'Erreur lors de la récupération de l\'utilisateur', 'SSO_USER_NOT_FOUND');
            }

            // Check if account is locked
            if (Number(user.account_locked) === 1) {
                return sendError(res, 423, 'Compte verrouillé. Contactez un administrateur.', 'AUTH_ACCOUNT_LOCKED');
            }

            // Sign tokens
            const accessToken = signAccessToken(user);
            const refreshToken = signRefreshToken(user);

            // Store tokens in session
            console.log('Storing tokens in session...');
            req.session.accessToken = accessToken;
            req.session.refreshToken = refreshToken;
            req.session.user = {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role
            };

            console.log('Session before save:', req.session);

            // Save session explicitly before sending response
            req.session.save((err) => {
                if (err) {
                    console.error('Session save error:', err);
                    return sendError(res, 500, 'Erreur de session', 'SESSION_SAVE_ERROR');
                }

                console.log('Session saved successfully');
                console.log('Session ID:', req.sessionID);

                // Return HTML page that retrieves tokens and redirects to /home
                const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Connexion SSO...</title>
    <meta charset="UTF-8">
</head>
<body>
    <p>Connexion en cours...</p>
    <script>
        (async () => {
            try {
                console.log('Fetching tokens from /sso/tokens with credentials...');
                const response = await fetch('/sso/tokens', {
                    method: 'GET',
                    credentials: 'include',  // IMPORTANT: Include session cookies
                    headers: { 'Accept': 'application/json' }
                });
                console.log('Response status:', response.status);
                const data = await response.json();
                console.log('Response data:', data);
                
                if (data.token) {
                    console.log('Got token, storing in localStorage...');
                    // Store in localStorage with correct keys (matching auth.js)
                    localStorage.setItem('secureShopToken', data.token);
                    localStorage.setItem('secureShopRefreshToken', data.refreshToken);
                    localStorage.setItem('user', JSON.stringify(data.user));
                    
                    console.log('Redirecting to /home...');
                    // Redirect to home
                    window.location.href = '/home';
                } else {
                    console.error('No token in response:', data);
                    window.location.href = '/login?error=sso_failed';
                }
            } catch (error) {
                console.error('SSO token retrieval failed:', error);
                window.location.href = '/login?error=sso_failed';
            }
        })();
    </script>
</body>
</html>
                `;
                
                return res.send(html);
            });
        } catch (error) {
            console.error('SSO callback error:', error);
            return sendError(res, 500, `Erreur SSO : ${error.message}`, 'SSO_CALLBACK_FAILED');
        }
    },

    /**
     * GET /sso/logout
     * Phase 3 : Déconnexion (Locale + Portail)
     */
    logout: (req, res) => {
        try {
            // Clear session
            if (req.session) {
                req.session.sso_correlation_id = null;
                req.session.accessToken = null;
                req.session.refreshToken = null;
                req.session.user = null;
            }

            if (!SSO_PORTAL) {
                return sendSuccess(res, 200, { message: 'Déconnecté localement (portail SSO non disponible)' });
            }

            // Redirect to portal logout
            const postLogoutUrl = encodeURIComponent(
                APP_URL.endsWith('/') ? APP_URL : APP_URL + '/'
            );
            const portalUrl = `${SSO_PORTAL}/logout?redirectUri=${postLogoutUrl}`;

            return res.redirect(portalUrl);
        } catch (error) {
            console.error('SSO logout error:', error);
            return sendError(res, 500, `Erreur SSO : ${error.message}`, 'SSO_LOGOUT_FAILED');
        }
    },

    /**
     * GET /sso/tokens
     * Retourne les tokens stockés en session (pour récupération côté frontend)
     */
    getTokens: (req, res) => {
        try {
            console.log('getTokens called');
            console.log('Session ID:', req.sessionID);
            console.log('Session data:', req.session);
            
            if (!req.session) {
                console.log('No session object');
                return sendError(res, 401, 'Pas de session', 'NO_SESSION');
            }
            
            if (!req.session.accessToken) {
                console.log('No accessToken in session. Available keys:', Object.keys(req.session));
                return sendError(res, 401, 'Token d\'accès non trouvé en session', 'NO_ACCESS_TOKEN');
            }
            
            console.log('Returning tokens from session');
            return sendSuccess(res, 200, {
                token: req.session.accessToken,
                refreshToken: req.session.refreshToken,
                user: req.session.user
            });
        } catch (error) {
            console.error('SSO getTokens error:', error);
            return sendError(res, 500, `Erreur : ${error.message}`, 'SSO_GET_TOKENS_FAILED');
        }
    },
};
