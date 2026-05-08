# secured_webshop - suivi détaillé des activités de sécurité

Ce document explique les changements réalisés pour chaque activité déjà implémentée dans le projet.

## Tableau de synthèse

| Activite | Statut |
|---|---|
| 1) Page de login en frontend | FAIT |
| 2) Page d'inscription en frontend | FAIT |
| 3) Mots de passe hashes en base | FAIT |
| 4) Ajout d'un sel | FAIT |
| 5) Ajout d'un poivre | FAIT |
| 6) Protection contre l'injection SQL | FAIT |
| 7) Token JWT | FAIT |
| 8) Roles administrateur et utilisateur dans le JWT | FAIT |
| 9) Mise en place du HTTPS | FAIT |
| 10) Politique de mot de passe fort | FAIT |
| 11) Limiter la durée du token JWT et refresh token | FAIT |
| 12) Audit des dépendances NPM | NON FAIT |
| 13) Test de résistance du hash | NON FAIT |
| 14) Gestion d'exceptions sans fuite d'information | FAIT |
| 15) Limiter les tentatives de login | FAIT |
| 16) Verrouillage de compte après échecs | FAIT |
| 17) Audit sécurité OWASP Top 10 2025 | NON FAIT |
| 18) Chiffrement des données sensibles en base | NON FAIT |
| 19) Correction d'une faille XSS | NON FAIT |
| 20) Moindre privilège BDD | NON FAIT |
| 1) Protection CSRF sur un formulaire | NON FAIT |
| 2) Journalisation sécurisée des événements | NON FAIT |
| 3) Authentification a double facteur | FAIT |
| 4) Sécurisation de l'upload photo | NON FAIT |
| 5) Scan OWASP ZAP | NON FAIT |

## 6.1 Activités obligatoires (1 point par tâche)

### 1) Implementer une page de login en frontend
Cette page permet de se connecter avec son email et son mot de passe. Le formulaire vérifie les champs avant l'envoi, affiche un message clair en cas de problème et bloque le bouton le temps de la requête. Une fois la connexion acceptée, le token et les infos de session sont gardés dans le navigateur, puis l'utilisateur est redirigé vers son profil.
```js
Fichiers: views/login.html et public/js/login.js.
```

Exemple de logique dans le code:
```js
// 1. L'utilisateur remplit le formulaire.
const email = form.email.value.trim();
const password = form.password.value;

// 2. On envoie la demande de connexion.
const response = await fetch('/api/auth/login', {
	method: 'POST',
	headers: { 'Content-Type': 'application/json' },
	body: JSON.stringify({ email, password })
});

// 3. Si tout est bon, on garde la session et on redirige.
auth.setSession({ token: data.token, refreshToken: data.refreshToken, user: data.user });
window.location.href = '/profile';
```
### 2) Implementer une page d'inscription en frontend
Cette page sert à créer un compte avec un nom d'utilisateur, un email et un mot de passe. Les champs obligatoires sont contrôlés, tout comme la confirmation du mot de passe. Si tout est bon, le frontend envoie la demande à l'API d'inscription et affiche des retours compréhensibles, par exemple si l'email est déjà utilisé. Une fois le compte créé, l'utilisateur est connecté puis envoyé vers son profil.
```js
Fichiers: views/register.html et public/js/register.js.
```

Exemple de logique dans le code:
```js
// 1. On vérifie que tous les champs sont remplis.
if (!username || !email || !password || !confirmPassword) {
	showMessage('error', 'Tous les champs doivent être remplis.');
	return;
}

// 2. On contrôle que les deux mots de passe sont identiques.
if (password !== confirmPassword) {
	showMessage('error', 'Les mots de passe ne correspondent pas.');
	return;
}

// 3. Si c'est bon, on crée le compte.
await fetch('/api/auth/register', { method: 'POST', body: JSON.stringify({ username, email, password }) });
```
### 3) Remplacer les mots de passe en clair dans la base par un hash
Les mots de passe ne sont plus enregistrés en clair. À l'inscription, ils sont transformés en hash avec bcryptjs, puis vérifiés de la même manière lors de la connexion.
```js
Fichiers: controllers/AuthController.js et package.json.
```

Exemple de logique dans le code:
```js
// 1. On mélange le mot de passe avec le sel et le poivre.
const passwordInput = `${password}|${salt}|${PASSWORD_PEPPER}`;

// 2. On crée le hash avant de l'envoyer en base.
const passwordHash = bcrypt.hashSync(passwordInput, BCRYPT_ROUNDS);

// 3. À la connexion, on compare le hash stocké avec la même recette.
const isValid = bcrypt.compareSync(passwordInput, user.password);
```
### 4) Ajouter un sel
Un sel aléatoire est généré pour chaque utilisateur avec **crypto.randomBytes**. Il est ensuite mélangé au mot de passe avant le hash, puis stocké en base dans la colonne **password_salt**. Cela rend les mots de passe plus difficiles à deviner, même si deux utilisateurs choisissent le même mot de passe.
```js
Fichiers: controllers/AuthController.js et db/init/init.sql.
```

Exemple de logique dans le code:
```js
// 1. On génère un sel différent pour chaque compte.
const salt = crypto.randomBytes(16).toString('hex');

// 2. On l'ajoute au mot de passe avant le hash.
const passwordInput = `${password}|${salt}|${PASSWORD_PEPPER}`;

// 3. On stocke ensuite le sel avec le hash.
db.query('UPDATE users SET password = ?, password_salt = ? WHERE id = ?', [passwordHash, salt, user.id]);
```
### 5) Ajouter un poivre
Un poivre est chargé depuis les variables d'environnement pour renforcer encore le hash. Le mot de passe est combiné avec le sel et ce poivre avant le passage dans bcrypt. Comme ce secret reste côté application, il n'est jamais stocké dans la base de données.
```js
Fichiers: controllers/AuthController.js et .env.
```

Exemple de logique dans le code:
```js
// 1. Le poivre vient de la configuration serveur.
const PASSWORD_PEPPER = process.env.PASSWORD_PEPPER || 'dev-pepper-change-me';

// 2. On le mélange au mot de passe avant de créer le hash.
const passwordInput = `${password}|${salt}|${PASSWORD_PEPPER}`;

// 3. Comme il reste côté app, il ne part jamais en base.
```
### 6) Corriger les requetes existantes afin de prevenir l'injection SQL
Les requêtes sensibles ont été réécrites avec des paramètres pour éviter les injections SQL. Les valeurs envoyées par l'utilisateur ne sont plus collées directement dans le SQL. Cette correction couvre surtout l'authentification et le profil, là où les SELECT, INSERT et UPDATE étaient les plus exposés.

```js
Fichiers: controllers/AuthController.js et controllers/ProfileController.js.
```

Exemple de logique dans le code:
```js
// 1. On prépare une requête paramétrée.
const query = 'SELECT * FROM users WHERE email = ?';

// 2. La valeur utilisateur est passée à part.
db.query(query, [email], (err, results) => {
	// 3. La base reçoit une valeur, pas une chaîne SQL construite à la main.
});
```

### 7) Implementer l'utilisation d'un token JWT
Un JWT est généré après la connexion ou l'inscription avec les informations utiles de l'utilisateur, comme son identifiant, son email et son rôle. Le middleware d'authentification le vérifie ensuite sur les routes protégées. Côté frontend, un helper ajoute automatiquement l'en-tête `Authorization: Bearer` aux requêtes qui en ont besoin.

```js
Fichiers: controllers/AuthController.js, middleware/auth.js et public/js/auth.js.
```

Exemple de logique dans le code:
```js
// 1. On crée un token avec les infos utiles.
const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '2h' });

// 2. Le frontend l'envoie ensuite dans Authorization.
headers.Authorization = `Bearer ${token}`;

// 3. Le middleware vérifie que le token est bien valide.
```

### 8) Ajouter les roles administrateur et utilisateur dans le JWT et proteger les routes d'administration
Le rôle est maintenant inclus dans le JWT pour faire la différence entre un administrateur et un utilisateur classique. Côté backend, les routes d'administration passent par une vérification supplémentaire avec `requireAdmin`. Côté frontend, la page admin renvoie automatiquement vers une page normale si le rôle ne correspond pas.

```js
Fichiers: middleware/auth.js, routes/Admin.js et public/js/auth.js.
```

Exemple de logique dans le code:
```js
// 1. Le middleware d'auth vérifie la session.
auth(req, res, () => {
	// 2. Ensuite on contrôle le rôle.
	requireAdmin(req, res, next);
});

// 3. Si le rôle n'est pas admin, la route est refusée.
```

## 6.2 Activités faciles à choix (1 point par tâche)

### 9) Mettre en place le HTTPS
Les certificats serveur, c'est-à-dire la clé privée et le certificat, sont chargés pour activer le chiffrement. Un serveur HTTPS dédié a été mis en place, avec une redirection automatique de HTTP vers HTTPS pour forcer le transport sécurisé.

```js
Fichiers: server.js, ssl/private.key et ssl/certificate.crt.
```

Exemple de logique dans le code:
```js
// 1. On charge la clé privée et le certificat.
const credentials = { key: privateKey, cert: certificate };

// 2. On lance le serveur HTTPS avec ces certificats.
https.createServer(credentials, app).listen(HTTPS_PORT);

// 3. Les requêtes HTTP sont redirigées vers HTTPS.
```

### 10) Mettre en place une politique de mot de passe fort avec indicateur de force
Une politique de mot de passe fort a été ajoutée avec des règles sur la longueur minimale, les majuscules, les minuscules et les caractères spéciaux. La vérification se fait aussi côté backend pour que la règle reste valable même si le frontend est contourné. Un indicateur visuel aide aussi l'utilisateur à voir si son mot de passe est assez solide.

```js
Fichiers: controllers/AuthController.js, public/js/register.js et views/register.html.
```

Exemple de logique dans le code:
```js
// 1. On regarde si le mot de passe respecte chaque critère.
const criteria = validatePasswordCriteria(password);

// 2. On calcule une force simple avec des points.
const strength = calculateStrength(criteria);

// 3. Le frontend affiche ensuite un retour visuel plus humain.
```

### 11) Limiter la duree du token JWT et implementer un refresh token
Le token d'accès a une durée courte configurable via `JWT_EXPIRES_IN` (15 minutes par défaut) et il est accompagné d'un refresh token avec sa propre durée de vie. Quand le token expire, l'endpoint `/api/auth/refresh` renouvelle la session et le client peut repartir sans que l'utilisateur ait à se reconnecter.

```js
Fichiers : utils/tokens.js, controllers/AuthController.js, controllers/TwoFactorController.js, routes/Auth.js et public/js/auth.js.
```

Exemple de logique dans le code:
```js
// 1. On signe un token d'accès court.
const token = signToken(user);

// 2. On signe aussi un refresh token plus long.
const nextRefreshToken = signRefreshToken(user);

// 3. Si le token expire, le frontend appelle /api/auth/refresh.
```
### 12) Audit des dependances NPM + correction + documentation
### 13) Test resistance hash (John The Ripper, rainbow tables)
### 14) Gestion d'exceptions sans fuite d'information
Les erreurs API ont été uniformisées avec un helper commun qui renvoie toujours un message clair et un code stable. Un gestionnaire global d'exceptions centralise aussi les erreurs côté serveur. Les routes API inexistantes et les problèmes d'upload renvoient désormais des réponses cohérentes, sans exposer de détails techniques inutiles.

```js
Fichiers : utils/apiResponse.js, server.js et les contrôleurs .
```

Exemple de logique dans le code:
```js
// 1. On envoie un message simple au client.
return sendError(res, 500, 'Une erreur est survenue côté serveur.', 'DB_QUERY_ERROR');

// 2. Le helper garde toujours la même forme de réponse.
return sendSuccess(res, { message: 'Profil mis à jour.' });

// 3. Le détail technique reste côté serveur, pas dans le navigateur.
```

## 6.3 Activités moyennes à choix (2 points par tâche)

### 15) Limiter le nombre de tentatives de login (ex: 5 essais/minute/IP)
Un middleware de rate limit protège la route `/api/auth/login`. La fenêtre est de 60 secondes, avec un blocage après 5 tentatives et une réponse HTTP 429. Le header `Retry-After` indique aussi combien de temps il faut attendre avant de réessayer.

```js
Fichiers : middleware/loginRateLimit.js et routes/Auth.js.
```

Exemple de logique dans le code:
```js
// 1. On compte les requêtes par IP.
const existing = attemptsByIp.get(ip);

// 2. Si la limite est atteinte, on bloque.
if (existing.count >= MAX_ATTEMPTS) {
	res.set('Retry-After', String(retryAfterSeconds));
	return sendError(res, 429, 'Trop de tentatives de connexion. Réessayez dans une minute.', 'AUTH_RATE_LIMIT');
}

// 3. Sinon on laisse passer et on incrémente le compteur.
```

### 16) Verrouillage de compte apres N echecs + stockage BDD + deblocage
Un compte se verrouille maintenant après un certain nombre d'échecs, fixé dans une constante, soit 8 essais pour une limite de 5. L'état du verrouillage est enregistré en base avec le compteur d'échecs. Le login bloque ensuite ces comptes, et l'administration peut les débloquer depuis le tableau administrateur.

```js
Fichiers : controllers/AuthController.js, controllers/AdminController.js, middleware/loginRateLimit.js, routes/Admin.js, db/init/init.sql et views/admin.html.
```

Exemple de logique dans le code:

```js
// 1. On compte l'échec courant en plus de ceux déjà enregistrés.
const newAttempts = Number(user.failed_login_attempts || 0) + 1;

// 2. Si on atteint le seuil, on bloque le compte tout de suite.
if (newAttempts >= ACCOUNT_LOCK_THRESHOLD) {
	db.query(
		'UPDATE users SET failed_login_attempts = ?, account_locked = 1, account_locked_at = NOW() WHERE id = ?',
		[newAttempts, user.id],
		() => {}
	);
	return sendError(res, 423, 'Trop d\'essais échoués. Compte verrouillé. Contactez un administrateur.', 'AUTH_ACCOUNT_LOCKED');
}

// 3. Sinon, on garde seulement le compteur à jour.
db.query(
	'UPDATE users SET failed_login_attempts = ? WHERE id = ?',
	[newAttempts, user.id],
	() => {}
);
```
### 17) Audit securite OWASP Top 10 2025
### 18) Chiffrement des donnees sensibles en base
### 19) Correction d'une faille XSS identifiee
### 20) Moindre privilège BDD avec utilisateur dédié scripts

## 6.4 Activités difficiles à choix (3 points par tâche)

### 1) Protection CSRF sur un formulaire
### 2) Journalisation sécurisée des événements
### 3) Authentification a double facteur
Une authentification à double facteur TOTP compatible avec Google, Microsoft Authenticator et d'autre a été mise en place avec le package **speakeasy** et **qrcode**. L'activation et la désactivation se font depuis la page profil, avec un QR code ou une clé manuelle. La connexion se déroule en deux étapes: d'abord le mot de passe, puis le code 2FA si la protection est active. Les identifiants de challenge s'appuient sur des UUID et `APP_INSTANCE_UUID`.

```js
Fichiers : controllers/AuthController.js, routes/Auth.js, views/login.html, public/js/login.js, views/profile.html, db/init/init.sql et ../.env.example.
```

Exemple de logique dans le code:

```js
// 1. L'utilisateur saisit son mot de passe, puis on prépare un challenge 2FA.
if (user.two_fa_enabled && user.two_fa_secret) {
	const challengeId = TwoFactorController.createLoginChallenge(user);
	return sendSuccess(res, {
		requires2FA: true,
		challengeId,
		user: {
			id: user.id,
			username: user.username,
			email: user.email,
			role: user.role
		}
	});
}

// 2. Le frontend envoie ensuite le code TOTP.
const verified = speakeasy.totp.verify({
	secret: challenge.secret,
	encoding: 'base32',
	token: String(code).replace(/\s+/g, ''),
	window: 1
});

// 3. Si le code est bon, on émet les tokens de session.
if (verified) {
	const token = signAccessToken(challenge.user);
	const refreshToken = signRefreshToken(challenge.user);
}
```
### 4) Sécurisation de l'upload photo contre fichiers malveillants
### 5) Scan OWASP ZAP + correction d'au moins 3 alertes

## Résumé des points (état actuel)

Le bilan actuel est de 8 activités obligatoires valides sur 8, 3 activités faciles valides sur 6, 1 activité moyenne valide sur 6 et 1 activité difficile valide sur 5. En comptant seulement les tâches marquées FAIT, le total actuel estimé est de 19 points.
