<?php
// Includi i file di configurazione e le classi necessarie
include_once '../../config/database.php';
include_once '../../models/WorkoutExercise.php';

// Headers
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Access-Control-Allow-Headers, Content-Type, Access-Control-Allow-Methods, Authorization, X-Requested-With');

// Inizializza il database
$database = new Database();
$db = $database->getConnection();

// Inizializza il modello WorkoutExercise
$workoutExercise = new WorkoutExercise($db);

// Ottieni i dati inviati
$data = json_decode(file_get_contents("php://input"));

// Verifica che tutti i dati necessari siano presenti
if (
    !empty($data->day_id) &&
    !empty($data->exercise_id) &&
    isset($data->sets) &&
    !empty($data->reps) &&
    isset($data->rest)
    // notes è opzionale, quindi non lo verifichiamo qui
) {
    // Prima di aggiornare, dobbiamo trovare l'ID dell'esercizio nella scheda
    // Il frontend invia direttamente l'ID dell'esercizio nella tabella gym_workout_exercises
    $query = "SELECT id FROM gym_workout_exercises WHERE id = ? LIMIT 0,1";
    $stmt = $db->prepare($query);
    $stmt->bindParam(1, $data->exercise_id);
    $stmt->execute();

    // Debug: Registriamo i parametri della query e il risultato
    error_log("Parametri query update_exercise: exercise_id={$data->exercise_id}");
    error_log("Numero di righe trovate: " . $stmt->rowCount());
    error_log("Parametri query update_exercise: day_id={$data->day_id}, exercise_id={$data->exercise_id}");

    if ($stmt->rowCount() > 0) {
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        $workout_exercise_id = $row['id'];

        // Assegna i valori alle proprietà del modello
        $workoutExercise->id = $workout_exercise_id; // Imposta l'ID trovato
        $workoutExercise->day_id = $data->day_id;
        $workoutExercise->exercise_id = $data->exercise_id;
        $workoutExercise->sets = $data->sets;
        $workoutExercise->reps = $data->reps;
        $workoutExercise->rest = $data->rest;
        $workoutExercise->notes = isset($data->notes) && $data->notes !== "" ? $data->notes : null; // Gestiamo correttamente il campo notes

        // Log per debug
        error_log("Notes value: " . (isset($data->notes) ? $data->notes : 'null') . ", Final value: " . $workoutExercise->notes);

        // Esegui l'aggiornamento
        if ($workoutExercise->update()) {
            // Crea la risposta
            echo json_encode(
                array(
                    'success' => true,
                    'message' => 'Esercizio aggiornato con successo.'
                )
            );
        } else {
            // Se l'aggiornamento fallisce
            http_response_code(503);
            echo json_encode(
                array(
                    'success' => false,
                    'message' => 'Impossibile aggiornare l\'esercizio.'
                )
            );
        }
    } else {
        // Se non troviamo l'esercizio nella scheda
        http_response_code(404);
        echo json_encode(
            array(
                'success' => false,
                'message' => 'Esercizio non trovato nella scheda.'
            )
        );
    }
} else {
    // Se i dati sono incompleti
    http_response_code(400);
    echo json_encode(
        array(
            'success' => false,
            'message' => 'Dati incompleti. Impossibile aggiornare l\'esercizio.'
        )
    );
}
