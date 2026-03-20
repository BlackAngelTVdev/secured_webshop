document.addEventListener('DOMContentLoaded', () => {
    const auth = window.SecureShopAuth;
    const form = document.getElementById('login-form');
    if (!form) return;

    const submitBtn = document.getElementById('login-submit');
    const messageEl = document.getElementById('login-message');

    const showMessage = (type, text) => {
        messageEl.textContent = text;
        messageEl.className = 'message ' + type;
        messageEl.style.display = 'block';
    };

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const email = form.email.value.trim();
        const password = form.password.value;

        if (!email || !password) {
            showMessage('error', 'Veuillez saisir votre email et votre mot de passe.');
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Connexion...';

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (!response.ok) {
                auth.clearSession();
                showMessage('error', data.error || 'Connexion impossible.');
                return;
            }

            showMessage('success', data.message || 'Connexion reussie. Redirection...');

            auth.setSession({ token: data.token, user: data.user });

            setTimeout(() => {
                window.location.href = '/profile';
            }, 900);
        } catch (_error) {
            showMessage('error', 'Erreur reseau. Merci de reessayer.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Se connecter';
        }
    });
});
