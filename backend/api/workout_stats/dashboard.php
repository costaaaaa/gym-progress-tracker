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

    // 3. Recupero Muscolare
    $tempi_base = [
        'bicipiti'     => ['amatoriale' => 54, 'intermedio' => 48, 'avanzato' => 42],
        'tricipiti'    => ['amatoriale' => 54, 'intermedio' => 48, 'avanzato' => 42],
        'petto'        => ['amatoriale' => 66, 'intermedio' => 60, 'avanzato' => 54],
        'schiena'      => ['amatoriale' => 66, 'intermedio' => 60, 'avanzato' => 54],
        'spalle'       => ['amatoriale' => 54, 'intermedio' => 48, 'avanzato' => 42],
        'quadricipiti' => ['amatoriale' => 84, 'intermedio' => 72, 'avanzato' => 66],
        'femorali'     => ['amatoriale' => 84, 'intermedio' => 72, 'avanzato' => 66],
        'glutei'       => ['amatoriale' => 84, 'intermedio' => 72, 'avanzato' => 66],
        'adduttori'    => ['amatoriale' => 54, 'intermedio' => 48, 'avanzato' => 42],
        'abduttori'    => ['amatoriale' => 54, 'intermedio' => 48, 'avanzato' => 42],
        'polpacci'     => ['amatoriale' => 42, 'intermedio' => 36, 'avanzato' => 30],
        'addome'       => ['amatoriale' => 36, 'intermedio' => 30, 'avanzato' => 24]
    ];

    // Recupera tutte le serie degli ultimi 10 giorni (il riscaldamento, #66, non conta per il recupero)
    $since_str = (clone $now)->modify('-10 days')->format('Y-m-d H:i:s');
    $query_sets = "SELECT wh.date, wh.time_zone, e.primary_muscle, ws.reps, ws.weight
                   FROM gym_workout_sets ws
                   JOIN gym_workout_history wh ON ws.workout_history_id = wh.id
                   JOIN gym_exercises e ON ws.exercise_id = e.id
                   WHERE wh.user_id = ? AND wh.date >= ? AND ws.is_warmup = 0
                   ORDER BY wh.date ASC";
    $stmt_sets = $db->prepare($query_sets);
    $stmt_sets->execute([$user_id, $since_str]);
    $all_sets = $stmt_sets->fetchAll(PDO::FETCH_ASSOC);

    // Raggruppa per sessione e muscolo principale (gli esercizi senza, es. "gambe" personali
    // non ancora specificate, non contano: muscleCountedOf torna null)
    $sessions_by_muscle = [];
    foreach ($all_sets as $set) {
        $mg = muscleCountedOf($set['primary_muscle']);

        if ($mg === null || !isset($tempi_base[$mg])) continue;

        $date = $set['date'];

        if (!isset($sessions_by_muscle[$mg])) $sessions_by_muscle[$mg] = [];
        if (!isset($sessions_by_muscle[$mg][$date])) {
            $sessions_by_muscle[$mg][$date] = [
                'date' => $date,
                'started_at' => workout_instant($date, $set['time_zone']),
                'sets_count' => 0
            ];
        }
        $sessions_by_muscle[$mg][$date]['sets_count']++;
    }

    $recovery_status = [];
    foreach ($tempi_base as $mg => $times) {
        if (!isset($sessions_by_muscle[$mg])) {
            $recovery_status[$mg] = ['percent' => 100, 'status' => 'PRONTO', 'last_trained' => null];
            continue;
        }

        $mg_sessions = $sessions_by_muscle[$mg];
        ksort($mg_sessions);

        $last_ready_at = null;
        $last_trained = null;
        $last_trained_at = null;

        foreach ($mg_sessions as $date_str => $session) {
            $session_date = $session['started_at'];
            $last_trained = $date_str;
            $last_trained_at = $session['started_at'];

            $base_h = $times[$level];

            // A) Volume
            $f_volume = 1.0;
            if ($session['sets_count'] >= 6) $f_volume = 1.30;
            else if ($session['sets_count'] >= 4) $f_volume = 1.15;

            // B) Cedimento
            $f_cedimento = 1.0;

            // C) Età
            $age = isset($user_model->age) ? intval($user_model->age) : 25;
            if ($age >= 50) $f_eta = 1.35;
            else if ($age >= 40) $f_eta = 1.20;
            else if ($age >= 30) $f_eta = 1.10;
            else $f_eta = 1.0;

            // D) Sesso
            // M = 1.0, F = 0.90, altro/non indicato = valore intermedio
            $gender_value = $user_model->gender ?? null;
            $f_sesso = ($gender_value === 'F') ? 0.90 : (($gender_value === 'O') ? 0.95 : 1.0);

            $recovery_h = $base_h * $f_volume * $f_cedimento * $f_eta * $f_sesso;
            $recovery_h = round($recovery_h / 6) * 6;

            if ($last_ready_at && $session_date < $last_ready_at) {
                $diff = $last_ready_at->getTimestamp() - $session_date->getTimestamp();
                $residuo_h = $diff / 3600;
                $recovery_h += ($residuo_h * 0.50);
            }

            $last_ready_at = $session_date->modify('+' . round($recovery_h) . ' hours');
        }

        if ($now >= $last_ready_at) {
            $percent = 100;
            $status = 'PRONTO';
        } else {
            $total_h = ($last_ready_at->getTimestamp() - $last_trained_at->getTimestamp()) / 3600;
            $passed_h = ($now->getTimestamp() - $last_trained_at->getTimestamp()) / 3600;
            $percent = $total_h > 0 ? min(99, round(($passed_h / $total_h) * 100)) : 100;

            if ($percent < 50) $status = 'AFFATICATO';
            else $status = 'IN RECUPERO';
        }

        $recovery_status[$mg] = [
            'percent' => $percent,
            'status' => $status,
            'last_trained' => $last_trained,
            'ready_at' => $last_ready_at->setTimezone($now->getTimezone())->format('c')
        ];
    }

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
