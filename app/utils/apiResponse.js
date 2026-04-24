function sendError(res, statusCode, message, code) {
    return res.status(statusCode).json({
        error: message,
        code: code || 'API_ERROR'
    });
}

function sendSuccess(res, payload, statusCode) {
    return res.status(statusCode || 200).json(payload || {});
}

module.exports = {
    sendError,
    sendSuccess
};