document.addEventListener('DOMContentLoaded', () => {
    const auth = window.SecureShopAuth;
    const form = document.getElementById('register-form');
    if (!form) return;

    const submitBtn = document.getElementById('register-submit');
    const messageEl = document.getElementById('register-message');
    const passwordInput = document.getElementById('password');

    const PASSWORD_MIN_LENGTH = 8;
    const PASSWORD_SPECIAL_CHARS = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/;

    const showMessage = (type, text) => {
        messageEl.textContent = text;
        messageEl.className = 'message ' + type;
        messageEl.style.display = 'block';
    };

    function validatePasswordCriteria(password) {
        return {
            length: password.length >= PASSWORD_MIN_LENGTH,
            hasUpper: /[A-Z]/.test(password),
            hasLower: /[a-z]/.test(password),
            hasSpecial: PASSWORD_SPECIAL_CHARS.test(password)
        };
    }

    function updateCriteriaDisplay(password) {
        const criteria = validatePasswordCriteria(password);
        document.getElementById('crit-length').className = criteria.length ? 'icon done' : 'icon';
        document.getElementById('crit-upper').className = criteria.hasUpper ? 'icon done' : 'icon';
        document.getElementById('crit-lower').className = criteria.hasLower ? 'icon done' : 'icon';
        document.getElementById('crit-special').className = criteria.hasSpecial ? 'icon done' : 'icon';
        return criteria;
    }

    function calculateStrength(criteria) {
        let points = 0;
        if (criteria.length) points++;
        if (criteria.hasUpper) points++;
        if (criteria.hasLower) points++;
        if (criteria.hasSpecial) points++;
        return points;
    }

    function updateStrengthIndicator(password) {
        if (!password) {
            document.getElementById('password-strength').style.display = 'none';
            return;
        }

        const criteria = validatePasswordCriteria(password);
        const strength = calculateStrength(criteria);
        const strengthBar = document.getElementById('strength-bar');
        const strengthText = document.getElementById('strength-text');
        const strengthDiv = document.getElementById('password-strength');

        strengthDiv.style.display = 'block';
        strengthBar.className = 'strength-bar';

        switch (strength) {
            case 1:
                strengthBar.classList.add('weak');
                strengthText.textContent = 'Très faible';
                break;
            case 2:
                strengthBar.classList.add('fair');
                strengthText.textContent = 'Faible';
                break;
            case 3:
                strengthBar.classList.add('good');
                strengthText.textContent = 'Bon';
                break;
            case 4:
                strengthBar.classList.add('strong');
                strengthText.textContent = 'Très fort';
                break;
            default:
                strengthDiv.style.display = 'none';
        }
    }

    function isPasswordValid(password) {
        const criteria = validatePasswordCriteria(password);
        return criteria.length && criteria.hasUpper && criteria.hasLower && criteria.hasSpecial;
    }

    passwordInput.addEventListener('input', (e) => {
        const password = e.target.value;
        updateCriteriaDisplay(password);
        updateStrengthIndicator(password);
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const username = form.username.value.trim();
        const email = form.email.value.trim();
        const password = form.password.value;
        const confirmPassword = form.confirmPassword.value;

        if (!username || !email || !password || !confirmPassword) {
            showMessage('error', 'Tous les champs sont obligatoires.');
            return;
        }

        if (!isPasswordValid(password)) {
            showMessage('error', 'Le mot de passe doit contenir au moins 8 caractères, une majuscule, une minuscule et un caractère spécial.');
            return;
        }

        if (password !== confirmPassword) {
            showMessage('error', 'Les mots de passe ne correspondent pas.');
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Creation...';

        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password })
            });

            const data = await response.json();

            if (!response.ok) {
                showMessage('error', data.message || 'Inscription impossible.');
                return;
            }

            auth.setSession({ token: data.token, user: data.user });

            showMessage('success', data.message || 'Compte cree. Redirection vers le profil...');
            setTimeout(() => {
                window.location.href = '/profile';
            }, 1200);
        } catch (_error) {
            showMessage('error', 'Erreur reseau. Merci de reessayer.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Creer mon compte';
        }
    });
});
