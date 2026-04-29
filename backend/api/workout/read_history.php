<?php
// Include common CORS headers
include_once '../../config/cors_headers.php';

// Include database and models
include_once '../../config/database.php';
include_once '../../models/WorkoutPlan.php';

// Verifica se l'utente è autenticato
if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Utente non autenticato']);
    exit;
}

try {
    // Inizializza la connessione al database
    $database = new Database();
    $db = $database->getConnection();

    // Crea un'istanza del modello WorkoutPlan
    $workout = new WorkoutPlan($db);
    $workout->user_id = $_SESSION['user_id'];

    // Esegui la query per ottenere la cronologia
    $stmt = $workout->readHistory();
    $num = $stmt->rowCount();

    if ($num > 0) {
        // Array per i risultati
        $workouts_arr = array();

        // Estrai e formatta i dati
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            extract($row);

            $exercises_data = json_decode($exercises, true);
            if (json_last_error() !== JSON_ERROR_NONE) {
                $exercises_data = [];
            }

            $workout_item = array(
                'id' => $id,
                'date' => $date,
                'exercises' => $exercises_data,
                'notes' => $notes
            );

            array_push($workouts_arr, $workout_item);
        }

        // Imposta la risposta HTTP
        http_response_code(200);
        echo json_encode([
            'success' => true, 
            'records' => $workouts_arr
        ]);
    } else {
        // Nessun risultato trovato
        http_response_code(200); // Cambiato da 404 a 200 per gestire meglio il caso di lista vuota
        echo json_encode([
            'success' => true,
            'records' => [], 
            'message' => 'Nessun allenamento trovato'
        ]);
    }
} catch (Exception $e) {
    // Errore interno del server
    error_log("Read workout history error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Errore nel recupero della cronologia allenamenti'
    ]);
}
