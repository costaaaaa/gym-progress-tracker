<?php
// Include common CORS headers
include_once '../../config/cors_headers.php';

// Include database and models
include_once '../../config/database.php';
include_once '../../models/WorkoutHistory.php';

// Verifica se l'utente è autenticato
if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Utente non autenticato']);
    exit;
}

try {
    // Recupera i dati inviati
    $data = json_decode(file_get_contents("php://input"));

    if (!$data || !isset($data->exercises) || !is_array($data->exercises) || empty($data->exercises)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Dati mancanti o non validi']);
        exit;
    }

    // Inizializza la connessione al database
    $database = new Database();
    $db = $database->getConnection();

    // Crea un'istanza del modello WorkoutHistory
    $workout_history = new WorkoutHistory($db);

    // Imposta le proprietà
    $workout_history->user_id = $_SESSION['user_id'];
    $workout_history->exercises = json_encode($data->exercises);
    $workout_history->date = isset($data->date) ? $data->date : date('Y-m-d H:i:s');
    $workout_history->notes = isset($data->notes) ? $data->notes : '';

    // Registra l'allenamento
    if ($workout_history->create()) {
        http_response_code(201);
        echo json_encode([
            'success' => true,
            'message' => 'Allenamento registrato con successo',
            'id' => $workout_history->id
        ]);
    } else {
        http_response_code(503);
        echo json_encode([
            'success' => false,
            'message' => 'Impossibile registrare l\'allenamento'
        ]);
    }
} catch (Exception $e) {
    error_log("Create workout history error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Errore durante la registrazione dell\'allenamento'
    ]);
}
