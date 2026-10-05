<?php
// GET ?name=… → fino a 3 esercizi visibili all'utente con un nome simile ("Forse cercavi"), per
// evitare doppioni prima di creare un esercizio personale. Senza login: solo il catalogo approvato.
include_once '../../config/cors_headers.php';
include_once '../../config/database.php';
include_once '../../config/api_helpers.php';
include_once '../../models/Exercise.php';

header('Content-Type: application/json');

try {
    $name = is_string($_GET['name'] ?? null) ? trim($_GET['name']) : '';
    if (mb_strlen($name, 'UTF-8') < 3) {
        api_json_response(array('success' => true, 'records' => array()));
    }
    $name = mb_substr($name, 0, 60, 'UTF-8');

    $database = new Database();
    $db = $database->getConnection();
    $user_id = resolve_authenticated_user_id($db);
    $user_id = $user_id ? (int)$user_id : null;

    $exercise = new Exercise($db);
    $records = array_map(function ($r) use ($user_id) {
        return exercise_public($r, $user_id);
    }, Exercise::mostSimilar($name, $exercise->visibleRows($user_id), 3));

    api_json_response(array('success' => true, 'records' => $records));
} catch (Throwable $e) {
    api_log_exception('exercise/similar.php', $e);
    if (ob_get_length()) ob_clean();
    api_error(500, 'server_error', 'Errore del server.');
}
