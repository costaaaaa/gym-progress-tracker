<?php
// Esportazione completa dei dati dell'utente autenticato (portabilita', art. 20 GDPR).
// Un solo file JSON per web e mobile. Non contiene hash di password ne' token.
// Le misure corporee sono incluse anche senza consenso attivo: il diritto di accesso vale per
// tutto cio' che conserviamo.
include_once '../../config/cors_headers.php';
include_once '../../config/database.php';
include_once '../../config/api_helpers.php';

$database = new Database();
$db = $database->getConnection();

$user_id = require_authenticated_user($db);

// Esegue una query con parametri e ritorna tutte le righe
function export_rows($db, $sql, $params)
{
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

try {
    $profile = export_rows($db,
        "SELECT username, email, birth_date, gender, training_start_date, rest_timer_enabled,
                created_at, password_changed_at, last_login_at
         FROM gym_users WHERE id = ?", array($user_id));
    if (!$profile) {
        api_json_response(array('success' => false, 'message' => 'Utente non trovato'), 404);
    }

    // Schede -> giorni -> esercizi
    $plans = export_rows($db,
        "SELECT id, name, description, is_active, created_at FROM gym_workout_plans WHERE user_id = ? ORDER BY id",
        array($user_id));
    $days = export_rows($db,
        "SELECT d.id, d.plan_id, d.name, d.day_order FROM gym_workout_days d
         JOIN gym_workout_plans p ON p.id = d.plan_id WHERE p.user_id = ? ORDER BY d.plan_id, d.day_order",
        array($user_id));
    $planExercises = export_rows($db,
        "SELECT we.day_id, e.name AS exercise, e.muscle_group, we.sets, we.reps, we.rest,
                we.intensity_technique, we.notes
         FROM gym_workout_exercises we
         JOIN gym_workout_days d ON d.id = we.day_id
         JOIN gym_workout_plans p ON p.id = d.plan_id
         JOIN gym_exercises e ON e.id = we.exercise_id
         WHERE p.user_id = ? ORDER BY we.day_id, we.id", array($user_id));
    $exercisesByDay = array();
    foreach ($planExercises as $row) {
        $dayId = $row['day_id'];
        unset($row['day_id']);
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
        "SELECT id, date, duration_seconds, notes, exercises FROM gym_workout_history WHERE user_id = ? ORDER BY date, id",
        array($user_id));
    $sets = export_rows($db,
        "SELECT s.workout_history_id, e.name AS exercise, s.set_number, s.weight, s.reps, s.intensity_technique
         FROM gym_workout_sets s
         JOIN gym_workout_history h ON h.id = s.workout_history_id
         JOIN gym_exercises e ON e.id = s.exercise_id
         WHERE h.user_id = ? ORDER BY s.workout_history_id, s.id", array($user_id));
    $setsByHistory = array();
    foreach ($sets as $row) {
        $historyId = $row['workout_history_id'];
        unset($row['workout_history_id']);
        $setsByHistory[$historyId][] = $row;
    }
    $workouts = array();
    foreach ($history as $h) {
        $workouts[] = array(
            'date' => $h['date'],
            'duration_seconds' => $h['duration_seconds'] !== null ? (int)$h['duration_seconds'] : null,
            'notes' => $h['notes'],
            'exercises' => $h['exercises'],
            'sets' => isset($setsByHistory[$h['id']]) ? $setsByHistory[$h['id']] : array(),
        );
    }

    $export = array(
        'success' => true,
        'exported_at' => date('c'),
        'profile' => $profile[0],
        'plans' => $planList,
        'workouts' => $workouts,
        'body_stats' => export_rows($db,
            "SELECT date, weight, body_fat_percentage, muscle_mass_percentage, chest_size, arm_size, waist_size, leg_size,
                    health_fields AS from_health, created_at
             FROM gym_user_stats WHERE user_id = ? ORDER BY date", array($user_id)),
        'exercise_progress' => export_rows($db,
            "SELECT e.name AS exercise, p.weight, p.date FROM gym_progress p
             JOIN gym_exercises e ON e.id = p.exercise_id WHERE p.user_id = ? ORDER BY p.date", array($user_id)),
        'gamification' => array(
            'profile' => export_rows($db,
                "SELECT current_streak_weeks, longest_streak_weeks, last_completed_week, total_xp, level, lifetime_volume_kg
                 FROM gym_user_gamification WHERE user_id = ?", array($user_id)),
            'exercises' => export_rows($db,
                "SELECT e.name AS exercise, g.xp, g.level FROM gym_exercise_gamification g
                 JOIN gym_exercises e ON e.id = g.exercise_id WHERE g.user_id = ?", array($user_id)),
            'achievements' => export_rows($db,
                "SELECT achievement_key, unlocked_at FROM gym_achievements WHERE user_id = ? ORDER BY unlocked_at", array($user_id)),
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
    );

    api_json_response($export);
} catch (Exception $e) {
    error_log('Export error: ' . $e->getMessage());
    api_json_response(array('success' => false, 'message' => 'Errore durante l\'esportazione'), 500);
}
