require('dotenv').config({ path: '../.env' });

const express = require("express");
const path = require("path");
const https = require("https");
const http = require("http");
const fs = require("fs");

const app = express();

// Lecture des certificats SSL
const privateKeyPath = path.join(__dirname, 'ssl', 'private.key');
const certificatePath = path.join(__dirname, 'ssl', 'certificate.crt');

const privateKey = fs.readFileSync(privateKeyPath, 'utf8');
const certificate = fs.readFileSync(certificatePath, 'utf8');
const credentials = { key: privateKey, cert: certificate };

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

app.use("/api/auth",    authRoute);
app.use("/api/profile", profileRoute);
app.use("/api/admin",   adminRoute);

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
