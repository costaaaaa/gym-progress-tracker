<?php
// Parte comune degli endpoint dei gruppi: autenticazione (sessione web o Bearer mobile),
// metodo HTTP e corpo JSON. Da solo non risponde a nulla.
include_once __DIR__ . '/../../config/cors_headers.php';
include_once __DIR__ . '/../../config/database.php';
include_once __DIR__ . '/../../config/api_helpers.php';
include_once __DIR__ . '/../../config/rate_limiter.php';
include_once __DIR__ . '/../../models/Group.php';

// Ritorna [$db, $user_id] o esce con 401/405
function groups_bootstrap($method)
{
    header('Content-Type: application/json');
    if ($_SERVER['REQUEST_METHOD'] !== $method) {
        api_error(405, 'method_not_allowed', 'Metodo non consentito');
    }
    $database = new Database();
    $db = $database->getConnection();
    $user_id = resolve_authenticated_user_id($db);
    if (!$user_id) {
        api_error(401, 'unauthenticated', 'Utente non autenticato');
    }
    return array($db, (int)$user_id);
}

function groups_json_body()
{
    $data = json_decode(file_get_contents('php://input'), true);
    return is_array($data) ? $data : array();
}

function groups_group_id($value)
{
    $id = filter_var($value, FILTER_VALIDATE_INT, array('options' => array('min_range' => 1)));
    if ($id === false) {
        api_error(404, 'group_not_found', 'Gruppo non trovato.');
    }
    return $id;
}

// Errore inatteso: si logga senza dati personali e si risponde 500
function groups_fail($context, $e)
{
    api_log_exception($context, $e);
    if (ob_get_length()) ob_clean();
    api_error(500, 'server_error', 'Errore interno del server.');
}
