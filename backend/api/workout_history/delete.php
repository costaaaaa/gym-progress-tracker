<?php
include_once '../../config/cors_headers.php';

include_once '../../config/database.php';
include_once '../../config/api_helpers.php';
include_once '../../models/WorkoutHistory.php';

$database = new Database();
$db = $database->getConnection();
$user_id = require_authenticated_user($db);

try {
    // Recupera i dati inviati
    $data = json_decode(file_get_contents("php://input"));

    if (!$data || !isset($data->id) || empty($data->id)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'ID allenamento mancante o non valido']);
        exit;
    }

    // Crea un'istanza del modello WorkoutHistory
    $workout_history = new WorkoutHistory($db);

    // Imposta le proprietà
    $workout_history->id = $data->id;
    $workout_history->user_id = $user_id;

    // Verifica che l'allenamento esista e appartenga all'utente
    if (!$workout_history->readOne()) {
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'message' => 'Allenamento non trovato o non autorizzato'
        ]);
        exit;
    }

    // Elimina l'allenamento
    if ($workout_history->delete()) {
        http_response_code(200);
        echo json_encode([
            'success' => true,
            'message' => 'Allenamento eliminato con successo'
        ]);
    } else {
        http_response_code(503);
        echo json_encode([
            'success' => false,
            'message' => 'Impossibile eliminare l\'allenamento'
        ]);
    }
} catch (Exception $e) {
    error_log("Delete workout history error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Errore durante l\'eliminazione dell\'allenamento'
    ]);
}
