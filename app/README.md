# secured_webshop - suivi detaille des activites securite

Ce document explique les changements realises pour chaque activite deja implementee dans le projet.

## 6.1 Activites obligatoires (1 point par tache)

### 1) Implementer une page de login en frontend - FAIT
- Ajout d'une page de connexion avec formulaire email/mot de passe.
- Ajout de validation client, affichage des erreurs/succes, desactivation du bouton pendant la requete.
- Envoi d'une requete POST vers /api/auth/login puis stockage de la session (token + user) en localStorage.
- Redirection automatique vers la page profil apres connexion reussie.
- Fichiers: views/login.html, public/js/login.js.

### 2) Implementer une page d'inscription en frontend - FAIT
- Ajout d'une page d'inscription avec username, email, mot de passe, confirmation.
- Verification des champs obligatoires et de la correspondance des mots de passe.
- Appel API POST /api/auth/register et gestion des retours d'erreur metier (email duplique, validation, etc.).
- Connexion automatique apres inscription et redirection vers /profile.
- Fichiers: views/register.html, public/js/register.js.

### 3) Remplacer les mots de passe en clair dans la base par un hash - FAIT
- Utilisation de bcryptjs pour hasher les mots de passe a l'inscription.
- Verification du hash a la connexion avec bcrypt.compareSync.
- Compatibilite prevue pour les anciens comptes en clair et migration progressive vers hash lors de la connexion.
- Fichiers: controllers/AuthController.js, package.json.

### 4) Ajouter un sel - FAIT
- Generation d'un sel aleatoire par utilisateur (crypto.randomBytes).
- Ajout de la colonne password_salt dans la table users.
- Le sel est utilise dans l'entree du hash et stocke en base pour verification ulterieure.
- Fichiers: controllers/AuthController.js, db/init/init.sql.

### 5) Ajouter un poivre - FAIT
- Ajout d'un poivre applicatif charge depuis les variables d'environnement.
- Composition du secret hash sous la forme password + salt + pepper avant bcrypt.
- Le poivre n'est pas stocke en base, il reste cote application.
- Fichiers: controllers/AuthController.js, .env.

### 6) Corriger les requetes existantes afin de prevenir l'injection SQL - FAIT
- Passage des requetes critiques en requetes parametrees avec placeholders ?.
- Suppression de concatenations directes de donnees utilisateur dans les requetes SQL.
- Application sur l'authentification et le profil (SELECT, INSERT, UPDATE sensibles).
- Fichiers: controllers/AuthController.js, controllers/ProfileController.js.

### 7) Implementer l'utilisation d'un token JWT - FAIT
- Generation d'un JWT apres login/register contenant id, email et role.
- Verification du JWT via middleware d'authentification sur routes protegees.
- Ajout d'un helper frontend pour injecter le header Authorization: Bearer.
- Fichiers: controllers/AuthController.js, middleware/auth.js, public/js/auth.js.

### 8) Ajouter les roles administrateur et utilisateur dans le JWT et proteger les routes d'administration - FAIT
- Ajout du role dans le payload JWT.
- Creation du controle requireAdmin cote backend.
- Protection des routes admin avec combinaison auth + requireAdmin.
- Verification frontend avec redirection hors page admin si role non autorise.
- Fichiers: middleware/auth.js, routes/Admin.js, public/js/auth.js.

## 6.2 Activites faciles a choix (1 point par tache)

### 9) Mettre en place le HTTPS - FAIT
- Chargement des certificats serveur (cle privee + certificat).
- Demarrage d'un serveur HTTPS dedie.
- Redirection automatique HTTP vers HTTPS pour forcer le chiffrement du transport.
- Fichiers: server.js, ssl/private.key, ssl/certificate.crt.

### 10) Mettre en place une politique de mot de passe fort avec indicateur de force - FAIT
- Regles imposees: longueur minimale, majuscule, minuscule, caractere special.
- Validation backend pour garantir la regle meme si le frontend est contourne.
- Indicateur de force dynamique cote frontend avec etat visuel des criteres.
- Fichiers: controllers/AuthController.js, public/js/register.js, views/register.html.

### 11) Limiter la duree du token JWT et implementer un refresh token - NON FAIT
### 12) Audit des dependances NPM + correction + documentation - NON FAIT
### 13) Test resistance hash (John The Ripper, rainbow tables) - NON FAIT
### 14) Gestion d'exceptions sans fuite d'information - FAIT
- Uniformisation des erreurs API avec un helper commun (format stable: message + code).
- Centralisation d'un handler global d'exceptions dans le serveur.
- Ajout d'une reponse uniforme pour les routes API inexistantes (404) et les erreurs d'upload.
- Objectif: eviter l'exposition de details techniques internes dans les reponses.

## 6.3 Activites moyennes a choix (2 points par tache)

### 15) Limiter le nombre de tentatives de login (ex: 5 essais/minute/IP) - FAIT
- Middleware de rate limit dedie a la route /api/auth/login.
- Fenetre de 60 secondes, blocage apres 5 tentatives, retour HTTP 429.
- Ajout du header Retry-After pour indiquer le delai restant.
- Fichiers: middleware/loginRateLimit.js, routes/Auth.js.

### 16) Verrouillage de compte apres N echecs + stockage BDD + deblocage - NON FAIT
### 17) Audit securite OWASP Top 10 2025 - NON FAIT
### 18) Chiffrement des donnees sensibles en base - NON FAIT
### 19) Correction d'une faille XSS identifiee - NON FAIT
### 20) Moindre privilege BDD avec utilisateur dedie scripts - NON FAIT

## 6.4 Activites difficiles a choix (3 points par tache)

### 1) Protection CSRF sur un formulaire - NON FAIT
### 2) Journalisation securisee des evenements - NON FAIT
### 3) Authentification a double facteur - NON FAIT
### 4) Securisation upload photo contre fichiers malveillants - NON FAIT
### 5) Scan OWASP ZAP + correction d'au moins 3 alertes - NON FAIT

## Resume des points (etat actuel)

- Obligatoires valides: 8 / 8.
- Faciles valides: 3 / 6.
- Moyennes valides: 1 / 6.
- Difficiles valides: 0 / 5.

Total actuel estime (en comptant seulement les taches FAIT): 12 points.
