<?php
include_once '../../config/cors_headers.php';

include_once '../../config/database.php';
include_once '../../lib/login_attempt.php';

// Prima di tutto: una richiesta da un'origine estranea non conta come tentativo di accesso
reject_foreign_origin($http_origin, $allowed_origins);

try {
    $raw_data = file_get_contents("php://input");
    if (!$raw_data) {
        throw new Exception("No data provided");
    }

    $data = json_decode($raw_data);
    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new Exception("Invalid JSON format: " . json_last_error_msg());
    }

    $database = new Database();
    $db = $database->getConnection();

    $user = authenticate_login_request($db, $data);

    // La sessione nasce qui, con un id nuovo a ogni login (contro il session fixation); auth_at serve
    // a invalidare la sessione se la password cambia dopo l'accesso.
    // "remember" vale solo se è il booleano vero del JSON: il cookie dura 30 giorni,
    // altrimenti finisce con la chiusura del browser.
    web_session_login($user->id, $user->username, is_object($data) && ($data->remember ?? false) === true);

    http_response_code(200);
    echo json_encode(array(
        "success" => true,
        "message" => t_server('auth.login_ok'),
        "user" => array(
            "id" => $user->id,
            "username" => $user->username,
            "locale" => request_locale()
        )
    ));
} catch (Throwable $e) {
    api_log_exception('user/login.php', $e);
    if (ob_get_length()) ob_clean();
    api_server_error(t_server('auth.login_error'));
}
