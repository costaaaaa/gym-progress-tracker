<?php
// POST (senza corpo): manda un codice nuovo all'indirizzo da confermare (quello dell'account o, se c'è un
// cambio in attesa, quello nuovo); il codice precedente non vale più. Al massimo uno ogni 2 minuti e 5
// all'ora per utente (contano tutti gli invii, anche della registrazione e del cambio di indirizzo).
// Risposte: 200 {success, message}; 409 email_already_verified; 429 email_resend_wait {retry_after} con
// l'header Retry-After. Raggiungibile anche dal giorno 8 (ALLOW_UNVERIFIED). L'email parte dopo la risposta.
include_once '../../config/cors_headers.php';
include_once '../../config/database.php';
include_once '../../config/api_helpers.php';
include_once '../../models/EmailVerification.php';
include_once '../../lib/email_verification_mail.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    api_json_response(array('success' => false, 'message' => t_server('common.method_not_allowed')), 405);
}

try {
    $database = new Database();
    $db = $database->getConnection();
    $user_id = require_authenticated_user($db, ALLOW_UNVERIFIED);

    $result = (new EmailVerification($db))->resend($user_id);
    switch ($result['status']) {
        case 'sent':
            email_verification_send_code_later($result['email'], $result['username'], $result['locale'], $result['code'], $result['is_change']);
            api_json_response(array('success' => true, 'message' => t_server('email.code_sent')));
        case 'wait':
            api_email_resend_wait($result['seconds']);
        case 'already_verified':
            api_error(409, 'email_already_verified', t_server('email.already_confirmed'));
        default:
            api_not_found(t_server('common.user_not_found'));
    }
} catch (Exception $e) {
    error_log("Resend email code error: " . $e->getMessage());
    api_json_response(array('success' => false, 'message' => t_server('email.error')), 500);
}
