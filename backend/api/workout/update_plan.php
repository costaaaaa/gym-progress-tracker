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
        api_not_found(t_server('workout.plan_not_found'));
    }

    $workout_plan->id = $data->plan_id;
    $workout_plan->user_id = $user_id;
    $workout_plan->name = $data->name;
    $workout_plan->description = isset($data->description) ? $data->description : "";

    // is_active del client è ignorato: modificare una scheda non cambia quale scheda è attiva
    if ($workout_plan->update()) {
        // Letta dal database: la risposta riporta il valore reale di is_active
        // (rowCount() non serve: vale 0 anche se i valori non cambiano)
        if (!$workout_plan->readOne()) {
            api_not_found(t_server('workout.plan_not_found'));
        }

        http_response_code(200);

        echo json_encode(array(
            "message" => t_server('workout.plan_updated'),
            "plan" => array(
                "id" => $workout_plan->id,
                "name" => $workout_plan->name,
                "description" => $workout_plan->description,
                "is_active" => (int)$workout_plan->is_active
            )
        ));
    } else {
        http_response_code(500);

        echo json_encode(array("message" => t_server('workout.plan_update_failed')));
    }
} else {
    http_response_code(400);

    echo json_encode(array("message" => t_server('workout.plan_update_incomplete')));
}