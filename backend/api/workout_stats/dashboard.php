<?php
/**
 * Dashboard Stats API
 * Returns aggregated statistics for the user dashboard, including weekly progress and muscle recovery.
 */

// Include common CORS headers (this also starts the session and output buffering)
include_once '../../config/cors_headers.php';

// Include database and models
include_once '../../config/database.php';
include_once '../../models/User.php';
include_once '../../models/WorkoutHistory.php';
include_once '../../models/WorkoutSet.php';
include_once '../../models/WorkoutPlan.php';

// Helper function to safely parse reps string to integer
function parseReps($repsStr) {
    $repsStr = (string)$repsStr;

    if (is_numeric($repsStr)) return intval($repsStr);

    // Handle cases like "10+2", "10-12", "max"
    // Use first number found or default to 0
    if (preg_match('/(\d+)/', $repsStr, $matches)) {
        return intval($matches[1]);
    }
    return 0;
}

// Check if user is authenticated (session is already started in cors_headers.php)
if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    if (ob_get_length()) ob_clean();
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => 'Utente non autenticato']);
    exit;
}

try {
    $database = new Database();
    $db = $database->getConnection();
    if (!$db) throw new Exception("Connessione al database fallita.");

    $user_id = $_SESSION['user_id'];

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
    $today = new DateTime();
    $dayOfWeek = $today->format('N'); // 1 (Lunedì) - 7 (Domenica)
    $monday = clone $today;
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

    // Volume settimanale (Recupero grezzo per calcolo sicuro in PHP)
    $query_volume_raw = "SELECT ws.weight, ws.reps
                        FROM gym_workout_sets ws
                        JOIN gym_workout_history wh ON ws.workout_history_id = wh.id
                        WHERE wh.user_id = ? AND wh.date >= ?";
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
        'polpacci'     => ['amatoriale' => 42, 'intermedio' => 36, 'avanzato' => 30],
        'addome'       => ['amatoriale' => 36, 'intermedio' => 30, 'avanzato' => 24]
    ];

    // Mappatura gruppi muscolari (normalizzazione)
    $muscle_map = [
        'dorsali' => 'schiena',
        'lat' => 'schiena',
        'tricipite' => 'tricipiti',
        'bicipite' => 'bicipiti',
        'quadricipite' => 'quadricipiti',
        'femorale' => 'femorali',
        'gluteo' => 'glutei',
        'polpaccio' => 'polpacci',
        'addominali' => 'addome',
        'gambe' => 'quadricipiti'
    ];

    // Recupera tutte le serie degli ultimi 10 giorni
    $query_sets = "SELECT wh.date, e.muscle_group, ws.reps, ws.weight
                   FROM gym_workout_sets ws
                   JOIN gym_workout_history wh ON ws.workout_history_id = wh.id
                   JOIN gym_exercises e ON ws.exercise_id = e.id
                   WHERE wh.user_id = ? AND wh.date >= DATE_SUB(NOW(), INTERVAL 10 DAY)
                   ORDER BY wh.date ASC";
    $stmt_sets = $db->prepare($query_sets);
    $stmt_sets->execute([$user_id]);
    $all_sets = $stmt_sets->fetchAll(PDO::FETCH_ASSOC);

    // Raggruppa per sessione e gruppo muscolare
    $sessions_by_muscle = [];
    foreach ($all_sets as $set) {
        $mg = strtolower($set['muscle_group'] ?? '');
        if (isset($muscle_map[$mg])) $mg = $muscle_map[$mg];

        if (!isset($tempi_base[$mg])) continue;

        $date = $set['date'];

        if (!isset($sessions_by_muscle[$mg])) $sessions_by_muscle[$mg] = [];
        if (!isset($sessions_by_muscle[$mg][$date])) {
            $sessions_by_muscle[$mg][$date] = [
                'date' => $date,
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

        foreach ($mg_sessions as $date_str => $session) {
            $session_date = new DateTime($date_str);
            $last_trained = $date_str;

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
            $f_sesso = (($user_model->gender ?? 'M') === 'F') ? 0.90 : 1.0;

            $recovery_h = $base_h * $f_volume * $f_cedimento * $f_eta * $f_sesso;
            $recovery_h = round($recovery_h / 6) * 6;

            if ($last_ready_at && $session_date < $last_ready_at) {
                $diff = $last_ready_at->getTimestamp() - $session_date->getTimestamp();
                $residuo_h = $diff / 3600;
                $recovery_h += ($residuo_h * 0.50);
            }

            $last_ready_at = clone $session_date;
            $last_ready_at->modify('+' . round($recovery_h) . ' hours');
        }

        $now = new DateTime();
        if ($now >= $last_ready_at) {
            $percent = 100;
            $status = 'PRONTO';
        } else {
            $total_h = ($last_ready_at->getTimestamp() - (new DateTime($last_trained))->getTimestamp()) / 3600;
            $passed_h = ($now->getTimestamp() - (new DateTime($last_trained))->getTimestamp()) / 3600;
            $percent = $total_h > 0 ? min(99, round(($passed_h / $total_h) * 100)) : 100;

            if ($percent < 50) $status = 'AFFATICATO';
            else $status = 'IN RECUPERO';
        }

        $recovery_status[$mg] = [
            'percent' => $percent,
            'status' => $status,
            'last_trained' => $last_trained,
            'ready_at' => $last_ready_at->format('Y-m-d H:i:s')
        ];
    }

    // 4. Serie per muscolo (Settimana e Mese)
    $month_start = (new DateTime())->modify('first day of this month')->setTime(0,0,0)->format('Y-m-d H:i:s');

    // Recupero grezzo per calcolo in PHP (più sicuro)
    $query_sets_stats_raw = "SELECT e.muscle_group, wh.date
                        FROM gym_workout_sets ws
                        JOIN gym_workout_history wh ON ws.workout_history_id = wh.id
                        JOIN gym_exercises e ON ws.exercise_id = e.id
                        WHERE wh.user_id = :user_id AND wh.date >= :month";
    $stmt_sets_stats = $db->prepare($query_sets_stats_raw);
    $stmt_sets_stats->execute([
        'month' => $month_start,
        'user_id' => $user_id
    ]);

    $sets_stats = [];
    while($row = $stmt_sets_stats->fetch(PDO::FETCH_ASSOC)) {
        $mg = strtolower($row['muscle_group'] ?? '');
        if (isset($muscle_map[$mg])) $mg = $muscle_map[$mg];

        if (!isset($sets_stats[$mg])) {
            $sets_stats[$mg] = ['week' => 0, 'month' => 0];
        }

        $sets_stats[$mg]['month']++;
        if ($row['date'] >= $monday_str) {
            $sets_stats[$mg]['week']++;
        }
    }

    if (ob_get_length()) ob_clean();
    header('Content-Type: application/json');
    echo json_encode([
        'success' => true,
        'weekly_workouts' => $weekly_workouts,
        'plan_days_total' => $plan_days_total,
        'weekly_volume' => [
            'total_weight' => round($total_weight, 2),
            'total_reps' => $total_reps
        ],
        'recovery' => $recovery_status,
        'sets_stats' => $sets_stats,
        'user_level' => $level
    ]);

} catch (Throwable $e) {
    error_log("Dashboard stats error: " . $e->getMessage());
    http_response_code(500);
    if (ob_get_length()) ob_clean();
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => 'Errore interno del server.']);
}
ob_end_flush();
