<?php
// Include common CORS headers
include_once '../../config/cors_headers.php';

// Include database and workout model
include_once '../../config/database.php';
include_once '../../config/api_helpers.php';
include_once '../../models/WorkoutExercise.php';
include_once '../../models/WorkoutDay.php';
include_once '../../models/WorkoutPlan.php';
include_once '../../models/Exercise.php';

// Start session
session_start();

// Check if user is logged in
if (!isset($_SESSION['user_id'])) {
    // Set response code - 401 Unauthorized
    http_response_code(401);

    // Tell the user
    echo json_encode(array("message" => "Accesso non autorizzato. Effettua il login."));
    exit;
}

// Get database connection
$database = new Database();
$db = $database->getConnection();

// Get posted data
$data = json_decode(file_get_contents("php://input"));

// Make sure data is not empty
if (
    !empty($data->day_id) &&
    !empty($data->exercise_id) &&
    !empty($data->sets) &&
    !empty($data->reps) &&
    !empty($data->rest)
) {
    // First, verify that the workout day belongs to the current user
    $workout_day = new WorkoutDay($db);
    $workout_day->id = $data->day_id;

    if ($workout_day->readOne()) {
        $workout_plan = new WorkoutPlan($db);
        $workout_plan->id = $workout_day->plan_id;
        $workout_plan->user_id = $_SESSION['user_id'];

        if ($workout_plan->readOne()) {
            // Day belongs to user's plan, proceed with adding the exercise
            $workout_exercise = new WorkoutExercise($db);

            // Set workout exercise property values
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

                // Set response code - 201 created
                http_response_code(201);

                // Tell the user
                echo json_encode(array(
                    "message" => "Esercizio aggiunto con successo.",
                    "workout_exercise" => array(
                        "id" => $workout_exercise->id,
                        "day_id" => $workout_exercise->day_id,
                        "exercise_id" => $workout_exercise->exercise_id,
                        "exercise_name" => $exercise->name,
                        "muscle_group" => $exercise->muscle_group,
                        "sets" => $workout_exercise->sets,
                        "reps" => $workout_exercise->reps,
                        "rest" => $workout_exercise->rest,
                        "intensity_technique" => $workout_exercise->intensity_technique
                    )
                ));
            } else {
                // Set response code - 503 service unavailable
                http_response_code(503);

                // Tell the user
                echo json_encode(array("message" => "Impossibile aggiungere l'esercizio. Riprova più tardi."));
            }
        } else {
            api_not_found();
        }
    } else {
        api_not_found();
    }
} else {
    // Set response code - 400 bad request
    http_response_code(400);

    // Tell the user
    echo json_encode(array("message" => "Impossibile aggiungere l'esercizio. Dati incompleti."));
}
