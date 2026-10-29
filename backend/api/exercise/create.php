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
include_once '../../lib/admin_notify.php';
require_once '../../lib/muscle_rules.php';

header('Content-Type: application/json');

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        api_error(405, 'method_not_allowed', t_server('common.method_not_allowed'));
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
        api_error(400, 'invalid_name', t_server('exercise.name_invalid'));
    }
    $muscle_group = is_string($data['muscle_group'] ?? null) ? mb_strtolower(trim($data['muscle_group']), 'UTF-8') : '';
    if (!in_array($muscle_group, $exercise->muscleGroups(), true)) {
        api_error(400, 'invalid_muscle_group', t_server('exercise.muscle_invalid'));
    }
    // "Gambe" non ha un default: la scelta del muscolo principale è obbligatoria. Gli altri
    // gruppi si derivano da soli, ma accettano anche una scelta esplicita coerente (es. glutei → abduttori).
    $primary_muscle = muscleResolvePrimary($muscle_group, is_string($data['primary_muscle'] ?? null) ? $data['primary_muscle'] : null);
    if ($primary_muscle === null) {
        api_error(400, 'invalid_primary_muscle', t_server('exercise.primary_muscle_invalid'));
    }

    $existing = $exercise->findVisibleByName($name, $user_id);
    if ($existing) {
        api_json_response(array(
            'success' => false,
            'code' => 'duplicate',
            'message' => t_server('exercise.exists'),
            'exercise' => exercise_public($existing, $user_id),
        ), 409);
    }

    if ($exercise->countPersonal($user_id) >= Exercise::MAX_PERSONAL) {
        api_error(409, 'too_many_exercises', t_server('exercise.too_many', array('max' => Exercise::MAX_PERSONAL)));
    }

    enforce_rate_limit($db, 'exercise_create_user', 'exercise:create:user:' . $user_id);

    $exercise->name = $name;
    $exercise->muscle_group = $muscle_group;
    $exercise->primary_muscle = $primary_muscle;
    $exercise->created_by = $user_id;
    $exercise->status = 'pending';
    if (!$exercise->create()) {
        throw new Exception('INSERT gym_exercises fallita');
    }
    after_response(function () use ($name) {
        admin_notify_exercise($name);
    });

    api_json_response(array(
        'success' => true,
        'message' => t_server('exercise.created'),
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
    api_error(500, 'server_error', t_server('exercise.create_failed'));
}
