const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const JWT_ISSUER = process.env.JWT_ISSUER || 'secured-webshop';
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || `${JWT_SECRET}-refresh`;
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

function buildPayload(user) {
    return {
        id: user.id,
        email: user.email,
        role: user.role
    };
}

function signAccessToken(user) {
    return jwt.sign(buildPayload(user), JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN,
        issuer: JWT_ISSUER
    });
}

function signRefreshToken(user) {
    return jwt.sign({ ...buildPayload(user), tokenType: 'refresh' }, REFRESH_TOKEN_SECRET, {
        expiresIn: REFRESH_TOKEN_EXPIRES_IN,
        issuer: JWT_ISSUER
    });
}

function verifyRefreshToken(token) {
    const payload = jwt.verify(token, REFRESH_TOKEN_SECRET, {
        issuer: JWT_ISSUER
    });

    if (!payload || payload.tokenType !== 'refresh') {
        throw new Error('Invalid refresh token');
    }

    return payload;
}

module.exports = {
    signAccessToken,
    signRefreshToken,
    verifyRefreshToken,
    JWT_SECRET,
    JWT_EXPIRES_IN,
    JWT_ISSUER,
    REFRESH_TOKEN_SECRET,
    REFRESH_TOKEN_EXPIRES_IN
};