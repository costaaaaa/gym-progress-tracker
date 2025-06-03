<?php
// Includi i file di configurazione e le classi necessarie
include_once '../../config/database.php';
include_once '../../models/WorkoutExercise.php';

// Headers
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Access-Control-Allow-Headers, Content-Type, Access-Control-Allow-Methods, Authorization, X-Requested-With');

// Attiva la registrazione degli errori PHP
ini_set('display_errors', 1);
ini_set('log_errors', 1);
error_log("Inizio elaborazione riordinamento esercizi");

// Inizializza il database
$database = new Database();
$db = $database->getConnection();

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
        error_log("Richiesta di riordinamento: day_id={$data->day_id}, exercise_id={$data->exercise_id}, direction={$data->direction}");
        
        // Assegna i valori alle proprietà del modello
        $workoutExercise->day_id = $data->day_id;
        $workoutExercise->id = $data->exercise_id;
        $direction = $data->direction;
        
        // Verifica che l'esercizio esista
        if (!$workoutExercise->readOne()) {
            error_log("Errore: esercizio non trovato con ID {$workoutExercise->id}");
            http_response_code(404);
            echo json_encode(
                array(
                    'success' => false,
                    'message' => 'Esercizio non trovato.'
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
                    'message' => 'Direzione non valida. Usare "up" o "down".'
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
                    'message' => 'Ordine degli esercizi aggiornato con successo.'
                )
            );
        } else {
            error_log("Fallimento nel riordinamento degli esercizi");
            // Se il riordinamento fallisce
            http_response_code(503);
            echo json_encode(
                array(
                    'success' => false,
                    'message' => 'Impossibile riordinare gli esercizi. Verifica i log per maggiori dettagli.'
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
                'message' => 'Dati incompleti. Specificare day_id, exercise_id e direction.'
            )
        );
    }
} catch (Exception $e) {
    error_log("Eccezione durante il riordinamento: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(
        array(
            'success' => false,
            'message' => 'Errore interno del server: ' . $e->getMessage()
        )
    );
} 