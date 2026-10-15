<?php
include_once '../../config/cors_headers.php';
include_once '../../config/api_helpers.php';

// Solo POST: con GET basterebbe un link o un'immagine su un altro sito per disconnettere l'utente
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => t_server('common.method_not_allowed')]);
    exit;
}

// Start session
session_start();

// Clear all session variables
$_SESSION = array();

// Destroy the session
session_destroy();

http_response_code(200);

echo json_encode(array("message" => t_server('auth.logout_ok')));