(function () {
    const TOKEN_KEY = 'secureShopToken';
    const REFRESH_TOKEN_KEY = 'secureShopRefreshToken';

    function getToken() {
        return localStorage.getItem(TOKEN_KEY);
    }

    function getRefreshToken() {
        return localStorage.getItem(REFRESH_TOKEN_KEY);
    }

    function getUser() {
        return null;
    }

    function setSession(session) {
        if (session && session.token) {
            localStorage.setItem(TOKEN_KEY, session.token);
        }
        if (session && session.refreshToken) {
            localStorage.setItem(REFRESH_TOKEN_KEY, session.refreshToken);
        }
    }

    function clearSession() {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
    }

    function authHeaders(extraHeaders) {
        const headers = { ...(extraHeaders || {}) };
        const token = getToken();

        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }

        return headers;
    }

    async function authFetch(url, options) {
        const opts = { ...(options || {}) };
        opts.headers = authHeaders(opts.headers);

        const response = await fetch(url, opts);

        if (response.status !== 401 || opts.__skipRefresh === true) {
            return response;
        }

        const refreshed = await refreshSession();
        if (!refreshed) {
            clearSession();
            return response;
        }

        const retryOptions = { ...opts, __skipRefresh: true };
        retryOptions.headers = authHeaders(retryOptions.headers);
        return fetch(url, retryOptions);
    }

    async function refreshSession() {
        const refreshToken = getRefreshToken();

        if (!refreshToken) {
            return false;
        }

        try {
            const response = await fetch('/api/auth/refresh', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken })
            });

            const data = await response.json();

            if (!response.ok) {
                clearSession();
                return false;
            }

            setSession({
                token: data.token,
                refreshToken: data.refreshToken
            });

            return true;
        } catch (_error) {
            clearSession();
            return false;
        }
    }

    function requireAuth(redirectTo) {
        if (!getToken()) {
            window.location.href = redirectTo || '/login';
            return false;
        }
        return true;
    }

    function requireAdminOrHome() {
        if (!getToken()) {
            window.location.href = '/login';
            return false;
        }

        return true;
    }

    window.SecureShopAuth = {
        getToken,
        getRefreshToken,
        getUser,
        setSession,
        clearSession,
        authHeaders,
        authFetch,
        refreshSession,
        requireAuth,
        requireAdminOrHome
    };
})();
