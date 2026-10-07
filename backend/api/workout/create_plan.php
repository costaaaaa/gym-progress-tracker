<?php
include_once '../../config/cors_headers.php';

include_once '../../config/database.php';
include_once '../../config/api_helpers.php';
include_once '../../models/WorkoutPlan.php';

$database = new Database();
$db = $database->getConnection();

$user_id = require_authenticated_user($db);

$workout_plan = new WorkoutPlan($db);

$data = json_decode(file_get_contents("php://input"));

if (!empty($data->name)) {
    $workout_plan->user_id = $user_id;
    $workout_plan->name = $data->name;
    $workout_plan->description = isset($data->description) ? $data->description : "";
    $workout_plan->is_active = isset($data->is_active) ? $data->is_active : 0;
    
    // Create the workout plan
    if ($workout_plan->create()) {
        http_response_code(201);

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
        http_response_code(503);

        echo json_encode(array("message" => "Impossibile creare la scheda di allenamento. Riprova più tardi."));
    }
} else {
    http_response_code(400);

    echo json_encode(array("message" => "Impossibile creare la scheda di allenamento. Dati incompleti."));
}