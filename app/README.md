# secured_webshop - securite

Ce README resume rapidement les changements de securite implementes par rapport au projet original.

## Objectif
Rendre l'application plus sure pour l'authentification, la protection des routes, la base de donnees et le transport reseau.

## Changements

1. Login frontend
- Formulaire de connexion + message d'erreur/succes + redirection.
- Fichiers: views/login.html, public/js/login.js.

Exemple:
```js
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});
```

2. Register frontend
- Formulaire d'inscription complet + validation + confirmation du mot de passe.
- Fichiers: views/register.html, public/js/register.js.

3. Mots de passe hashes
- Passage du stockage en clair a bcrypt.
- Fichier: controllers/AuthController.js.

Exemple:
```js
const passwordHash = bcrypt.hashSync(composePasswordInput(password, passwordSalt), 10);
```

4. Sel (salt)
- Ajout d'un sel par utilisateur et colonne en DB (`password_salt`).
- Fichiers: db/init/init.sql, controllers/AuthController.js.

Exemple SQL:
```sql
ALTER TABLE users ADD COLUMN password_salt VARCHAR(64);
```

5. Poivre (pepper)
- Ajout d'un secret applicatif depuis les variables d'environnement.
- Fichiers: .env, controllers/AuthController.js.

Exemple:
```js
const PASSWORD_PEPPER = process.env.PASSWORD_PEPPER;
const input = `${password}|${salt}|${PASSWORD_PEPPER}`;
```

6. Prevention SQL injection
- Requetes parametrees (`?`) au lieu de concatenation de chaines.
- Fichiers: controllers/AuthController.js, controllers/ProfileController.js.

Exemple:
```js
db.query('SELECT * FROM users WHERE email = ?', [email], callback);
```

7. JWT
- Creation de token a la connexion/inscription + verification middleware.
- Fichiers: controllers/AuthController.js, middleware/auth.js, public/js/auth.js.

Exemple:
```js
const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '2h' });
```

8. Roles dans JWT + protection admin
- Ajout du role dans le token et blocage des routes admin si role != admin.
- Fichiers: middleware/auth.js, routes/Admin.js.

Exemple:
```js
router.get('/users', auth, auth.requireAdmin, controller.getUsers);
```

9. HTTPS
- Serveur HTTPS + redirection HTTP -> HTTPS.
- Fichiers: server.js, ssl/certificate.crt, ssl/private.key.

Exemple:
```js
http.createServer(app).listen(8080);
https.createServer(credentials, app).listen(8443);
```

10. Politique mot de passe fort + indicateur de force
- Regles: min 8, majuscule, minuscule, caractere special.
- Verification frontend + backend.
- Fichiers: public/js/register.js, controllers/AuthController.js.

Exemple:
```js
const hasUpperCase = /[A-Z]/.test(password);
const hasLowerCase = /[a-z]/.test(password);
const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?\s]/.test(password);
```

## Pourquoi ces changements
- Reduire le risque de vol de compte.
- Limiter les attaques courantes (SQL injection, vol de mot de passe, acces non autorise).
- Chiffrer les echanges reseau.
- Ajouter un controle d'acces clair entre user et admin.
