<?php
// Query settimanali condivise da streak.php, record_workout.php e dalle classifiche dei gruppi.
require_once __DIR__ . '/gamification_rules.php';

// Obiettivo settimanale per ogni utente: [user_id => goal]
function weekly_goals(PDO $db, array $user_ids): array {
    $goals = [];
    foreach ($user_ids as $id) $goals[(int) $id] = WEEKLY_GOAL_DEFAULT;
    if (empty($user_ids)) return $goals;

    $placeholders = implode(',', array_fill(0, count($user_ids), '?'));
    $stmt = $db->prepare(
        "SELECT wp.user_id, COUNT(wd.id) AS days_count
         FROM gym_workout_plans wp
         JOIN gym_workout_days wd ON wp.id = wd.plan_id
         WHERE wp.user_id IN ($placeholders) AND wp.is_active = 1
         GROUP BY wp.user_id"
    );
    $stmt->execute(array_values(array_map('intval', $user_ids)));
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $goals[(int) $row['user_id']] = goalFromPlanDays((int) $row['days_count']);
    }
    return $goals;
}

// Allenamenti nella settimana ISO di $dt per ogni utente: [user_id => count]
function weekly_workout_counts(PDO $db, array $user_ids, DateTime $dt): array {
    $counts = [];
    foreach ($user_ids as $id) $counts[(int) $id] = 0;
    if (empty($user_ids)) return $counts;

    [$monday, $sunday] = isoWeekBounds($dt);
    $placeholders = implode(',', array_fill(0, count($user_ids), '?'));
    $stmt = $db->prepare(
        "SELECT user_id, COUNT(*) AS cnt FROM gym_workout_history
         WHERE user_id IN ($placeholders) AND date >= ? AND date <= ?
         GROUP BY user_id"
    );
    $stmt->execute(array_merge(
        array_values(array_map('intval', $user_ids)),
        [$monday->format('Y-m-d H:i:s'), $sunday->format('Y-m-d H:i:s')]
    ));
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $counts[(int) $row['user_id']] = (int) $row['cnt'];
    }
    return $counts;
}

// Volume (kg × ripetizioni) nella settimana ISO di $dt per ogni utente: [user_id => kg].
// Le ripetizioni sono testo ("8-10", "max"): si sommano in PHP con parseReps(), contando
// solo i set con peso e ripetizioni maggiori di zero, come record_workout.php.
function weekly_volumes(PDO $db, array $user_ids, DateTime $dt): array {
    $volumes = [];
    foreach ($user_ids as $id) $volumes[(int) $id] = 0.0;
    if (empty($user_ids)) return $volumes;

    [$monday, $sunday] = isoWeekBounds($dt);
    $placeholders = implode(',', array_fill(0, count($user_ids), '?'));
    $stmt = $db->prepare(
        "SELECT wh.user_id, ws.weight, ws.reps
         FROM gym_workout_sets ws
         JOIN gym_workout_history wh ON ws.workout_history_id = wh.id
         WHERE wh.user_id IN ($placeholders) AND wh.date >= ? AND wh.date <= ?"
    );
    $stmt->execute(array_merge(
        array_values(array_map('intval', $user_ids)),
        [$monday->format('Y-m-d H:i:s'), $sunday->format('Y-m-d H:i:s')]
    ));
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $w = (float) $row['weight'];
        $r = parseReps($row['reps']);
        if ($w > 0 && $r > 0) $volumes[(int) $row['user_id']] += $w * $r;
    }
    return $volumes;
}
