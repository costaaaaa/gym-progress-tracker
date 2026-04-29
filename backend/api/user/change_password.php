<?php
// Include common CORS headers
include_once '../../config/cors_headers.php';

// Include database and user model
include_once '../../config/database.php';
include_once '../../models/User.php';

// Start session to check if user is logged in
session_start();

// Check if user is logged in
if (!isset($_SESSION['user_id']) || !isset($_SESSION['username'])) {
    // Set response code - 401 Unauthorized
    http_response_code(401);
    
    // Tell the user
    echo json_encode(array(
        "success" => false,
        "message" => "Sessione non valida. Effettua nuovamente il login."
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
    if (empty($data->current_password) || empty($data->new_password)) {
        // Set response code - 400 Bad Request
        http_response_code(400);
        echo json_encode(array(
            "success" => false,
            "message" => "Password attuale e nuova password sono obbligatorie."
        ));
        exit;
    }
    
    // Verifica che la nuova password sia diversa dalla password attuale
    if ($data->current_password === $data->new_password) {
        // Set response code - 400 Bad Request
        http_response_code(400);
        echo json_encode(array(
            "success" => false,
            "message" => "La nuova password deve essere diversa da quella attuale."
        ));
        exit;
    }

    // Set property for hashed passwords
    $user->is_hashed = isset($data->is_hashed) && $data->is_hashed === true;
    
    // Try to change password
    if ($user->changePassword($data->current_password, $data->new_password)) {
        // Set response code - 200 OK
        http_response_code(200);
        echo json_encode(array(
            "success" => true,
            "message" => "Password modificata con successo."
        ));
    } else {
        // Set response code - 400 Bad Request
        http_response_code(400);
        echo json_encode(array(
            "success" => false,
            "message" => "La password attuale non è corretta."
        ));
    }
} catch (Exception $e) {
    // Log the error
    error_log("Change Password Error: " . $e->getMessage());

    // Return error response
    http_response_code(500);
    echo json_encode(array(
        "success" => false,
        "message" => "Si è verificato un errore durante il cambio password."
    ));
}
