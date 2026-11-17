<?php
// POST {email, password}: cambia l'indirizzo email dell'account. La password si controlla con
// password_check_guard (stesso contatore di change_password.php e delete.php) e, se sbagliata, risponde 400
// e non 401 (i client prendono ogni 401 per sessione scaduta).
//  - account non confermato: l'indirizzo cambia subito, i codici vecchi non valgono più, un codice nuovo parte al
//    nuovo indirizzo e i 7 giorni non ripartono ("mode": "immediate");
//  - account confermato: il nuovo indirizzo resta in attesa (pending_email) e l'account resta confermato con il
//    vecchio; diventa quello dell'account solo quando si scrive il codice arrivato al nuovo indirizzo
//    ("mode": "pending"). Si annulla con cancel_email_change.php.
// Risposte: 200 {success, message, mode, email, pending_email}; 400 (indirizzo non valido, password mancante o
// sbagliata, email_same); 409 email_taken {field: "email"}; 429 email_resend_wait {retry_after} (il codice conta
// nei limiti di invio: oltre il limite non cambia nulla) o il 429 di password_check_guard.
// Raggiungibile anche dal giorno 8 (ALLOW_UNVERIFIED).
include_once '../../config/cors_headers.php';
include_once '../../config/database.php';
include_once '../../config/api_helpers.php';
include_once '../../lib/password_check.php';
include_once '../../models/User.php';
include_once '../../models/EmailVerification.php';
include_once '../../lib/email_verification_mail.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    api_json_response(array('success' => false, 'message' => t_server('common.method_not_allowed')), 405);
}

try {
    $database = new Database();
    $db = $database->getConnection();
    $user_id = require_authenticated_user($db, ALLOW_UNVERIFIED);

    $data = json_decode(file_get_contents("php://input"));
    $email = (is_object($data) && isset($data->email) && is_string($data->email)) ? strtolower(trim($data->email)) : '';
    $password = (is_object($data) && isset($data->password) && is_string($data->password)) ? $data->password : '';
    if ($email === '' || $password === '') {
        api_error(400, 'email_change_missing', t_server('email.change_missing'));
    }
    if (strlen($email) > 100 || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        api_error(400, 'email_invalid', t_server('common.email_invalid'));
    }

    password_check_guard($db, $user_id);
    if (!(new User($db))->checkPassword($user_id, $password)) {
        password_check_failed($db, $user_id);
        // 400 e non 401: i client trattano ogni 401 come sessione scaduta e fanno logout
        api_error(400, 'wrong_password', t_server('email.wrong_password'));
    }
    password_check_ok($db, $user_id);

    $result = (new EmailVerification($db))->requestChange($user_id, $email);
    switch ($result['status']) {
        case 'sent':
            email_verification_send_code_later($result['email'], $result['username'], $result['locale'], $result['code'], true);
            $immediate = $result['mode'] === 'immediate';
            api_json_response(array(
                'success' => true,
                'message' => t_server('email.code_sent'),
                'mode' => $result['mode'],
                'email' => $immediate ? $result['email'] : null,
                'pending_email' => $immediate ? null : $result['email'],
            ));
        case 'same':
            api_error(400, 'email_same', t_server('email.change_same'));
        case 'taken':
            api_error(409, 'email_taken', t_server('email.change_taken'), array('field' => 'email'));
        case 'wait':
            email_verification_respond_wait($result['seconds']);
        default:
            api_not_found(t_server('common.user_not_found'));
    }
} catch (Exception $e) {
    error_log("Change email error: " . $e->getMessage());
    api_json_response(array('success' => false, 'message' => t_server('email.error')), 500);
}
