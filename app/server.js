require('dotenv').config({ path: '../.env' });

const express = require("express");
const path = require("path");
const https = require("https");
const http = require("http");
const fs = require("fs");
const { sendError } = require('./utils/apiResponse');

const app = express();

// Lecture des certificats SSL
const privateKeyPath = path.join(__dirname, 'ssl', 'private.key');
const certificatePath = path.join(__dirname, 'ssl', 'certificate.crt');
const uploadDirectory = path.join(__dirname, 'public', 'uploads');

const privateKey = fs.readFileSync(privateKeyPath, 'utf8');
const certificate = fs.readFileSync(certificatePath, 'utf8');
const credentials = { key: privateKey, cert: certificate };

fs.mkdirSync(uploadDirectory, { recursive: true });

const uploadErrors = {
    LIMIT_PART_COUNT: [413, "Trop de parties dans l'upload", 'UPLOAD_PART_LIMIT'],
    LIMIT_FILE_SIZE: [413, 'Fichier trop volumineux', 'UPLOAD_FILE_TOO_LARGE'],
    LIMIT_FILE_COUNT: [400, 'Trop de fichiers envoyes', 'UPLOAD_FILE_COUNT_LIMIT'],
    LIMIT_FIELD_KEY: [400, 'Nom de champ trop long', 'UPLOAD_FIELD_KEY_LIMIT'],
    LIMIT_FIELD_VALUE: [400, 'Valeur de champ trop longue', 'UPLOAD_FIELD_VALUE_LIMIT'],
    LIMIT_FIELD_COUNT: [400, 'Trop de champs envoyes', 'UPLOAD_FIELD_COUNT_LIMIT'],
    LIMIT_UNEXPECTED_FILE: [400, 'Fichier inattendu', 'UPLOAD_UNEXPECTED_FILE']
};

// Middleware pour parser le corps des requêtes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware de redirection HTTP -> HTTPS
app.use((req, res, next) => {
    if (req.protocol !== 'https') {
        res.redirect(301, `https://${req.get('host')}${req.originalUrl}`);
    } else {
        next();
    }
});

// Fichiers statiques (CSS, images, uploads...)
app.use(express.static(path.join(__dirname, "public")));

// ---------------------------------------------------------------
// Routes API (retournent du JSON)
// ---------------------------------------------------------------
const authRoute    = require("./routes/Auth");
const profileRoute = require("./routes/Profile");
const adminRoute   = require("./routes/Admin");
const productsRoute = require("./routes/Products");

app.use("/api/auth",    authRoute);
app.use("/api/profile", profileRoute);
app.use("/api/admin",   adminRoute);
app.use("/api/products", productsRoute);

// ---------------------------------------------------------------
// Routes pages (retournent du HTML)
// ---------------------------------------------------------------
const homeRoute = require("./routes/Home");
const userRoute = require("./routes/User");

app.use("/", homeRoute);
app.use("/user", userRoute);

app.get("/login",    (_req, res) => res.sendFile(path.join(__dirname, "views", "login.html")));
app.get("/register", (_req, res) => res.sendFile(path.join(__dirname, "views", "register.html")));
app.get("/profile",  (_req, res) => res.sendFile(path.join(__dirname, "views", "profile.html")));
app.get("/admin",    (_req, res) => res.sendFile(path.join(__dirname, "views", "admin.html")));
app.get("/test",     (_req, res) => res.send("db admin: root, pwd : root"));

// Reponse uniforme pour routes API non trouvees.
app.use('/api', (_req, res) => {
    return sendError(res, 404, 'Ressource API introuvable', 'API_NOT_FOUND');
});

// Gestion globale des exceptions pour eviter les fuites d'information.
app.use((err, _req, res, next) => {
    console.error('Erreur non geree:', err && err.message ? err.message : err);

    if (res.headersSent) {
        return next(err);
    }

    if (err && (err.type === 'entity.parse.failed' || (err instanceof SyntaxError && err.status === 400 && 'body' in err))) {
        return sendError(res, 400, 'Requete JSON invalide', 'INVALID_JSON_BODY');
    }

    if (err && (err.type === 'entity.too.large' || err.status === 413)) {
        return sendError(res, 413, 'Requete trop volumineuse', 'PAYLOAD_TOO_LARGE');
    }

    if (err && err.type === 'request.aborted') {
        return sendError(res, 400, 'Requete interrompue', 'REQUEST_ABORTED');
    }

    if (err && err.name === 'MulterError') {
        const mappedUploadError = uploadErrors[err.code] || [400, 'Fichier invalide', 'UPLOAD_INVALID_FILE'];
        return sendError(res, mappedUploadError[0], mappedUploadError[1], mappedUploadError[2]);
    }

    if (err && ['ENOENT', 'EACCES', 'EPERM', 'ENOSPC'].includes(err.code)) {
        return sendError(res, 500, 'Impossible de traiter le fichier', 'UPLOAD_STORAGE_ERROR');
    }

    return sendError(res, 500, 'Erreur serveur', 'INTERNAL_SERVER_ERROR');
});

// Démarrage des serveurs HTTP et HTTPS
const HTTP_PORT = 8080;
const HTTPS_PORT = 8443;

// Server HTTP (redirige vers HTTPS)
http.createServer(app).listen(HTTP_PORT, () => {
    console.log(`Serveur HTTP démarré sur http://localhost:${HTTP_PORT}`);
    console.log(`Les requêtes HTTP seront redirigées vers HTTPS`);
});

// Server HTTPS
https.createServer(credentials, app).listen(HTTPS_PORT, () => {
    console.log(`Serveur HTTPS démarré sur https://localhost:${HTTPS_PORT}`);
    console.log(`Application sécurisée disponible sur https://localhost:${HTTPS_PORT}`);
});
