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
require_once '../../lib/tier_limits.php';
require_once '../../lib/home_rules.php';
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

    // Home: oggi, giorni allenati della settimana (lunedì-domenica) e giorno della scheda da proporre.
    // Il giorno di un allenamento è quello della sua data (ora locale del luogo), come per il conteggio sopra.
    $today = $now->format('Y-m-d');
    $stmt_dates = $db->prepare("SELECT date FROM gym_workout_history WHERE user_id = ? AND date >= ?");
    $stmt_dates->execute([$user_id, $monday_str]);
    $week_dates = $stmt_dates->fetchAll(PDO::FETCH_COLUMN);
    $week_days = week_day_flags($week_dates, $monday->format('Y-m-d'));
    $trained_today = $week_days[$dayOfWeek - 1];

    // Scheda attiva: giorni in ordine con il numero di esercizi (la rotazione è in next_plan_day)
    $stmt_days = $db->prepare("SELECT wd.id, wd.name, COUNT(we.id) AS exercises
                        FROM gym_workout_plans wp
                        JOIN gym_workout_days wd ON wd.plan_id = wp.id
                        LEFT JOIN gym_workout_exercises we ON we.day_id = wd.id
                        WHERE wp.user_id = ? AND wp.is_active = 1
                        GROUP BY wd.id, wd.name, wd.day_order
                        ORDER BY wd.day_order, wd.id");
    $stmt_days->execute([$user_id]);
    $plan_days = array_map(function ($row) {
        return ['id' => (int) $row['id'], 'name' => $row['name'], 'exercises' => (int) $row['exercises']];
    }, $stmt_days->fetchAll(PDO::FETCH_ASSOC));
    $stmt_last = $db->prepare("SELECT day_id FROM gym_workout_history WHERE user_id = ? ORDER BY date DESC, id DESC LIMIT 1");
    $stmt_last->execute([$user_id]);
    $last_day_id = $stmt_last->fetchColumn();
    $next_day = next_plan_day($plan_days, $last_day_id === false || $last_day_id === null ? null : (int) $last_day_id);

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

    // Stato muscolare e serie per muscolo completi solo con le funzioni che li abilitano (user_features);
    // senza, stato ridotto e solo il totale delle serie (lib/tier_limits.php)
    // (un solo user_features: una sola lettura del livello, al posto di due user_has_feature)
    $features = user_features($db, $user_id);
    $status_full = in_array('muscle_status_full', $features, true);
    $sets_full = in_array('weekly_sets_by_muscle', $features, true);
    $detail = dashboardDetail($status_full, $sets_full);

    if (ob_get_length()) ob_clean();
    header('Content-Type: application/json');
    echo json_encode([
        'success' => true,
        'detail' => $detail,
        'weekly_workouts' => $weekly_workouts,
        'today' => $today,
        'trained_today' => $trained_today,
        'week_days' => $week_days,
        'next_day' => $next_day,
        'plan_days_total' => $plan_days_total,
        'weekly_goal' => weekly_goals($db, [$user_id])[$user_id],
        'weekly_volume' => [
            'total_weight' => round($total_weight, 2),
            'total_reps' => $total_reps
        ],
        'recovery' => recoveryForDetail($recovery_status, $status_full),
        'weekly_sets' => weeklySetsForDetail($weekly_sets, $sets_full),
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
