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
| 11) Limiter la durée du token JWT et refresh token | NON FAIT |
| 12) Audit des dépendances NPM | NON FAIT |
| 13) Test de résistance du hash | NON FAIT |
| 14) Gestion d'exceptions sans fuite d'information | FAIT |
| 15) Limiter les tentatives de login | FAIT |
| 16) Verrouillage de compte après échecs | NON FAIT |
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
Cette fonctionnalité ajoute une page de connexion avec un formulaire email et mot de passe. Elle intègre aussi une validation côté client, l'affichage des erreurs et des succès, ainsi que la désactivation du bouton pendant la requête. Une requête POST est envoyée vers /api/auth/login, puis la session est stockée dans localStorage avec le token et les données utilisateur. Après une connexion réussie, l'utilisateur est redirigé automatiquement vers la page profil. Fichiers concernés: views/login.html et public/js/login.js.

### 2) Implementer une page d'inscription en frontend
Cette fonctionnalité ajoute une page d'inscription avec username, email, mot de passe et confirmation. Les champs obligatoires sont vérifiés, de même que la correspondance des mots de passe. Le frontend appelle ensuite l'API POST /api/auth/register et gère les erreurs métier comme un email dupliqué ou une validation invalide. Une fois l'inscription terminée, la connexion se fait automatiquement avec redirection vers /profile. Fichiers concernés: views/register.html et public/js/register.js.

### 3) Remplacer les mots de passe en clair dans la base par un hash
Les mots de passe sont hashés à l'inscription avec bcryptjs afin de ne plus les stocker en clair. À la connexion, le hash est vérifié avec bcrypt.compareSync. Le code reste compatible avec les anciens comptes en clair et prévoit une migration progressive vers le hash au moment de la connexion. Fichiers concernés: controllers/AuthController.js et package.json.

### 4) Ajouter un sel
Un sel aléatoire est généré pour chaque utilisateur avec crypto.randomBytes. La colonne password_salt a été ajoutée dans la table users. Ce sel entre dans le calcul du hash et est stocké en base pour permettre la vérification ultérieure. Fichiers concernés: controllers/AuthController.js et db/init/init.sql.

### 5) Ajouter un poivre
Un poivre applicatif est chargé depuis les variables d'environnement pour renforcer le hash. Le secret est composé sous la forme password + salt + pepper avant le passage dans bcrypt. Ce poivre n'est pas stocké en base, il reste uniquement côté application. Fichiers concernés: controllers/AuthController.js et .env.

### 6) Corriger les requetes existantes afin de prevenir l'injection SQL
Les requêtes critiques ont été converties en requêtes paramétrées avec des placeholders ? afin de limiter les injections SQL. Les concaténations directes de données utilisateur dans le SQL ont été supprimées. Cette correction s'applique aux parties sensibles de l'authentification et du profil, notamment les SELECT, INSERT et UPDATE. Fichiers concernés: controllers/AuthController.js et controllers/ProfileController.js.

### 7) Implementer l'utilisation d'un token JWT
Un JWT est généré après login ou inscription avec les données id, email et rôle. Ce token est ensuite vérifié par un middleware d'authentification sur les routes protégées. Un helper frontend a aussi été ajouté pour injecter automatiquement l'en-tête Authorization: Bearer. Fichiers concernés: controllers/AuthController.js, middleware/auth.js et public/js/auth.js.

### 8) Ajouter les roles administrateur et utilisateur dans le JWT et proteger les routes d'administration
Le rôle a été ajouté dans le payload JWT pour distinguer administrateur et utilisateur. Côté backend, un contrôle requireAdmin a été créé afin de protéger les routes d'administration avec la combinaison auth + requireAdmin. Côté frontend, une vérification redirige hors de la page admin si le rôle n'est pas autorisé. Fichiers concernés: middleware/auth.js, routes/Admin.js et public/js/auth.js.

## 6.2 Activités faciles à choix (1 point par tâche)

### 9) Mettre en place le HTTPS
Les certificats serveur, c'est-à-dire la clé privée et le certificat, sont chargés pour activer le chiffrement. Un serveur HTTPS dédié a été mis en place, avec une redirection automatique de HTTP vers HTTPS pour forcer le transport sécurisé. Fichiers concernés: server.js, ssl/private.key et ssl/certificate.crt.

### 10) Mettre en place une politique de mot de passe fort avec indicateur de force
Une politique de mot de passe fort a été mise en place avec des règles sur la longueur minimale, les majuscules, les minuscules et les caractères spéciaux. La validation est contrôlée côté backend pour rester efficace même si le frontend est contourné. Un indicateur de force dynamique a aussi été ajouté côté frontend pour afficher l'état des critères. Fichiers concernés: controllers/AuthController.js, public/js/register.js et views/register.html.

### 11) Limiter la duree du token JWT et implementer un refresh token
### 12) Audit des dependances NPM + correction + documentation
### 13) Test resistance hash (John The Ripper, rainbow tables)
### 14) Gestion d'exceptions sans fuite d'information
Les erreurs API ont été uniformisées avec un helper commun au format stable message + code. Un handler global d'exceptions a aussi été centralisé dans le serveur. En plus, les routes API inexistantes et les erreurs d'upload renvoient une réponse uniforme afin d'éviter l'exposition de détails techniques internes.

## 6.3 Activités moyennes à choix (2 points par tâche)

### 15) Limiter le nombre de tentatives de login (ex: 5 essais/minute/IP)
Un middleware de rate limit a été ajouté sur la route /api/auth/login. La fenêtre est de 60 secondes, avec blocage après 5 tentatives et retour HTTP 429. Le header Retry-After informe aussi sur le délai restant. Fichiers concernés: middleware/loginRateLimit.js et routes/Auth.js.

### 16) Verrouillage de compte apres N echecs + stockage BDD + deblocage
### 17) Audit securite OWASP Top 10 2025
### 18) Chiffrement des donnees sensibles en base
### 19) Correction d'une faille XSS identifiee
### 20) Moindre privilège BDD avec utilisateur dédié scripts

## 6.4 Activités difficiles à choix (3 points par tâche)

### 1) Protection CSRF sur un formulaire
### 2) Journalisation sécurisée des événements
### 3) Authentification a double facteur
Une authentification à double facteur TOTP compatible Google Authenticator a été mise en place. L'activation et la désactivation se font depuis la page profil avec QR code et clé manuelle. La connexion se déroule en deux étapes, d'abord le mot de passe puis le code 2FA si la protection est activée. Les identifiants de challenge utilisent des UUID scopes avec APP_INSTANCE_UUID et randomUUID. Fichiers concernés: controllers/AuthController.js, routes/Auth.js, views/login.html, public/js/login.js, views/profile.html, db/init/init.sql et ../.env.example.
### 4) Sécurisation de l'upload photo contre fichiers malveillants
### 5) Scan OWASP ZAP + correction d'au moins 3 alertes

## Résumé des points (état actuel)

Le bilan actuel est de 8 activités obligatoires valides sur 8, 3 activités faciles valides sur 6, 1 activité moyenne valide sur 6 et 1 activité difficile valide sur 5. En comptant seulement les tâches marquées FAIT, le total actuel estimé est de 15 points.
