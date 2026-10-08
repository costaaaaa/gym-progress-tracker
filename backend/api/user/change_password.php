<?php
include_once '../../config/cors_headers.php';

include_once '../../config/database.php';
include_once '../../config/api_helpers.php';
include_once '../../lib/password_policy.php';
include_once '../../models/ApiToken.php';
include_once '../../models/User.php';

$database = new Database();
$db = $database->getConnection();

$user_id = require_authenticated_user($db);

try {
    $raw_data = file_get_contents("php://input");
    if (!$raw_data) {
        throw new Exception("Nessun dato fornito");
    }

    $data = json_decode($raw_data);
    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new Exception("Formato JSON non valido: " . json_last_error_msg());
    }

    $user = new User($db);
    $user->id = $user_id;

    if (empty($data->current_password) || empty($data->new_password)) {
        http_response_code(400);
        echo json_encode(array(
            "success" => false,
            "message" => t_server('change_password.missing')
        ));
        exit;
    }
    
    // Verifica che la nuova password sia diversa dalla password attuale
    if ($data->current_password === $data->new_password) {
        http_response_code(400);
        echo json_encode(array(
            "success" => false,
            "message" => t_server('change_password.same')
        ));
        exit;
    }

    $policyError = password_policy_error($data->new_password);
    if ($policyError !== null) {
        http_response_code(400);
        echo json_encode(array("success" => false, "message" => $policyError));
        exit;
    }

    // Try to change password
    if ($user->changePassword($data->current_password, $data->new_password)) {
        // Le altre sessioni e gli altri dispositivi devono rifare il login: la sessione web
        // in uso riparte con un nuovo id, il token mobile in uso resta valido, gli altri no.
        if (isset($_SESSION['user_id'])) {
            session_regenerate_id(true);
            $_SESSION['auth_at'] = time();
        }
        (new ApiToken($db))->revokeAllForUserExcept($user_id, bearer_token_from_request());
        http_response_code(200);
        echo json_encode(array(
            "success" => true,
            "message" => t_server('change_password.ok')
        ));
    } else {
        http_response_code(400);
        echo json_encode(array(
            "success" => false,
            "message" => t_server('change_password.wrong_current')
        ));
    }
} catch (Exception $e) {
    error_log("Change Password Error: " . $e->getMessage());

    http_response_code(500);
    echo json_encode(array(
        "success" => false,
        "message" => t_server('change_password.error')
    ));
}
