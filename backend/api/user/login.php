<?php
include_once '../../config/cors_headers.php';

include_once '../../config/database.php';
include_once '../../lib/login_attempt.php';

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

    // Create session
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    // Nuovo id di sessione a ogni login (contro il session fixation); auth_at serve a
    // invalidare la sessione se la password cambia dopo l'accesso
    session_regenerate_id(true);
    $_SESSION['user_id'] = $user->id;
    $_SESSION['username'] = $user->username;
    $_SESSION['auth_at'] = time();

    http_response_code(200);
    echo json_encode(array(
        "success" => true,
        "message" => "Login successful.",
        "user" => array(
            "id" => $user->id,
            "username" => $user->username
        )
    ));
} catch (Exception $e) {
    error_log("Login Error: " . $e->getMessage());

    http_response_code(500);
    echo json_encode(array(
        "success" => false,
        "message" => "An error occurred during login."
    ));
}
