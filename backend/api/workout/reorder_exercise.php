<?php
// Includi i file di configurazione e le classi necessarie
include_once '../../config/cors_headers.php';
include_once '../../config/database.php';
include_once '../../config/api_helpers.php';
include_once '../../models/WorkoutExercise.php';

$database = new Database();
$db = $database->getConnection();

$user_id = require_authenticated_user($db);

// Registra gli errori server-side senza esporli nelle response pubbliche.
ini_set('display_errors', 0);
ini_set('log_errors', 1);
error_log("Inizio elaborazione riordinamento esercizi");

// Inizializza il modello WorkoutExercise
$workoutExercise = new WorkoutExercise($db);

// Ottieni i dati inviati
$data = json_decode(file_get_contents("php://input"));

try {
    // Verifica che tutti i dati necessari siano presenti
    if (
        !empty($data->day_id) &&
        !empty($data->exercise_id) &&
        !empty($data->direction)
    ) {

        // Assegna i valori alle proprietà del modello
        $workoutExercise->day_id = $data->day_id;
        $workoutExercise->id = $data->exercise_id;
        $direction = $data->direction;

        if (!workout_exercise_belongs_to_user($db, $data->exercise_id, $data->day_id, $user_id)) {
            api_not_found(t_server('workout.exercise_not_found'));
        }

        // Verifica che l'esercizio esista
        if (!$workoutExercise->readOne()) {
            error_log("Errore: esercizio non trovato con ID {$workoutExercise->id}");
            http_response_code(404);
            echo json_encode(
                array(
                    'success' => false,
                    'message' => t_server('workout.exercise_not_found')
                )
            );
            exit;
        }

        // Esegui il riordinamento in base alla direzione
        $success = false;

        if ($direction === 'up') {
            error_log("Tentativo di spostare l'esercizio {$workoutExercise->id} verso l'alto");
            $success = $workoutExercise->moveUp();
        } else if ($direction === 'down') {
            error_log("Tentativo di spostare l'esercizio {$workoutExercise->id} verso il basso");
            $success = $workoutExercise->moveDown();
        } else {
            error_log("Direzione non valida: {$direction}");
            http_response_code(400);
            echo json_encode(
                array(
                    'success' => false,
                    'message' => t_server('workout.reorder_direction_invalid')
                )
            );
            exit;
        }

        if ($success) {
            error_log("Riordinamento completato con successo");
            // Crea la risposta
            echo json_encode(
                array(
                    'success' => true,
                    'message' => t_server('workout.reorder_ok')
                )
            );
        } else {
            error_log("Fallimento nel riordinamento degli esercizi");
            // Se il riordinamento fallisce
            http_response_code(503);
            echo json_encode(
                array(
                    'success' => false,
                    'message' => t_server('workout.reorder_failed')
                )
            );
        }
    } else {
        error_log("Dati incompleti nella richiesta di riordinamento");
        // Se i dati sono incompleti
        http_response_code(400);
        echo json_encode(
            array(
                'success' => false,
                'message' => t_server('workout.reorder_incomplete')
            )
        );
    }
} catch (Exception $e) {
    error_log("Eccezione durante il riordinamento: " . $e->getMessage());
    api_server_error();
}
