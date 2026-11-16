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
    enforce_tier_limit($db, $user_id, 'plans', $workout_plan->countByUser($user_id), 'too_many_plans', 'workout.too_many_plans');

    $workout_plan->user_id = $user_id;
    $workout_plan->name = $data->name;
    $workout_plan->description = isset($data->description) ? $data->description : "";
    // Se il client non chiede is_active, la scheda nasce attiva solo se l'utente non ne ha una attiva
    $requested_active = isset($data->is_active) ? filter_var($data->is_active, FILTER_VALIDATE_BOOLEAN) : null;

    // Create the workout plan
    if ($workout_plan->createAtMostOneActive($requested_active)) {
        http_response_code(201);

        echo json_encode(array(
            "message" => t_server('workout.plan_created'),
            "plan" => array(
                "id" => $workout_plan->id,
                "name" => $workout_plan->name,
                "description" => $workout_plan->description,
                "is_active" => $workout_plan->is_active
            )
        ));
    } else {
        http_response_code(503);

        echo json_encode(array("message" => t_server('workout.plan_create_failed')));
    }
} else {
    http_response_code(400);

    echo json_encode(array("message" => t_server('workout.plan_create_incomplete')));
}