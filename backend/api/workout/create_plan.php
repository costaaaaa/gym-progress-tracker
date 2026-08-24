<?php
// Include common CORS headers
include_once '../../config/cors_headers.php';

// Include database and workout model
include_once '../../config/database.php';
include_once '../../config/api_helpers.php';
include_once '../../models/WorkoutPlan.php';

// Connessione creata prima del check di autenticazione: resolve_authenticated_user_id()
// ne ha bisogno per validare sia la sessione web sia il token Bearer mobile.
$database = new Database();
$db = $database->getConnection();

$user_id = resolve_authenticated_user_id($db);
if (!$user_id) {
    // Set response code - 401 Unauthorized
    http_response_code(401);

    // Tell the user
    echo json_encode(array("message" => "Accesso non autorizzato. Effettua il login."));
    exit;
}

// Instantiate workout plan object
$workout_plan = new WorkoutPlan($db);

// Get posted data
$data = json_decode(file_get_contents("php://input"));

// Make sure data is not empty
if (!empty($data->name)) {
    // Set workout plan property values
    $workout_plan->user_id = $user_id;
    $workout_plan->name = $data->name;
    $workout_plan->description = isset($data->description) ? $data->description : "";
    $workout_plan->is_active = isset($data->is_active) ? $data->is_active : 0;
    
    // Create the workout plan
    if ($workout_plan->create()) {
        // Set response code - 201 created
        http_response_code(201);

        // Tell the user
        echo json_encode(array(
            "message" => "Scheda di allenamento creata con successo.",
            "plan" => array(
                "id" => $workout_plan->id,
                "name" => $workout_plan->name,
                "description" => $workout_plan->description,
                "is_active" => $workout_plan->is_active
            )
        ));
    } else {
        // Set response code - 503 service unavailable
        http_response_code(503);

        // Tell the user
        echo json_encode(array("message" => "Impossibile creare la scheda di allenamento. Riprova più tardi."));
    }
} else {
    // Set response code - 400 bad request
    http_response_code(400);

    // Tell the user
    echo json_encode(array("message" => "Impossibile creare la scheda di allenamento. Dati incompleti."));
}