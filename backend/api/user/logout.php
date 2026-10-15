<?php
include_once '../../config/cors_headers.php';
include_once '../../config/api_helpers.php';

// Solo POST: con GET basterebbe un link o un'immagine su un altro sito per disconnettere l'utente
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => t_server('common.method_not_allowed')]);
    exit;
}

// La sessione l'ha già avviata cors_headers.php (non con un header Bearer: allora non c'è nulla da chiudere)
if (session_status() === PHP_SESSION_ACTIVE) {
    $_SESSION = array();
    session_destroy();
}

http_response_code(200);

echo json_encode(array("message" => t_server('auth.logout_ok')));