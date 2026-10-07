<?php
include_once '../../config/cors_headers.php';

include_once '../../config/database.php';
include_once '../../config/api_helpers.php';
include_once '../../models/WorkoutDay.php';
include_once '../../models/WorkoutPlan.php';

$database = new Database();
$db = $database->getConnection();

$user_id = require_authenticated_user($db);

$data = json_decode(file_get_contents("php://input"));

if (!empty($data->plan_id) && !empty($data->days)) {
    if (!workout_plan_belongs_to_user($db, $data->plan_id, $user_id)) {
        api_not_found();
    }

    $workout_day = new WorkoutDay($db);
    $created_days = array();

    foreach ($data->days as $index => $day) {
        $workout_day->plan_id = $data->plan_id;
        $workout_day->name = $day->name;
        $workout_day->day_order = $index + 1;

        // Create the workout day
        if ($workout_day->create()) {
            $created_days[] = array(
                "id" => $workout_day->id,
                "name" => $workout_day->name,
                "day_order" => $workout_day->day_order
            );
        }
    }

    if (count($created_days) === count($data->days)) {
        http_response_code(201);

        echo json_encode(array(
            "message" => "Giorni di allenamento creati con successo.",
            "days" => $created_days
        ));
    } else {
        http_response_code(503);

        echo json_encode(array("message" => "Impossibile creare tutti i giorni di allenamento. Riprova più tardi."));
    }
} else {
    http_response_code(400);

    echo json_encode(array("message" => "Impossibile creare i giorni di allenamento. Dati incompleti."));
}
