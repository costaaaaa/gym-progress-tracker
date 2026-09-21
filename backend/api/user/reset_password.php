<?php
// POST {token, new_password}: imposta la nuova password con il token ricevuto per email.
// Il token è monouso; a reset riuscito i token mobile attivi vengono revocati.
include_once '../../config/cors_headers.php';
include_once '../../config/database.php';
include_once '../../config/rate_limiter.php';
include_once '../../models/ApiToken.php';
include_once '../../models/PasswordReset.php';

try {
    $data = json_decode(file_get_contents("php://input"));
    $token = (is_object($data) && isset($data->token) && is_string($data->token)) ? $data->token : '';
    $newPassword = (is_object($data) && isset($data->new_password) && is_string($data->new_password)) ? $data->new_password : '';

    if ($token === '' || $newPassword === '') {
        http_response_code(400);
        echo json_encode(array("success" => false, "message" => "Token e nuova password sono obbligatori."));
        exit;
    }
    if (strlen($newPassword) < 8) {
        http_response_code(400);
        echo json_encode(array("success" => false, "message" => "La password deve avere almeno 8 caratteri."));
        exit;
    }

    $database = new Database();
    $db = $database->getConnection();
    $limiter = rate_limiter($db);

    $ip = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : 'unknown';
    $ipKey = 'reset:ip:' . $ip;
    list($ipMax, $ipDecay) = rate_limit_rule('reset_ip');
    if ($limiter->tooManyAttempts($ipKey, $ipMax)) {
        header('Retry-After: ' . $limiter->availableIn($ipKey));
        http_response_code(429);
        echo json_encode(array("success" => false, "message" => "Troppi tentativi. Riprova più tardi."));
        exit;
    }

    $reset = new PasswordReset($db);
    if ($reset->consumeAndSetPassword($token, $newPassword)) {
        http_response_code(200);
        echo json_encode(array("success" => true, "message" => "Password reimpostata. Ora puoi accedere."));
    } else {
        $limiter->hit($ipKey, $ipDecay);
        http_response_code(400);
        echo json_encode(array("success" => false, "message" => "Il link non è valido o è scaduto. Richiedine uno nuovo."));
    }
} catch (Exception $e) {
    error_log("Reset password error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(array("success" => false, "message" => "Si è verificato un errore. Riprova."));
}
