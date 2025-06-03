<?php
// Include common CORS headers
include_once '../../config/cors_headers.php';

// Include database and exercise model
include_once '../../config/database.php';
include_once '../../models/Exercise.php';

// Start session
session_start();

// Check if user is logged in
if (!isset($_SESSION['user_id'])) {
    // Set response code - 401 Unauthorized
    http_response_code(401);

    // Tell the user
    echo json_encode(array("message" => "Accesso non autorizzato. Effettua il login."));
    exit;
}

// Get database connection
$database = new Database();
$db = $database->getConnection();

// Get posted data
$data = json_decode(file_get_contents("php://input"));

// Make sure data is not empty
if (!empty($data->name) && !empty($data->muscle_group)) {
    // Create exercise object
    $exercise = new Exercise($db);

    // Set exercise property values
    $exercise->name = $data->name;
    $exercise->muscle_group = $data->muscle_group;

    // Create the exercise
    if ($exercise->create()) {
        // Set response code - 201 created
        http_response_code(201);

        // Tell the user
        echo json_encode(array(
            "message" => "Esercizio creato con successo.",
            "exercise" => array(
                "id" => $exercise->id,
                "name" => $exercise->name,
                "muscle_group" => $exercise->muscle_group
            )
        ));
    } else {
        // Set response code - 503 service unavailable
        http_response_code(503);

        // Tell the user
        echo json_encode(array("message" => "Impossibile creare l'esercizio. Riprova più tardi."));
    }
} else {
    // Set response code - 400 bad request
    http_response_code(400);

    // Tell the user
    echo json_encode(array("message" => "Impossibile creare l'esercizio. Dati incompleti."));
}
