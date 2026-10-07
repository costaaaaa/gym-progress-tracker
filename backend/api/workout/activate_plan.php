<?php
include_once '../../config/cors_headers.php';

include_once '../../config/database.php';
include_once '../../config/api_helpers.php';
include_once '../../models/WorkoutPlan.php';

$database = new Database();
$db = $database->getConnection();

$user_id = require_authenticated_user($db);

$data = json_decode(file_get_contents("php://input"));

if (!empty($data->plan_id)) {
    $workout_plan = new WorkoutPlan($db);

    $workout_plan->id = $data->plan_id;
    $workout_plan->user_id = $user_id;

    if (!$workout_plan->readOne()) {
        api_not_found();
    }

    // First, deactivate all plans for this user
    if ($workout_plan->deactivateAllPlans()) {
        // Then activate the selected plan
        if ($workout_plan->activate()) {
            http_response_code(200);

            echo json_encode(array("message" => "Piano di allenamento attivato con successo."));
        } else {
            http_response_code(503);

            echo json_encode(array("message" => "Impossibile attivare il piano di allenamento."));
        }
    } else {
        http_response_code(503);

        echo json_encode(array("message" => "Errore durante la disattivazione dei piani esistenti."));
    }
} else {
    http_response_code(400);

    echo json_encode(array("message" => "Impossibile attivare il piano. Dati incompleti."));
}
