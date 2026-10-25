<?php
// Gli errori PHP non vanno mai a video (sporcherebbero l'output JSON e rivelerebbero
// percorsi e query) ma restano nel log del server, per poterli diagnosticare.
error_reporting(E_ALL & ~E_DEPRECATED);
ini_set('display_errors', '0');
ini_set('log_errors', '1');

// Un solo fuso orario per tutto il backend: le settimane ISO di streak e classifiche
// dipendono dall'ora del server.
date_default_timezone_set('Europe/Rome');

// Avvia l'output buffering immediatamente
ob_start();

// Rete di sicurezza per ogni endpoint: un'eccezione non gestita (errore del database, tipo inatteso
// nel JSON ricevuto) o un errore fatale diventa un 500 JSON generico invece di una risposta vuota.
// Il dettaglio resta nel log. Qui api_helpers.php potrebbe non essere ancora caricato: niente api_log_exception().
function unhandled_error_response($detail)
{
    error_log($detail);
    if (ob_get_length()) {
        ob_clean();
    }
    http_response_code(500);
    header('Content-Type: application/json; charset=UTF-8');
    echo json_encode(array(
        'success' => false,
        'message' => function_exists('t_server') ? t_server('common.server_error') : 'Internal server error.',
    ));
}

set_exception_handler(function ($e) {
    unhandled_error_response('Eccezione non gestita (' . get_class($e) . '): ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
});

// Gli errori fatali (anche memoria esaurita) non passano dall'exception handler: php-fpm risponderebbe 500 vuoto.
register_shutdown_function(function () {
    $error = error_get_last();
    $fatal = E_ERROR | E_PARSE | E_CORE_ERROR | E_COMPILE_ERROR;
    if ($error !== null && ($error['type'] & $fatal) && !headers_sent()) {
        unhandled_error_response('Errore fatale: ' . $error['message'] . ' in ' . $error['file'] . ':' . $error['line']);
    }
});

// Common CORS headers for all API endpoints
$default_allowed_origins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://liftindex.app',
    'https://www.liftindex.app'
];

// Get the origin from the request headers
$http_origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : null;
$configured_origins = getenv('CORS_ALLOWED_ORIGINS');
$allowed_origins = $configured_origins
    ? array_map('trim', explode(',', $configured_origins))
    : $default_allowed_origins;

// Client mobile (React Native): stateless, autenticati via header "Authorization: Bearer <token>",
// non mandano mai il cookie di sessione. Avviare comunque session_start() per loro creerebbe un
// file di sessione e un lock inutili ad ogni richiesta, quindi si salta l'intero blocco sessione
// quando l'header è presente e sintatticamente valido — la validazione vera del token avviene poi
// in resolve_authenticated_user_id() (backend/config/api_helpers.php).
$has_bearer_token = isset($_SERVER['HTTP_AUTHORIZATION']) && stripos($_SERVER['HTTP_AUTHORIZATION'], 'Bearer ') === 0;

if (!$has_bearer_token) {
    // Gestione centralizzata della sessione (percorso web, invariato)
    if (session_status() === PHP_SESSION_NONE) {
        // Flag del cookie di sessione. Secure solo su HTTPS (anche dietro proxy), altrimenti
        // il cookie non verrebbe mai inviato in sviluppo locale su http.
        $is_https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
            || (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && strtolower($_SERVER['HTTP_X_FORWARDED_PROTO']) === 'https');
        // Sessione web di 30 giorni: cookie persistente e pulizia lato server allineata
        $session_lifetime = 30 * 24 * 60 * 60;
        ini_set('session.gc_maxlifetime', (string)$session_lifetime);
        session_set_cookie_params([
            'lifetime' => $session_lifetime,
            'path' => '/',
            'secure' => $is_https,
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
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
}

// Set CORS headers
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With, X-Locale");
header("Vary: Origin");

if ($http_origin && in_array($http_origin, $allowed_origins, true)) {
    header("Access-Control-Allow-Origin: {$http_origin}");
    header("Access-Control-Allow-Credentials: true");
}

// CSRF, oltre a SameSite=Lax: una scrittura fatta con la sessione web deve arrivare da un'origine
// nostra. Senza Origin (curl, test) passa; il client mobile usa il token e non la sessione.
if (
    !$has_bearer_token && isset($_SESSION['user_id']) && $http_origin !== null
    && !in_array($_SERVER['REQUEST_METHOD'], array('GET', 'HEAD', 'OPTIONS'), true)
    && !in_array($http_origin, $allowed_origins, true)
) {
    http_response_code(403);
    echo json_encode(array('success' => false, 'message' => function_exists('t_server') ? t_server('common.forbidden') : 'Forbidden'));
    exit;
}

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code($http_origin && !in_array($http_origin, $allowed_origins, true) ? 403 : 200);
    exit;
}
