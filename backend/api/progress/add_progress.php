<?php
// Include common CORS headers
include_once '../../config/cors_headers.php';

// Include database and progress model
include_once '../../config/database.php';
include_once '../../models/Progress.php';
include_once '../../models/Exercise.php';

// Start session
session_start();

// Check if user is logged in
if(!isset($_SESSION['user_id'])) {
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
if (
    !empty($data->exercise_id) &&
    !empty($data->weight) &&
    !empty($data->date)
) {
    // Instantiate progress object
    $progress = new Progress($db);
    
    // Set progress property values
    $progress->user_id = $_SESSION['user_id'];
    $progress->exercise_id = $data->exercise_id;
    $progress->weight = $data->weight;
    $progress->date = $data->date;
    
    // Create the progress record
    if ($progress->create()) {
        // Get exercise details
        $exercise = new Exercise($db);
        $exercise->id = $data->exercise_id;
        $exercise->readOne();
        
        // Set response code - 201 created
        http_response_code(201);

        // Tell the user
        echo json_encode(array(
            "message" => "Progresso registrato con successo.",
            "progress" => array(
                "id" => $progress->id,
                "exercise_id" => $progress->exercise_id,
                "exercise_name" => $exercise->name,
                "muscle_group" => $exercise->muscle_group,
                "weight" => $progress->weight,
                "date" => $progress->date
            )
        ));
    } else {
        // Set response code - 503 service unavailable
        http_response_code(503);

        // Tell the user
        echo json_encode(array("message" => "Impossibile registrare il progresso. Riprova più tardi."));
    }
} else {
    // Set response code - 400 bad request
    http_response_code(400);

    // Tell the user
    echo json_encode(array("message" => "Impossibile registrare il progresso. Dati incompleti."));
}