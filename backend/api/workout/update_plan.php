<?php
// Include common CORS headers
include_once '../../config/cors_headers.php';

// Include database and workout model
include_once '../../config/database.php';
include_once '../../models/WorkoutPlan.php';
include_once '../../config/api_helpers.php';

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
if (!empty($data->plan_id) && !empty($data->name)) {
    // Check if plan exists and belongs to user
    if (!workout_plan_belongs_to_user($db, $data->plan_id, $user_id)) {
        api_not_found("Scheda di allenamento non trovata.");
    }

    // Set workout plan property values
    $workout_plan->id = $data->plan_id;
    $workout_plan->user_id = $user_id;
    $workout_plan->name = $data->name;
    $workout_plan->description = isset($data->description) ? $data->description : "";
    
    // Set is_active if provided, otherwise default to current status (handled by the model if we had a more flexible update, 
    // but here we expect the frontend to send it or we use 0 as fallback if missing entirely from request)
    $workout_plan->is_active = isset($data->is_active) ? $data->is_active : 0;
    
    // Update the workout plan
    if ($workout_plan->update()) {
        // Set response code - 200 OK
        http_response_code(200);

        // Tell the user
        echo json_encode(array(
            "message" => "Scheda di allenamento aggiornata con successo.",
            "plan" => array(
                "id" => $workout_plan->id,
                "name" => $workout_plan->name,
                "description" => $workout_plan->description,
                "is_active" => $workout_plan->is_active
            )
        ));
    } else {
        // Set response code - 500 internal server error
        http_response_code(500);

        // Tell the user
        echo json_encode(array("message" => "Impossibile aggiornare la scheda di allenamento. Riprova più tardi."));
    }
} else {
    // Set response code - 400 bad request
    http_response_code(400);

    // Tell the user
    echo json_encode(array("message" => "Impossibile aggiornare la scheda di allenamento. Dati incompleti."));
}