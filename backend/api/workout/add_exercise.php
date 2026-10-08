<?php
include_once '../../config/cors_headers.php';

include_once '../../config/database.php';
include_once '../../config/api_helpers.php';
include_once '../../models/WorkoutExercise.php';
include_once '../../models/WorkoutDay.php';
include_once '../../models/WorkoutPlan.php';
include_once '../../models/Exercise.php';

$database = new Database();
$db = $database->getConnection();

$user_id = require_authenticated_user($db);

$data = json_decode(file_get_contents("php://input"));

if (
    !empty($data->day_id) &&
    !empty($data->exercise_id)
) {
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
            if (!Exercise::isVisibleTo($db, $data->exercise_id, $user_id)) {
                api_not_found('Esercizio non trovato.');
            }

            // Day belongs to user's plan, proceed with adding the exercise
            $workout_exercise = new WorkoutExercise($db);

            $workout_exercise->day_id = $data->day_id;
            $workout_exercise->exercise_id = $data->exercise_id;
            $workout_exercise->sets = $data->sets;
            $workout_exercise->reps = $data->reps;
            $workout_exercise->rest = $data->rest;
            $workout_exercise->notes = isset($data->notes) ? $data->notes : null; // Aggiungiamo il campo notes
            $workout_exercise->intensity_technique = isset($data->intensity_technique) ? $data->intensity_technique : null; // Aggiungiamo tecnica di intensità

            // Create the workout exercise
            if ($workout_exercise->create()) {
                // Get exercise details
                $exercise = new Exercise($db);
                $exercise->id = $data->exercise_id;
                $exercise->readOne();

                http_response_code(201);

                echo json_encode(array(
                    "message" => "Esercizio aggiunto con successo.",
                    "workout_exercise" => array(
                        "id" => $workout_exercise->id,
                        "day_id" => $workout_exercise->day_id,
                        "exercise_id" => $workout_exercise->exercise_id,
                        "exercise_name" => exercise_display_name($exercise->name, $exercise->name_en),
                        "muscle_group" => $exercise->muscle_group,
                        "sets" => $workout_exercise->sets,
                        "reps" => $workout_exercise->reps,
                        "rest" => $workout_exercise->rest,
                        "intensity_technique" => $workout_exercise->intensity_technique
                    )
                ));
            } else {
                http_response_code(503);

                echo json_encode(array("message" => "Impossibile aggiungere l'esercizio. Riprova più tardi."));
            }
        } else {
            api_not_found();
        }
    } else {
        api_not_found();
    }
} else {
    http_response_code(400);

    echo json_encode(array("message" => "Impossibile aggiungere l'esercizio. Dati incompleti."));
}
