<?php
// POST (senza corpo): annulla il cambio di indirizzo in attesa e i codici mandati al nuovo indirizzo.
// Idempotente: 200 {success, message, cancelled: bool} anche se non c'era nulla da annullare.
// Raggiungibile anche dal giorno 8 (ALLOW_UNVERIFIED).
include_once '../../config/cors_headers.php';
include_once '../../config/database.php';
include_once '../../config/api_helpers.php';
include_once '../../models/EmailVerification.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    api_json_response(array('success' => false, 'message' => t_server('common.method_not_allowed')), 405);
}

try {
    $database = new Database();
    $db = $database->getConnection();
    $user_id = require_authenticated_user($db, ALLOW_UNVERIFIED);

    $cancelled = (new EmailVerification($db))->cancelChange($user_id);
    api_json_response(array('success' => true, 'message' => t_server('email.change_cancelled'), 'cancelled' => $cancelled));
} catch (Exception $e) {
    error_log("Cancel email change error: " . $e->getMessage());
    api_json_response(array('success' => false, 'message' => t_server('email.error')), 500);
}
