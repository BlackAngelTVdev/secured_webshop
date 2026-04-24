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

    let currentChallengeId = null;
    let pendingUser = null;

    async function verify2FA(code) {
        if (!currentChallengeId || !code) return false;

        try {
            const res = await fetch('/api/2fa/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ challengeId: currentChallengeId, code })
            });

            const data = await res.json();

            if (!res.ok) {
                showMessage('error', data.message || 'Code 2FA invalide');
                return false;
            }

            auth.setSession({ token: data.token, user: data.user });
            showMessage('success', 'Connexion réussie. Redirection...');
            setTimeout(() => { window.location.href = '/profile'; }, 900);
            return true;
        } catch (_error) {
            showMessage('error', 'Erreur réseau. Merci de réessayer.');
            return false;
        }
    }

    function show2FAForm(user) {
        pendingUser = user;

        const authCard = document.querySelector('.auth-card');
        form.style.display = 'none';

        const twoFactorDiv = document.createElement('div');
        twoFactorDiv.id = 'two-factor-form';
        twoFactorDiv.innerHTML = `
            <h3>Authentification à deux facteurs</h3>
            <p class="auth-subtitle">Entrez le code de votre application d'authentification.</p>
            <div class="message" id="2fa-message"></div>
            <form id="2fa-verify-form">
                <div class="form-group">
                    <label for="2fa-code">Code à 6 chiffres</label>
                    <input type="text" id="2fa-code" placeholder="000000" maxlength="6" autocomplete="one-time-code" required>
                </div>
                <button type="submit" id="2fa-submit">Vérifier</button>
            </form>
            <button type="button" id="2fa-cancel" class="text-btn">Retour à la connexion</button>
        `;
        authCard.appendChild(twoFactorDiv);

        document.getElementById('2fa-verify-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const code = document.getElementById('2fa-code').value;
            const btn = document.getElementById('2fa-submit');
            btn.disabled = true;
            btn.textContent = 'Vérification...';

            const success = await verify2FA(code);

            if (!success) {
                btn.disabled = false;
                btn.textContent = 'Vérifier';
            }
        });

        document.getElementById('2fa-cancel').addEventListener('click', () => {
            twoFactorDiv.remove();
            form.style.display = 'block';
            currentChallengeId = null;
            pendingUser = null;
        });
    }

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
                showMessage('error', data.message || 'Connexion impossible.');
                return;
            }

            if (data.requires2FA && data.challengeId) {
                currentChallengeId = data.challengeId;
                submitBtn.disabled = false;
                submitBtn.textContent = 'Se connecter';
                show2FAForm(data.user);
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
