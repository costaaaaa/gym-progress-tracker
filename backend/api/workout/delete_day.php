<?php
// POST {day_id} → elimina un giorno di scheda con i suoi esercizi e le serie pianificate, e rinumera i
// giorni rimasti. L'ultimo giorno di una scheda non si elimina (si elimina la scheda). Ammesso anche con la
// scheda in sola lettura: è il modo di tornare sotto il limite dei giorni senza perdere tutta la scheda.
include_once '../../config/cors_headers.php';

include_once '../../config/database.php';
include_once '../../config/api_helpers.php';
include_once '../../models/WorkoutDay.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    api_error(405, 'method_not_allowed', t_server('common.method_not_allowed'));
}

$database = new Database();
$db = $database->getConnection();

$user_id = require_authenticated_user($db);

$data = json_decode(file_get_contents("php://input"));

if (empty($data->day_id)) {
    api_json_response(array('success' => false, 'message' => t_server('workout.day_delete_incomplete')), 400);
}

$day_id = (int)$data->day_id;

if (!workout_day_belongs_to_user($db, $day_id, $user_id)) {
    api_not_found();
}

$workout_day = new WorkoutDay($db);
$workout_day->id = $day_id;

try {
    $result = $workout_day->delete();
} catch (Exception $e) {
    error_log("Errore in delete_day.php: " . $e->getMessage());
    api_json_response(array('success' => false, 'message' => t_server('workout.day_delete_failed')), 503);
}

if ($result === 'not_found') {
    // eliminato nel frattempo da un'altra richiesta
    api_not_found();
}
if ($result === 'last_day') {
    api_error(409, 'last_day', t_server('workout.day_last'));
}

api_json_response(array('success' => true, 'message' => t_server('workout.day_deleted')));
