<?php
include_once '../../config/cors_headers.php';

include_once '../../config/database.php';
include_once '../../models/WorkoutPlan.php';
include_once '../../config/api_helpers.php';

$database = new Database();
$db = $database->getConnection();

$user_id = require_authenticated_user($db);

$workout_plan = new WorkoutPlan($db);

$data = json_decode(file_get_contents("php://input"));

if (!empty($data->plan_id) && !empty($data->name)) {
    // Check if plan exists and belongs to user
    if (!workout_plan_belongs_to_user($db, $data->plan_id, $user_id)) {
        api_not_found("Scheda di allenamento non trovata.");
    }

    $workout_plan->id = $data->plan_id;
    $workout_plan->user_id = $user_id;
    $workout_plan->name = $data->name;
    $workout_plan->description = isset($data->description) ? $data->description : "";
    
    // Set is_active if provided, otherwise default to current status (handled by the model if we had a more flexible update, 
    // but here we expect the frontend to send it or we use 0 as fallback if missing entirely from request)
    $workout_plan->is_active = isset($data->is_active) ? $data->is_active : 0;
    
    // Update the workout plan
    if ($workout_plan->update()) {
        http_response_code(200);

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
        http_response_code(500);

        echo json_encode(array("message" => "Impossibile aggiornare la scheda di allenamento. Riprova più tardi."));
    }
} else {
    http_response_code(400);

    echo json_encode(array("message" => "Impossibile aggiornare la scheda di allenamento. Dati incompleti."));
}