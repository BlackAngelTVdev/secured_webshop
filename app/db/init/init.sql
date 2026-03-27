-- =============================================================
-- Base de données du webshop
-- =============================================================
-- ATTENTION : Ce fichier contient volontairement des failles
-- de sécurité à corriger dans le cadre du projet.
-- =============================================================

SET NAMES utf8mb4;

CREATE DATABASE IF NOT EXISTS webshop
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;
USE webshop;

-- ---------------------------------------------------------------
-- Table users
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    username   VARCHAR(50)  NOT NULL,
    email      VARCHAR(100) NOT NULL UNIQUE,
    password   VARCHAR(255) NOT NULL,
    password_salt VARCHAR(64),
    role       VARCHAR(20)  NOT NULL DEFAULT 'user',
    address    VARCHAR(255),
    photo_path VARCHAR(255)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ---------------------------------------------------------------
-- Table products
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    description TEXT,
    price       DECIMAL(10, 2) NOT NULL,
    image_url   VARCHAR(500)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ---------------------------------------------------------------
-- Données de départ
-- ---------------------------------------------------------------
INSERT INTO users (username, email, password, password_salt, role, address) VALUES
    ('admin',  'admin@webshop.com', '$2b$10$xrcBHV1M5KBq8LHuOwdQwOlFpS./WRJNPFFm8f8SlfKzGfkEeVJB2', '8f0d3a9b7c1e4d2f9a6b3c5d7e1f2a4b', 'admin', '1 Rue de la Paix, 1000 Lausanne'),
    ('alice',  'alice@webshop.com', '$2b$10$3uQgdWrcjv0n9m2rnvJ7geGVJs4.WiwfvKQwt4rxFxgfGPSobgeBa', '4c2a9e7d1b6f3a8c0e5d2f7b9a1c4e6d', 'user',  '42 Avenue des Alpes, 1200 Genève');

INSERT INTO products (name, description, price, image_url) VALUES
    (
        'Casque Audio Pro X1',
        'Un casque confortable et moderne, parfait pour demarrer une vitrine produit.',
        89.00,
        'https://images.unsplash.com/photo-1518444065439-e933c06ce9cd?auto=format&fit=crop&w=600&q=80'
    ),
    (
        'Clavier Mecanique Nova 75',
        'Clavier compact avec switches tactiles, ideal pour le travail et le gaming.',
        119.00,
        'https://images.unsplash.com/photo-1517336714739-489689fd1ca8?auto=format&fit=crop&w=600&q=80'
    ),
    (
        'Souris Sans Fil Glide M2',
        'Souris precise et legere avec autonomie longue duree.',
        49.90,
        'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?auto=format&fit=crop&w=600&q=80'
    ),
    (
        'Ecran UltraWide 34 pouces',
        'Grand ecran immersif en haute definition pour la productivite.',
        429.00,
        'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=600&q=80'
    ),
    (
        'Webcam HD Focus Pro',
        'Webcam Full HD avec correction automatique de la lumiere.',
        79.00,
        'https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?auto=format&fit=crop&w=600&q=80'
    ),
    (
        'Station d Accueil USB-C Dock 12-en-1',
        'Hub polyvalent avec HDMI, Ethernet, USB et lecteur de cartes.',
        99.00,
        'https://images.unsplash.com/photo-1587202372775-e229f172b9d7?auto=format&fit=crop&w=600&q=80'
    ),
    (
        'Chaise Ergonomique AirMesh',
        'Chaise confortable avec soutien lombaire reglable pour longues sessions.',
        269.00,
        'https://images.unsplash.com/photo-1580480055273-228ff5388ef8?auto=format&fit=crop&w=600&q=80'
    ),
    (
        'Lampe LED Bureau SmartLight',
        'Lampe ajustable avec temperature de couleur variable et variateur tactile.',
        39.90,
        'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=600&q=80'
    );
