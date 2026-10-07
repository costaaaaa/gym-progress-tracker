<?php
// Login per client mobile (React Native): stessa validazione credenziali e stesso rate
// limiting di login.php, ma risponde con un token Bearer invece di creare una sessione.
include_once '../../config/cors_headers.php';

include_once '../../config/database.php';
include_once '../../lib/login_attempt.php';
include_once '../../models/ApiToken.php';

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

    // Crea il token Bearer al posto della sessione
    $device_info = isset($data->device_info) ? substr((string)$data->device_info, 0, 255) : null;
    $api_token = new ApiToken($db);
    $token_result = $api_token->create($user->id, $device_info);

    if (!$token_result) {
        throw new Exception("Impossibile generare il token di accesso.");
    }

    http_response_code(200);
    echo json_encode(array(
        "success" => true,
        "message" => "Login successful.",
        "token" => $token_result['token'],
        "expires_at" => $token_result['expires_at'],
        "user" => array(
            "id" => $user->id,
            "username" => $user->username
        )
    ));
} catch (Exception $e) {
    error_log("Mobile Login Error: " . $e->getMessage());

    http_response_code(500);
    echo json_encode(array(
        "success" => false,
        "message" => "An error occurred during login."
    ));
}
