<?php
include_once '../../config/cors_headers.php';

include_once '../../config/database.php';
include_once '../../config/api_helpers.php';
include_once '../../models/WorkoutHistory.php';
require_once '../../lib/workout_gamification.php';

$database = new Database();
$db = $database->getConnection();
$user_id = require_authenticated_user($db);

try {
    // Recupera i dati inviati
    $data = json_decode(file_get_contents("php://input"));

    if (!$data || !isset($data->id) || empty($data->id)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => t_server('history.id_invalid')]);
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
            'message' => t_server('history.not_found')
        ]);
        exit;
    }

    // Toglie quello che l'allenamento aveva dato (XP, livelli) e lo elimina, tutto o niente.
    // Anteprima: stessi calcoli, poi tutto annullato.
    $preview = !empty($data->preview);
    $db->beginTransaction();
    try {
        $undone = undo_workout_gamification($db, $user_id, (int) $workout_history->id);
        $deleted = $workout_history->delete();
        if ($deleted && !$preview) {
            $db->commit();
        } else {
            $db->rollBack();
        }
    } catch (Exception $e) {
        $db->rollBack();
        throw $e;
    }

    if ($deleted) {
        http_response_code(200);
        echo json_encode(array_merge([
            'success' => true,
            'preview' => $preview,
            'message' => $preview ? t_server('history.delete_preview') : t_server('history.deleted')
        ], $undone));
    } else {
        http_response_code(503);
        echo json_encode([
            'success' => false,
            'message' => t_server('history.delete_failed')
        ]);
    }
} catch (Exception $e) {
    error_log("Delete workout history error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => t_server('history.delete_error')
    ]);
}
