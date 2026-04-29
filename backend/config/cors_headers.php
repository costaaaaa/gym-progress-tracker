<?php
// Forza la disattivazione degli errori per non sporcare l'output JSON
error_reporting(0);
ini_set('display_errors', 0);

// Avvia l'output buffering immediatamente
ob_start();

// Common CORS headers for all API endpoints
$default_allowed_origins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://andreacostamagna.altervista.org'
];

// Get the origin from the request headers
$http_origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : null;
$configured_origins = getenv('CORS_ALLOWED_ORIGINS');
$allowed_origins = $configured_origins
    ? array_map('trim', explode(',', $configured_origins))
    : $default_allowed_origins;

// Gestione centralizzata della sessione
if (session_status() === PHP_SESSION_NONE) {
    // Configura i parametri della sessione prima di avviarla (se necessario)
    // ini_set('session.cookie_httponly', 1);
    session_start();
}

// Verifica e pulizia sessione se dati inconsistenti
if (isset($_SESSION['user_id']) && empty($_SESSION['username'])) {
    // Se abbiamo ID ma non username, qualcosa non va
    session_unset();
    session_destroy();
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
}

// Set CORS headers
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");
header("Vary: Origin");

if ($http_origin && in_array($http_origin, $allowed_origins, true)) {
    header("Access-Control-Allow-Origin: {$http_origin}");
    header("Access-Control-Allow-Credentials: true");
}

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code($http_origin && !in_array($http_origin, $allowed_origins, true) ? 403 : 200);
    exit;
}
