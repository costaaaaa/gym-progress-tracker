<?php
include_once '../../config/cors_headers.php';

include_once '../../config/database.php';
include_once '../../config/api_helpers.php';
include_once '../../models/WorkoutExercise.php';
include_once '../../models/WorkoutDay.php';
include_once '../../models/WorkoutPlan.php';
include_once '../../models/Exercise.php';
require_once '../../lib/id_rules.php';

$database = new Database();
$db = $database->getConnection();

$user_id = require_authenticated_user($db);

$data = json_decode(file_get_contents("php://input"));

if (
    !empty($data->day_id) &&
    !empty($data->exercise_id)
) {
    $exercise_id = parse_positive_id($data->exercise_id);
    if ($exercise_id === null) {
        api_json_response(array("message" => t_server('workout.record_invalid')), 400);
    }
    $params_error = exercise_params_error($data);
    if ($params_error !== null) {
        api_json_response(array("message" => $params_error), 400);
    }

    // First, verify that the workout day belongs to the current user
    $workout_day = new WorkoutDay($db);
    $workout_day->id = $data->day_id;

    if ($workout_day->readOne()) {
        $workout_plan = new WorkoutPlan($db);
        $workout_plan->id = $workout_day->plan_id;
        $workout_plan->user_id = $user_id;

        if ($workout_plan->readOne()) {
            // Solo esercizi approvati o creati dall'utente: quelli in attesa degli altri non si usano
            if (!Exercise::isVisibleTo($db, $exercise_id, $user_id)) {
                api_not_found(t_server('workout.exercise_not_found'));
            }

            // Day belongs to user's plan, proceed with adding the exercise
            $workout_exercise = new WorkoutExercise($db);

            if ($workout_exercise->countByDay($data->day_id) >= WorkoutExercise::MAX_PER_DAY) {
                api_error(409, 'too_many_plan_exercises', t_server('workout.too_many_plan_exercises', array('max' => WorkoutExercise::MAX_PER_DAY)));
            }

            $workout_exercise->day_id = $data->day_id;
            $workout_exercise->exercise_id = $exercise_id;
            $workout_exercise->rest = $data->rest;
            $workout_exercise->notes = isset($data->notes) ? $data->notes : null; // Aggiungiamo il campo notes
            $workout_exercise->planned_sets = planned_sets_normalize($data->planned_sets);

            // Create the workout exercise
            if ($workout_exercise->create()) {
                $workout_exercise->readOne();

                http_response_code(201);

                echo json_encode(array(
                    "message" => t_server('workout.exercise_added'),
                    "workout_exercise" => $workout_exercise->response()
                ));
            } else {
                http_response_code(503);

                echo json_encode(array("message" => t_server('workout.exercise_add_failed')));
            }
        } else {
            api_not_found();
        }
    } else {
        api_not_found();
    }
} else {
    http_response_code(400);

    echo json_encode(array("message" => t_server('workout.exercise_add_incomplete')));
}
