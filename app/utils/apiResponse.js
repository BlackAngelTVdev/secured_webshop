function normalizeMessage(message) {
    if (typeof message === 'string' && message.trim()) {
        return message;
    }

    return 'Erreur serveur';
}

function normalizeCode(code) {
    if (typeof code === 'string' && code.trim()) {
        return code;
    }

    return 'API_ERROR';
}

function sendError(res, statusCode, message, code) {
    return res.status(statusCode).json({
        message: normalizeMessage(message),
        code: normalizeCode(code)
    });
}

function sendSuccess(res, payload, statusCode) {
    return res.status(statusCode || 200).json(payload || {});
}

module.exports = {
    sendError,
    sendSuccess
};