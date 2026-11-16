<?php
// POST {day_id} → elimina un giorno di scheda con i suoi esercizi e le serie pianificate, e rinumera i
// giorni rimasti. L'ultimo giorno di una scheda non si elimina (si elimina la scheda). Ammesso anche con la
// scheda in sola lettura: è il modo di tornare sotto il limite dei giorni senza perdere tutta la scheda.
include_once '../../config/cors_headers.php';

include_once '../../config/database.php';
include_once '../../config/api_helpers.php';

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

try {
    $db->beginTransaction();

    $stmt = $db->prepare("SELECT plan_id FROM gym_workout_days WHERE id = ? FOR UPDATE");
    $stmt->execute([$day_id]);
    $plan_id = $stmt->fetchColumn();
    if ($plan_id === false) {
        // eliminato nel frattempo da un'altra richiesta
        $db->rollBack();
        api_not_found();
    }

    // Giorni della scheda, bloccati: il controllo dell'ultimo giorno e la rinumerazione non si accavallano
    // con un'altra eliminazione
    $stmt = $db->prepare("SELECT id FROM gym_workout_days WHERE plan_id = ? ORDER BY day_order, id FOR UPDATE");
    $stmt->execute([(int)$plan_id]);
    $day_ids = array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));
    if (count($day_ids) <= 1) {
        $db->rollBack();
        api_error(409, 'last_day', t_server('workout.day_last'));
    }

    // Cancellazioni esplicite dal basso: su MySQL 9.7 le cascate lunghe possono lasciare righe orfane
    // (come WorkoutPlan::deleteDaysAndExercises)
    $db->prepare("DELETE ps FROM gym_workout_plan_sets ps
                  JOIN gym_workout_exercises e ON e.id = ps.workout_exercise_id
                  WHERE e.day_id = ?")->execute([$day_id]);
    $db->prepare("DELETE FROM gym_workout_exercises WHERE day_id = ?")->execute([$day_id]);
    $db->prepare("DELETE FROM gym_workout_days WHERE id = ?")->execute([$day_id]);

    $update = $db->prepare("UPDATE gym_workout_days SET day_order = ? WHERE id = ?");
    $order = 0;
    foreach ($day_ids as $id) {
        if ($id === $day_id) {
            continue;
        }
        $update->execute([++$order, $id]);
    }

    $db->commit();
} catch (Exception $e) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    error_log("Errore in delete_day.php: " . $e->getMessage());
    api_json_response(array('success' => false, 'message' => t_server('workout.day_delete_failed')), 503);
}

api_json_response(array('success' => true, 'message' => t_server('workout.day_deleted')));
