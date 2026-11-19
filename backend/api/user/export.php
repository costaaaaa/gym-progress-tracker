<?php
// Esportazione completa dei dati dell'utente autenticato (portabilita', art. 20 GDPR).
// Un solo file JSON per web e mobile. Non contiene hash di password ne' token.
// Le misure corporee sono incluse anche senza consenso attivo: il diritto di accesso vale per
// tutto cio' che conserviamo.
include_once '../../config/cors_headers.php';
include_once '../../config/database.php';
include_once '../../config/api_helpers.php';
include_once '../../models/WorkoutExercise.php';
require_once '../../lib/gamification_rules.php';
require_once '../../lib/units.php';

$database = new Database();
$db = $database->getConnection();

// Dal giorno 8 senza email confermata resta raggiungibile: il diritto di accesso ai dati non si sospende
$user_id = require_authenticated_user($db, ALLOW_UNVERIFIED);

// Pesi e circonferenze escono nell'unita' dell'account (kg e cm, oppure lb e pollici): vedi lib/units.php. L'intestazione
// `units` del file la dichiara. I campi con l'unita' nel nome (lifetime_volume_kg) restano in kg per tutti.
const EXPORT_BODY_LENGTH_COLUMNS = array('chest_size', 'arm_size', 'waist_size', 'leg_size');

// Colonne data+ora che il database tiene nel fuso del server: nell'export diventano ISO 8601 con
// offset. Una colonna nuova di questo tipo va aggiunta qui. Le colonne DATE (date, birth_date, ...)
// restano com'erano.
const EXPORT_DATETIME_COLUMNS = array(
    'created_at', 'email_verified_at', 'password_changed_at', 'last_login_at', 'unlocked_at', 'expires_at', 'revoked_at',
    'granted_at', 'share_consent_at', 'joined_at', 'decided_at', 'applied_at',
);

// Esegue una query con parametri e ritorna tutte le righe
function export_rows($db, $sql, $params)
{
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($rows as &$row) {
        foreach ($row as $column => &$value) {
            if (in_array($column, EXPORT_DATETIME_COLUMNS, true)) $value = server_time_iso($value);
        }
        unset($value);
    }
    unset($row);
    return $rows;
}

try {
    $profile = export_rows($db,
        "SELECT weight_unit, username, email, email_verified_at, pending_email, birth_date, gender, training_start_date, rest_timer_enabled, time_zone,
                created_at, password_changed_at, last_login_at
         FROM gym_users WHERE id = ?", array($user_id));
    if (!$profile) {
        api_json_response(array('success' => false, 'message' => t_server('common.user_not_found')), 404);
    }

    // L'unita' serve all'export ma non ne fa parte: la sezione profile resta quella di sempre
    $unit = units_normalize($profile[0]['weight_unit']);
    unset($profile[0]['weight_unit']);

    // Schede -> giorni -> esercizi
    $plans = export_rows($db,
        "SELECT id, name, description, is_active, created_at FROM gym_workout_plans WHERE user_id = ? ORDER BY id",
        array($user_id));
    $days = export_rows($db,
        "SELECT d.id, d.plan_id, d.name, d.day_order FROM gym_workout_days d
         JOIN gym_workout_plans p ON p.id = d.plan_id WHERE p.user_id = ? ORDER BY d.plan_id, d.day_order",
        array($user_id));
    $planExercises = export_rows($db,
        "SELECT we.id, we.day_id, e.name AS exercise, e.muscle_group, we.rest, we.notes, we.position
         FROM gym_workout_exercises we
         JOIN gym_workout_days d ON d.id = we.day_id
         JOIN gym_workout_plans p ON p.id = d.plan_id
         JOIN gym_exercises e ON e.id = we.exercise_id
         WHERE p.user_id = ? ORDER BY we.day_id, we.position, we.id", array($user_id));
    $setsByExercise = WorkoutExercise::plannedSetsByExercises($db, array_column($planExercises, 'id'));
    $exercisesByDay = array();
    foreach ($planExercises as $row) {
        $dayId = $row['day_id'];
        $row['planned_sets'] = isset($setsByExercise[$row['id']]) ? $setsByExercise[$row['id']] : array();
        unset($row['day_id'], $row['id']);
        $exercisesByDay[$dayId][] = $row;
    }
    $daysByPlan = array();
    foreach ($days as $day) {
        $dayId = $day['id'];
        $planId = $day['plan_id'];
        $daysByPlan[$planId][] = array(
            'name' => $day['name'],
            'order' => $day['day_order'],
            'exercises' => isset($exercisesByDay[$dayId]) ? $exercisesByDay[$dayId] : array(),
        );
    }
    $planList = array();
    foreach ($plans as $plan) {
        $planList[] = array(
            'name' => $plan['name'],
            'description' => $plan['description'],
            'active' => (bool)$plan['is_active'],
            'created_at' => $plan['created_at'],
            'days' => isset($daysByPlan[$plan['id']]) ? $daysByPlan[$plan['id']] : array(),
        );
    }

    // Storico allenamenti con le serie
    $history = export_rows($db,
        "SELECT id, date, time_zone, duration_seconds, notes FROM gym_workout_history WHERE user_id = ? ORDER BY date, id",
        array($user_id));
    $sets = export_rows($db,
        "SELECT s.workout_history_id, e.name AS exercise, s.set_number, s.weight, s.reps, s.intensity_technique, s.is_warmup, s.seconds_from_start
         FROM gym_workout_sets s
         JOIN gym_workout_history h ON h.id = s.workout_history_id
         JOIN gym_exercises e ON e.id = s.exercise_id
         WHERE h.user_id = ? ORDER BY s.workout_history_id, s.id", array($user_id));
    $setsByHistory = array();
    foreach ($sets as $row) {
        $historyId = $row['workout_history_id'];
        unset($row['workout_history_id']);
        $row['weight'] = units_export_weight($row['weight'], $unit);
        $setsByHistory[$historyId][] = $row;
    }
    $workouts = array();
    foreach ($history as $h) {
        $workouts[] = array(
            'date' => $h['date'],
            'time_zone' => $h['time_zone'],
            'started_at' => workout_started_at($h['date'], $h['time_zone']),
            'duration_seconds' => $h['duration_seconds'] !== null ? (int)$h['duration_seconds'] : null,
            'notes' => $h['notes'],
            'sets' => isset($setsByHistory[$h['id']]) ? $setsByHistory[$h['id']] : array(),
        );
    }

    $export = array(
        'success' => true,
        'units' => units_export_header($unit),
        'exported_at' => date('c'),
        'profile' => $profile[0],
        'plans' => $planList,
        'workouts' => $workouts,
        'body_stats' => array_map(function ($row) use ($unit) {
            $row['weight'] = units_export_weight($row['weight'], $unit, UNITS_TENTH_LB);
            foreach (EXPORT_BODY_LENGTH_COLUMNS as $column) $row[$column] = units_export_length($row[$column], $unit);
            return $row;
        }, export_rows($db,
            "SELECT date, weight, body_fat_percentage, muscle_mass_percentage, chest_size, arm_size, waist_size, leg_size,
                    health_fields AS from_health, created_at
             FROM gym_user_stats WHERE user_id = ? ORDER BY date", array($user_id))),
        'gamification' => array(
            'profile' => export_rows($db,
                "SELECT current_streak_weeks, longest_streak_weeks, last_completed_week, total_xp, level, lifetime_volume_kg
                 FROM gym_user_gamification WHERE user_id = ?", array($user_id)),
            'exercises' => export_rows($db,
                "SELECT e.name AS exercise, g.xp, g.level FROM gym_exercise_gamification g
                 JOIN gym_exercises e ON e.id = g.exercise_id WHERE g.user_id = ?", array($user_id)),
            'achievements' => export_rows($db,
                "SELECT achievement_key, unlocked_at FROM gym_achievements WHERE user_id = ? ORDER BY unlocked_at", array($user_id)),
            // 'from' e' il lunedi' da cui vale l'obiettivo settimanale scelto; goal null = default
            'weekly_goal_changes' => array_map(function ($row) {
                return array('from' => yearweekMonday((int) $row['from_yearweek'])->format('Y-m-d'), 'goal' => $row['goal'] === null ? null : (int) $row['goal']);
            }, export_rows($db,
                "SELECT from_yearweek, goal FROM gym_weekly_goal_changes WHERE user_id = ? ORDER BY from_yearweek", array($user_id))),
        ),
        'devices' => export_rows($db,
            "SELECT device_info, created_at, expires_at, revoked_at FROM gym_api_tokens WHERE user_id = ? ORDER BY created_at",
            array($user_id)),
        'consents' => export_rows($db,
            "SELECT purpose, version, granted_at, revoked_at FROM gym_consents WHERE user_id = ? ORDER BY id", array($user_id)),
        'groups' => export_rows($db,
            "SELECT g.name, g.type, m.role, m.share_level, m.share_consent_at, m.joined_at
             FROM gym_group_members m JOIN gym_groups g ON g.id = m.group_id
             WHERE m.user_id = ? ORDER BY m.joined_at", array($user_id)),
        // Codice di registrazione usato (null se l'account non ne ha usati): testo, livello, durata, stato, date
        'signup_code' => (export_rows($db,
            "SELECT c.code, c.tier, c.duration_days, s.status, s.created_at, s.applied_at
             FROM gym_signup_code_uses s JOIN gym_signup_codes c ON c.id = s.code_id WHERE s.user_id = ?", array($user_id)) ?: array(null))[0],
        // Segnalazioni fatte dall'utente, con l'esito
        'reports' => export_rows($db,
            "SELECT target, target_label, reason, status, decision_note, decided_at, created_at
             FROM gym_reports WHERE reporter_user_id = ? ORDER BY id", array($user_id)),
    );

    // Sezioni aggiuntive fornite da un modulo del server, se presente
    $extrasFile = __DIR__ . '/../../lib/export_extras.php';
    if (is_file($extrasFile)) {
        include_once $extrasFile;
        $export += export_extra_sections($db, $user_id);
    }

    api_json_response($export);
} catch (Exception $e) {
    error_log('Export error: ' . $e->getMessage());
    api_json_response(array('success' => false, 'message' => t_server('export.error')), 500);
}
