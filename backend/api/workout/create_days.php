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

if (!empty($data->plan_id) && !empty($data->days) && is_array($data->days)) {
    if (!workout_plan_belongs_to_user($db, $data->plan_id, $user_id)) {
        api_not_found();
    }

    require_plan_writable($db, $user_id, $data->plan_id);

    $workout_day = new WorkoutDay($db);

    // Tutta la richiesta o niente: giorni già presenti + nuovi non superano il tetto del livello
    enforce_tier_limit($db, $user_id, 'days_per_plan', $workout_day->countByPlan($data->plan_id), 'too_many_days', 'workout.too_many_days', count($data->days));

    $created_days = array();

    // Tutti i giorni o nessuno: un errore a metà annulla anche quelli già inseriti
    $db->beginTransaction();
    try {
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

        $db->commit();
    } catch (PDOException $e) {
        $db->rollBack();
        api_log_exception('create_days', $e);
        $created_days = array();
    }

    if (count($created_days) === count($data->days)) {
        http_response_code(201);

        echo json_encode(array(
            "message" => t_server('workout.days_created'),
            "days" => $created_days
        ));
    } else {
        http_response_code(503);

        echo json_encode(array("message" => t_server('workout.days_create_failed')));
    }
} else {
    http_response_code(400);

    echo json_encode(array("message" => t_server('workout.days_create_incomplete')));
}
