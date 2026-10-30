<?php
/**
 * Dashboard Stats API
 * Returns aggregated statistics for the user dashboard, including weekly progress and muscle recovery.
 */

// Include common CORS headers (this also starts the session and output buffering)
include_once '../../config/cors_headers.php';

include_once '../../config/database.php';
include_once '../../config/api_helpers.php';
include_once '../../models/User.php';
require_once '../../lib/weekly_stats.php';
require_once '../../lib/muscle_rules.php';
require_once '../../lib/weekly_sets.php';
require_once '../../lib/recovery_rules.php';
include_once '../../models/WorkoutHistory.php';
include_once '../../models/WorkoutSet.php';
include_once '../../models/WorkoutPlan.php';

try {
    $database = new Database();
    $db = $database->getConnection();
    if (!$db) throw new Exception("Connessione al database fallita.");

    $user_id = require_authenticated_user($db);

    // 1. Dati Utente e Livello
    $user_model = new User($db);
    if (!$user_model->readById($user_id)) {
        throw new Exception("Utente non trovato.");
    }

    $experience = isset($user_model->experience_years) ? floatval($user_model->experience_years) : 0;
    if ($experience < 1) $level = 'amatoriale';
    else if ($experience <= 3) $level = 'intermedio';
    else $level = 'avanzato';

    // 2. Statistiche Settimanali (Lunedì - Domenica)
    $now = user_now();
    $dayOfWeek = $now->format('N'); // 1 (Lunedì) - 7 (Domenica)
    $monday = clone $now;
    $monday->modify('-' . ($dayOfWeek - 1) . ' days')->setTime(0, 0, 0);

    $monday_str = $monday->format('Y-m-d H:i:s');

    // Allenamenti effettuati questa settimana
    $query_weekly_count = "SELECT COUNT(*) as count FROM gym_workout_history WHERE user_id = ? AND date >= ?";
    $stmt_count = $db->prepare($query_weekly_count);
    $stmt_count->execute([$user_id, $monday_str]);
    $weekly_workouts = intval($stmt_count->fetch(PDO::FETCH_ASSOC)['count'] ?? 0);

    // Giorni totali piano attivo
    $query_plan_days = "SELECT COUNT(wd.id) as days_count
                        FROM gym_workout_plans wp
                        JOIN gym_workout_days wd ON wp.id = wd.plan_id
                        WHERE wp.user_id = ? AND wp.is_active = 1";
    $stmt_plan = $db->prepare($query_plan_days);
    $stmt_plan->execute([$user_id]);
    $plan_days_total = intval($stmt_plan->fetch(PDO::FETCH_ASSOC)['days_count'] ?? 0);

    // Volume settimanale (Recupero grezzo per calcolo sicuro in PHP). Le serie di riscaldamento
    // (#66) non sono allenanti: escluse dal volume.
    $query_volume_raw = "SELECT ws.weight, ws.reps
                        FROM gym_workout_sets ws
                        JOIN gym_workout_history wh ON ws.workout_history_id = wh.id
                        WHERE wh.user_id = ? AND wh.date >= ? AND ws.is_warmup = 0";
    $stmt_vol_raw = $db->prepare($query_volume_raw);
    $stmt_vol_raw->execute([$user_id, $monday_str]);

    $total_weight = 0;
    $total_reps = 0;
    while($row = $stmt_vol_raw->fetch(PDO::FETCH_ASSOC)) {
        $reps = parseReps($row['reps']);
        $weight = floatval($row['weight']);
        $total_weight += ($weight * $reps);
        $total_reps += $reps;
    }

    // 3. Recupero Muscolare (le regole stanno in lib/recovery_rules.php, testate a parte in
    // tests/recovery_rules_test.php). Le misure del corpo (peso, grasso) non entrano nel calcolo.
    // Serie allenanti degli ultimi 40 giorni (il riscaldamento, #66, non conta): 10 per il recupero e
    // 30 in più per i riferimenti del fattore di vicinanza al cedimento. La finestra dei 10 giorni la
    // applica recoveryStatus.
    $since_str = (clone $now)->modify('-40 days')->format('Y-m-d H:i:s');
    $query_sets = "SELECT wh.id AS history_id, wh.date, wh.time_zone, ws.id AS set_id, ws.exercise_id,
                          e.primary_muscle, ws.reps, ws.weight, ws.seconds_from_start
                   FROM gym_workout_sets ws
                   JOIN gym_workout_history wh ON ws.workout_history_id = wh.id
                   JOIN gym_exercises e ON ws.exercise_id = e.id
                   WHERE wh.user_id = ? AND wh.date >= ? AND ws.is_warmup = 0
                   ORDER BY wh.date ASC";
    $stmt_sets = $db->prepare($query_sets);
    $stmt_sets->execute([$user_id, $since_str]);
    $all_sets = $stmt_sets->fetchAll(PDO::FETCH_ASSOC);

    $recovery_rows = [];
    foreach ($all_sets as $set) {
        $recovery_rows[] = [
            'history_id' => intval($set['history_id']),
            'date' => $set['date'],
            'started_at' => workout_instant($set['date'], $set['time_zone']),
            'set_id' => intval($set['set_id']),
            'exercise_id' => intval($set['exercise_id']),
            'primary_muscle' => $set['primary_muscle'],
            'weight' => $set['weight'],
            'reps' => $set['reps'],
            'seconds_from_start' => $set['seconds_from_start'] === null ? null : intval($set['seconds_from_start'])
        ];
    }

    $recovery_status = recoveryStatus($recovery_rows, [
        'level' => $level,
        'age' => isset($user_model->age) ? intval($user_model->age) : null,
        'gender' => $user_model->gender ?? null
    ], $now);

    // 4. Serie allenanti per muscolo: questa settimana vs la settimana scorsa allo stesso punto
    // (bucketing puro in weeklySetsBuckets, testato a parte in tests/weekly_sets_test.php). Il
    // riscaldamento (#66) non e' allenante: escluso dal conteggio.
    $previous_monday_str = (clone $monday)->modify('-7 days')->format('Y-m-d H:i:s');
    $query_weekly_sets = "SELECT e.primary_muscle, wh.date
                        FROM gym_workout_sets ws
                        JOIN gym_workout_history wh ON ws.workout_history_id = wh.id
                        JOIN gym_exercises e ON ws.exercise_id = e.id
                        WHERE wh.user_id = :user_id AND wh.date >= :previous_monday AND ws.is_warmup = 0";
    $stmt_weekly_sets = $db->prepare($query_weekly_sets);
    $stmt_weekly_sets->execute([
        'previous_monday' => $previous_monday_str,
        'user_id' => $user_id
    ]);
    $weekly_sets = weeklySetsBuckets($stmt_weekly_sets->fetchAll(PDO::FETCH_ASSOC), $monday, $now);

    if (ob_get_length()) ob_clean();
    header('Content-Type: application/json');
    echo json_encode([
        'success' => true,
        'weekly_workouts' => $weekly_workouts,
        'plan_days_total' => $plan_days_total,
        'weekly_goal' => weekly_goals($db, [$user_id])[$user_id],
        'weekly_volume' => [
            'total_weight' => round($total_weight, 2),
            'total_reps' => $total_reps
        ],
        'recovery' => $recovery_status,
        'weekly_sets' => $weekly_sets,
        'user_level' => $level
    ]);

} catch (Throwable $e) {
    error_log("Dashboard stats error: " . $e->getMessage());
    http_response_code(500);
    if (ob_get_length()) ob_clean();
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => t_server('common.server_error')]);
}
ob_end_flush();
