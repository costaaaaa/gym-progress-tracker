<?php
// Includi i file di configurazione e le classi necessarie
include_once '../../config/cors_headers.php';
include_once '../../config/database.php';
include_once '../../config/api_helpers.php';
include_once '../../models/WorkoutExercise.php';

$database = new Database();
$db = $database->getConnection();

$user_id = require_authenticated_user($db);

// Inizializza il modello WorkoutExercise
$workoutExercise = new WorkoutExercise($db);

// Ottieni i dati inviati
$data = json_decode(file_get_contents("php://input"));

// Verifica che tutti i dati necessari siano presenti
if (
    !empty($data->day_id) &&
    !empty($data->exercise_id)
    // notes è opzionale, quindi non lo verifichiamo qui
) {
    $params_error = exercise_params_error($data);
    if ($params_error !== null) {
        api_json_response(array('success' => false, 'message' => $params_error), 400);
    }

    if (!workout_exercise_belongs_to_user($db, $data->exercise_id, $data->day_id, $user_id)) {
        api_not_found(t_server('workout.exercise_not_found'));
    }

    // Il controllo di proprietà ha già verificato che la riga esista: exercise_id è l'id della riga
    // in gym_workout_exercises (non l'id dell'esercizio del catalogo)
    $workoutExercise->id = (int) $data->exercise_id;
    $workoutExercise->day_id = (int) $data->day_id;
    $workoutExercise->sets = $data->sets;
    $workoutExercise->warmup_sets = $data->warmup_sets ?? 0;
    $workoutExercise->reps = $data->reps;
    $workoutExercise->rest = $data->rest;
    $workoutExercise->notes = isset($data->notes) && $data->notes !== "" ? $data->notes : null;
    $workoutExercise->intensity_technique = isset($data->intensity_technique) && $data->intensity_technique !== "" ? $data->intensity_technique : null;

    if ($workoutExercise->update()) {
        echo json_encode(
            array(
                'success' => true,
                'message' => t_server('workout.exercise_updated')
            )
        );
    } else {
        http_response_code(503);
        echo json_encode(
            array(
                'success' => false,
                'message' => t_server('workout.exercise_update_failed')
            )
        );
    }
} else {
    // Se i dati sono incompleti
    http_response_code(400);
    echo json_encode(
        array(
            'success' => false,
            'message' => t_server('workout.exercise_update_incomplete')
        )
    );
}
