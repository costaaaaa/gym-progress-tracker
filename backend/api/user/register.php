<?php
// Include common CORS headers
include_once '../../config/cors_headers.php';

// Include database and user model
include_once '../../config/database.php';
include_once '../../models/User.php';

try {
    // Get posted data
    $raw_data = file_get_contents("php://input");
    if (!$raw_data) {
        throw new Exception("No data provided");
    }

    $data = json_decode($raw_data);
    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new Exception("Invalid JSON format: " . json_last_error_msg());
    }

    // Get database connection
    $database = new Database();
    $db = $database->getConnection();

    // Instantiate user object
    $user = new User($db);

    // Make sure data is not empty and contains all required fields
    if (
        !empty($data) &&
        isset($data->username) && isset($data->email) && isset($data->password) &&
        !empty($data->username) && !empty($data->email) && !empty($data->password)
    ) {
        // Set user property values
        $user->username = $data->username;
        $user->email = $data->email;
        $user->password = $data->password;
        
        // Check if password is already hashed from client
        $user->is_hashed = isset($data->is_hashed) && $data->is_hashed === true;

        // Create the user
        if ($user->create()) {
            // Set response code - 201 created
            http_response_code(201);
            echo json_encode(array(
                "success" => true,
                "message" => "Utente registrato con successo."
            ));
        } else {
            // Set response code - 400 bad request
            http_response_code(400);
            echo json_encode(array(
                "success" => false,
                "message" => "Impossibile registrare l'utente. Il nome utente o l'email potrebbero essere già in uso."
            ));
        }
    } else {
        // Set response code - 400 bad request
        http_response_code(400);
        echo json_encode(array(
            "success" => false,
            "message" => "Dati incompleti. Username, email e password sono obbligatori."
        ));
    }
} catch (Exception $e) {
    // Log the error
    error_log("Registration Error: " . $e->getMessage());

    // Check if error message is already JSON encoded
    $error_message = $e->getMessage();
    $decoded_error = json_decode($error_message);

    // Return error response
    http_response_code(500);
    echo json_encode(array(
        "success" => false,
        "message" => "Si è verificato un errore durante la registrazione.",
        "error" => (json_last_error() === JSON_ERROR_NONE) ? $decoded_error : $error_message
    ));
}
