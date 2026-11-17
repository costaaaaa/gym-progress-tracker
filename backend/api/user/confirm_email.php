<?php
// POST {code}: conferma l'email con il codice di 6 cifre arrivato per email (utente già entrato). Se c'è un
// cambio di indirizzo in attesa, il nuovo indirizzo diventa quello dell'account e al vecchio parte un avviso.
// Risposte: 200 {success, message, email_verified: true, email}; 400 email_code_format (non sono 6 cifre, non
// conta come tentativo); 400 email_code_wrong {attempts_left} (a 0 il codice non vale più); 400
// email_code_expired (scaduto, esaurito, annullato o mai chiesto: chiederne uno nuovo); 409 email_taken
// (l'indirizzo in attesa è stato preso nel frattempo: il cambio si annulla); 409 email_already_verified;
// 429 rate_limited (troppi codici sbagliati per IP). Se l'account aveva un codice di registrazione, la risposta
// aggiunge signup_code {status: applied|missed, tier (livello del codice), tier_last_day (AAAA-MM-GG in ora
// italiana, null se senza scadenza o se missed)} e il message lo dice. Raggiungibile anche dal giorno 8 (ALLOW_UNVERIFIED).
include_once '../../config/cors_headers.php';
include_once '../../config/database.php';
include_once '../../config/rate_limiter.php';
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

    $data = json_decode(file_get_contents("php://input"));
    $code = (is_object($data) && isset($data->code) && is_string($data->code)) ? trim($data->code) : '';
    if (!emailCodeIsWellFormed($code)) {
        api_error(400, 'email_code_format', t_server('email.code_missing'));
    }

    $limiter = rate_limiter($db);
    $ipKey = client_ip_key('emailcode');
    list($ipMax, $ipDecay) = rate_limit_rule('email_code_ip');
    if ($limiter->tooManyAttempts($ipKey, $ipMax)) {
        $retryAfter = $limiter->availableIn($ipKey);
        header('Retry-After: ' . $retryAfter);
        api_error(429, 'rate_limited', t_server('email.too_many_codes', array('seconds' => $retryAfter)), array('retry_after' => $retryAfter));
    }

    $result = (new EmailVerification($db))->confirm($user_id, $code);
    switch ($result['status']) {
        case 'confirmed':
            if ($result['changed']) {
                $lang = normalize_locale($result['locale']) ?? 'it';
                after_response(function () use ($result, $lang) {
                    email_verification_send_changed_notice($result['old_email'], $result['username'], $lang, $result['new_email']);
                });
            }
            $doneKey = $result['changed'] ? 'email.changed' : 'email.confirmed';
            $response = array(
                'success' => true,
                'message' => t_server($doneKey),
                'email_verified' => true,
                'email' => $result['new_email'],
            );
            if ($result['signup_code'] !== null) {
                $response['signup_code'] = $result['signup_code'];
                if ($result['signup_code']['status'] === 'applied') {
                    $response['message'] = t_server('email.confirmed_code_applied');
                } else {
                    $response['message'] = t_server('email.confirmed_code_missed');
                }
            }
            api_json_response($response);
        case 'wrong':
            $limiter->hit($ipKey, $ipDecay);
            $left = $result['attempts_left'];
            $message = $left > 0 ? t_server('email.code_wrong', array('left' => $left)) : t_server('email.code_wrong_last');
            api_error(400, 'email_code_wrong', $message, array('attempts_left' => $left));
        case 'expired':
            $limiter->hit($ipKey, $ipDecay);
            api_error(400, 'email_code_expired', t_server('email.code_expired'));
        case 'email_taken':
            api_error(409, 'email_taken', t_server('email.change_taken_late'), array('field' => 'email'));
        case 'already_verified':
            api_error(409, 'email_already_verified', t_server('email.already_confirmed'));
        default:
            api_not_found(t_server('common.user_not_found'));
    }
} catch (Exception $e) {
    error_log("Confirm email error: " . $e->getMessage());
    api_json_response(array('success' => false, 'message' => t_server('email.error')), 500);
}
