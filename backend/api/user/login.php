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

    // Make sure data is not empty and properties are defined
    if (
        !empty($data) && isset($data->username) && isset($data->password) &&
        !empty($data->username) && !empty($data->password)
    ) {

        // Set user property values
        $user->username = $data->username;
        $user->password = $data->password;

        // Attempt to login
        if ($user->login()) {
            // Create session
            if (session_status() === PHP_SESSION_NONE) {
                session_start();
            }
            $_SESSION['user_id'] = $user->id;
            $_SESSION['username'] = $user->username;

            // Return success response
            http_response_code(200);
            echo json_encode(array(
                "success" => true,
                "message" => "Login successful.",
                "user" => array(
                    "id" => $user->id,
                    "username" => $user->username
                )
            ));
        } else {
            // Set response code - 401 Unauthorized
            http_response_code(401);
            echo json_encode(array(
                "success" => false,
                "message" => "Invalid username or password."
            ));
        }
    } else {
        // Set response code - 400 Bad Request
        http_response_code(400);
        echo json_encode(array(
            "success" => false,
            "message" => "Username and password are required."
        ));
    }
} catch (Exception $e) {
    // Log the error
    error_log("Login Error: " . $e->getMessage());

    // Return error response
    http_response_code(500);
    echo json_encode(array(
        "success" => false,
        "message" => "An error occurred during login."
    ));
}
