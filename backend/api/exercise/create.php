<?php
// POST {name, muscle_group} → crea un esercizio personale.
// Lo vede e lo usa subito solo chi l'ha creato; entra nel catalogo di tutti quando un admin
// lo approva (api/admin/exercises.php). Se esiste già un esercizio visibile con lo stesso nome
// risponde 409 con quello, così il client lo seleziona invece di creare un doppione.
include_once '../../config/cors_headers.php';
include_once '../../config/database.php';
include_once '../../config/api_helpers.php';
include_once '../../config/rate_limiter.php';
include_once '../../models/Exercise.php';

header('Content-Type: application/json');

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        api_error(405, 'method_not_allowed', 'Metodo non consentito');
    }

    $database = new Database();
    $db = $database->getConnection();

    $user_id = require_authenticated_user($db);
    $user_id = (int)$user_id;

    $data = json_decode(file_get_contents('php://input'), true);
    $data = is_array($data) ? $data : array();

    $exercise = new Exercise($db);

    $name = Exercise::cleanName($data['name'] ?? null);
    if ($name === null) {
        api_error(400, 'invalid_name', 'Il nome deve avere da 2 a 60 caratteri (lettere, numeri e punteggiatura semplice) e non può contenere link.');
    }
    $muscle_group = is_string($data['muscle_group'] ?? null) ? mb_strtolower(trim($data['muscle_group']), 'UTF-8') : '';
    if (!in_array($muscle_group, $exercise->muscleGroups(), true)) {
        api_error(400, 'invalid_muscle_group', 'Gruppo muscolare non valido.');
    }

    $existing = $exercise->findVisibleByName($name, $user_id);
    if ($existing) {
        api_json_response(array(
            'success' => false,
            'code' => 'duplicate',
            'message' => 'Esiste già un esercizio con questo nome.',
            'exercise' => exercise_public($existing, $user_id),
        ), 409);
    }

    if ($exercise->countPersonal($user_id) >= Exercise::MAX_PERSONAL) {
        api_error(409, 'too_many_exercises', 'Hai già ' . Exercise::MAX_PERSONAL . ' esercizi personali in attesa di revisione.');
    }

    enforce_rate_limit($db, 'exercise_create_user', 'exercise:create:user:' . $user_id);

    $exercise->name = $name;
    $exercise->muscle_group = $muscle_group;
    $exercise->created_by = $user_id;
    $exercise->status = 'pending';
    if (!$exercise->create()) {
        throw new Exception('INSERT gym_exercises fallita');
    }

    api_json_response(array(
        'success' => true,
        'message' => 'Esercizio creato: lo vedi solo tu finché non viene approvato.',
        'exercise' => exercise_public(array(
            'id' => $exercise->id,
            'name' => $exercise->name,
            'name_en' => null,
            'muscle_group' => $exercise->muscle_group,
            'equipment' => null,
            'status' => 'pending',
            'created_by' => $user_id,
        ), $user_id),
    ), 201);
} catch (Throwable $e) {
    api_log_exception('exercise/create.php', $e);
    if (ob_get_length()) ob_clean();
    api_error(500, 'server_error', 'Impossibile creare l\'esercizio. Riprova più tardi.');
}
