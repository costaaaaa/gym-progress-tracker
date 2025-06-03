<?php
// Common CORS headers for all API endpoints
// Using wildcard or dynamic origin instead of hardcoded absolute URL

// Get the origin from the request headers
$http_origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '*';

// Prima verifica che la sessione sia iniziata
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Verifica se l'utente è loggato controllando le variabili di sessione
if (isset($_SESSION['user_id']) && isset($_SESSION['username'])) {
    // User is logged in, continue with the request
    if (empty($_SESSION['user_id']) || empty($_SESSION['username'])) {
        // Invalid session data, clear it
        $_SESSION = array();
        session_destroy();
    }
} else {
    // No session data exists, no need to destroy
    // Just ensure we have a valid session for potential login
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
}

// Set CORS headers
header("Access-Control-Allow-Origin: {$http_origin}");
header("Access-Control-Allow-Credentials: true");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}