(function () {
    const TOKEN_KEY = 'secureShopToken';
    const USER_KEY = 'secureShopUser';

    function getToken() {
        return localStorage.getItem(TOKEN_KEY);
    }

    function getUser() {
        const raw = localStorage.getItem(USER_KEY);
        if (!raw) return null;

        try {
            return JSON.parse(raw);
        } catch (_err) {
            return null;
        }
    }

    function setSession(session) {
        if (session && session.token) {
            localStorage.setItem(TOKEN_KEY, session.token);
        }
        if (session && session.user) {
            localStorage.setItem(USER_KEY, JSON.stringify(session.user));
        }
    }

    function clearSession() {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
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

        if (response.status === 401) {
            clearSession();
        }

        return response;
    }

    function requireAuth(redirectTo) {
        if (!getToken()) {
            window.location.href = redirectTo || '/login';
            return false;
        }
        return true;
    }

    function requireAdminOrHome() {
        const token = getToken();
        const user = getUser();

        if (!token) {
            window.location.href = '/login';
            return false;
        }

        if (!user || user.role !== 'admin') {
            window.location.href = '/';
            return false;
        }

        return true;
    }

    window.SecureShopAuth = {
        getToken,
        getUser,
        setSession,
        clearSession,
        authHeaders,
        authFetch,
        requireAuth,
        requireAdminOrHome
    };
})();
