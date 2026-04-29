<?php
// Include common CORS headers
include_once '../../config/cors_headers.php';

// Include database and workout model
include_once '../../config/database.php';
include_once '../../config/api_helpers.php';
include_once '../../models/WorkoutPlan.php';

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
if (!empty($data->plan_id)) {
    // Create workout plan object
    $workout_plan = new WorkoutPlan($db);

    // Set properties
    $workout_plan->id = $data->plan_id;
    $workout_plan->user_id = $_SESSION['user_id'];

    if (!$workout_plan->readOne()) {
        api_not_found();
    }

    // First, deactivate all plans for this user
    if ($workout_plan->deactivateAllPlans()) {
        // Then activate the selected plan
        if ($workout_plan->activate()) {
            // Set response code - 200 OK
            http_response_code(200);

            // Tell the user
            echo json_encode(array("message" => "Piano di allenamento attivato con successo."));
        } else {
            // Set response code - 503 service unavailable
            http_response_code(503);

            // Tell the user
            echo json_encode(array("message" => "Impossibile attivare il piano di allenamento."));
        }
    } else {
        // Set response code - 503 service unavailable
        http_response_code(503);

        // Tell the user
        echo json_encode(array("message" => "Errore durante la disattivazione dei piani esistenti."));
    }
} else {
    // Set response code - 400 bad request
    http_response_code(400);

    // Tell the user
    echo json_encode(array("message" => "Impossibile attivare il piano. Dati incompleti."));
}
