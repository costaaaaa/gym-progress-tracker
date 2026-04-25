<?php
// Include common CORS headers
include_once '../../config/cors_headers.php';

// Include database and models
include_once '../../config/database.php';
include_once '../../models/WorkoutHistory.php';
include_once '../../models/WorkoutSet.php';

// Start session
session_start();

// Verifica se l'utente è autenticato
if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Utente non autenticato']);
    exit;
}

try {
    // Recupera i dati inviati
    $data = json_decode(file_get_contents("php://input"));
    
    if (!$data || !isset($data->workout_records) || !is_array($data->workout_records) || empty($data->workout_records)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Dati mancanti o non validi']);
        exit;
    }
    
    // Inizializza la connessione al database
    $database = new Database();
    $db = $database->getConnection();
    
    // Inizia una transazione
    $db->beginTransaction();
    
    try {
        // Crea un'istanza del modello WorkoutHistory
        $workout_history = new WorkoutHistory($db);
        
        // Prepara i dati per l'inserimento
        $workout_history->user_id = $_SESSION['user_id'];
        $workout_history->date = date('Y-m-d H:i:s');
        $workout_history->notes = isset($data->notes) ? $data->notes : '';
        
        // Manteniamo anche il vecchio formato JSON per retrocompatibilità
        $workout_history->exercises = json_encode($data->workout_records);
        
        // Registra l'allenamento nella tabella principale
        if ($workout_history->create()) {
            $workout_id = $workout_history->id;
            $sets_saved = 0;
            
            // Crea un'istanza del modello WorkoutSet
            $workout_set = new WorkoutSet($db);
            
            // Salva ogni set nella nuova tabella gym_workout_sets
            foreach ($data->workout_records as $record) {
                // Verifica l'ID dell'esercizio
                if (!isset($record->exercise_id) || empty($record->exercise_id)) {
                    continue;
                }
                
                $workout_set->workout_history_id = $workout_id;
                $workout_set->exercise_id = $record->exercise_id;
                $workout_set->set_number = $record->set_number;
                $workout_set->weight = $record->weight;
                $workout_set->reps = $record->reps;
                $workout_set->intensity_technique = isset($record->intensity_technique) && $record->intensity_technique !== "" ? $record->intensity_technique : null;
                
                if ($workout_set->create()) {
                    $sets_saved++;
                } else {
                    throw new Exception("Impossibile salvare il set per l'esercizio ID: {$record->exercise_id}");
                }
            }
            
            // Se tutto è andato bene, conferma la transazione
            $db->commit();
            
            http_response_code(201);
            echo json_encode([
                'success' => true,
                'message' => 'Allenamento registrato con successo',
                'id' => $workout_id,
                'sets_saved' => $sets_saved
            ]);
        } else {
            throw new Exception("Impossibile registrare l'allenamento");
        }
    } catch (Exception $e) {
        // In caso di errore, annulla tutte le modifiche
        $db->rollBack();
        throw $e;
    }
} catch (Exception $e) {
    // Log dell'errore
    error_log("Error in record_workout.php: " . $e->getMessage());
    
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Errore durante la registrazione dell\'allenamento',
        'error' => $e->getMessage()
    ]);
} 