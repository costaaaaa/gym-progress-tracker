<?php
// Required headers
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

// Include database and object files
include_once '../../database.php';
include_once '../../models/User.php';

// Start or resume session
session_start();

// Check if user is logged in
if (!isset($_SESSION['user_id'])) {
    // Set response code - 401 Unauthorized
    http_response_code(401);
    echo json_encode(array(
        "success" => false,
        "message" => "Sessione non valida. Effettua il login."
    ));
    exit;
}

try {
    // Get posted data
    $raw_data = file_get_contents("php://input");
    if (!$raw_data) {
        throw new Exception("Nessun dato fornito");
    }

    $data = json_decode($raw_data);
    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new Exception("Formato JSON non valido: " . json_last_error_msg());
    }

    // Get database connection
    $database = new Database();
    $db = $database->getConnection();

    // Instantiate user object
    $user = new User($db);

    // Set user ID from session
    $user->id = $_SESSION['user_id'];

    // Make sure data is not empty
    if (empty($data->password)) {
        // Set response code - 400 Bad Request
        http_response_code(400);
        echo json_encode(array(
            "success" => false,
            "message" => "La password è obbligatoria."
        ));
        exit;
    }

    // Set property for hashed passwords
    $user->is_hashed = isset($data->is_hashed) && $data->is_hashed === true;

    // Try to delete account
    if ($user->deleteAccount($data->password)) {
        // Clear session data
        session_unset();
        session_destroy();

        // Set response code - 200 OK
        http_response_code(200);
        echo json_encode(array(
            "success" => true,
            "message" => "Account eliminato con successo."
        ));
    } else {
        // Set response code - 401 Unauthorized
        http_response_code(401);
        echo json_encode(array(
            "success" => false,
            "message" => "Password non corretta. Impossibile eliminare l'account."
        ));
    }
} catch (Exception $e) {
    // Set response code - 500 Internal Server Error
    http_response_code(500);
    echo json_encode(array(
        "success" => false,
        "message" => $e->getMessage()
    ));
}
