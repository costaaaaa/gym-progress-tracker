<?php
// Query settimanali condivise da streak.php, record_workout.php e dalle classifiche dei gruppi.
require_once __DIR__ . '/gamification_rules.php';

// Obiettivo di default per ogni utente: giorni della scheda attiva, 3 senza scheda → [user_id => goal]
function default_weekly_goals(PDO $db, array $user_ids): array {
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

// Obiettivo scelto dall'utente per la settimana $yearweek (formato 'oW'): vale il cambio con
// from_yearweek più alto fra quelli ≤ alla settimana. Solo chi ha scelto un numero compare → [user_id => goal]
function chosen_weekly_goals(PDO $db, array $user_ids, int $yearweek): array {
    if (empty($user_ids)) return [];
    $placeholders = implode(',', array_fill(0, count($user_ids), '?'));
    $stmt = $db->prepare(
        "SELECT c.user_id, c.goal
         FROM gym_weekly_goal_changes c
         JOIN (SELECT user_id, MAX(from_yearweek) AS fy FROM gym_weekly_goal_changes
               WHERE user_id IN ($placeholders) AND from_yearweek <= ? GROUP BY user_id) m
           ON m.user_id = c.user_id AND m.fy = c.from_yearweek
         WHERE c.goal IS NOT NULL"
    );
    $stmt->execute(array_merge(array_values(array_map('intval', $user_ids)), [$yearweek]));
    $chosen = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) $chosen[(int) $row['user_id']] = (int) $row['goal'];
    return $chosen;
}

// Obiettivo settimanale attuale per ogni utente: quello scelto, altrimenti il default → [user_id => goal]
function weekly_goals(PDO $db, array $user_ids): array {
    $goals = default_weekly_goals($db, $user_ids);
    foreach (chosen_weekly_goals($db, $user_ids, (int) (new DateTime())->format('oW')) as $id => $goal) {
        $goals[$id] = $goal;
    }
    return $goals;
}

// Impostazioni dell'obiettivo per l'utente: weekly_goal = scelto e in vigore (null = default),
// weekly_goal_default = quello che vale senza scelta, weekly_goal_without_plan = quello che
// varrebbe senza scheda attiva, weekly_goal_pending = cambio dal lunedì
// prossimo ({goal (null = default), from}) o null
function weekly_goal_settings(PDO $db, int $user_id): array {
    $this_week = (int) (new DateTime())->format('oW');
    $stmt = $db->prepare(
        "SELECT from_yearweek, goal FROM gym_weekly_goal_changes WHERE user_id = ? AND from_yearweek > ? ORDER BY from_yearweek LIMIT 1"
    );
    $stmt->execute([$user_id, $this_week]);
    $next = $stmt->fetch(PDO::FETCH_ASSOC);
    return [
        'weekly_goal'              => chosen_weekly_goals($db, [$user_id], $this_week)[$user_id] ?? null,
        'weekly_goal_default'      => default_weekly_goals($db, [$user_id])[$user_id],
        'weekly_goal_without_plan' => WEEKLY_GOAL_DEFAULT,
        'weekly_goal_pending'      => $next ? [
            'goal' => $next['goal'] === null ? null : (int) $next['goal'],
            'from' => yearweekMonday((int) $next['from_yearweek'])->format('Y-m-d'),
        ] : null,
    ];
}

// Allenamenti nella settimana ISO di $dt per ogni utente: [user_id => count]. $exclude_id: un
// allenamento da non contare (quello che si sta cancellando).
function weekly_workout_counts(PDO $db, array $user_ids, DateTime $dt, int $exclude_id = 0): array {
    $counts = [];
    foreach ($user_ids as $id) $counts[(int) $id] = 0;
    if (empty($user_ids)) return $counts;

    [$monday, $sunday] = isoWeekBounds($dt);
    $placeholders = implode(',', array_fill(0, count($user_ids), '?'));
    $stmt = $db->prepare(
        "SELECT user_id, COUNT(*) AS cnt FROM gym_workout_history
         WHERE user_id IN ($placeholders) AND date >= ? AND date <= ? AND id != ?
         GROUP BY user_id"
    );
    $stmt->execute(array_merge(
        array_values(array_map('intval', $user_ids)),
        [$monday->format('Y-m-d H:i:s'), $sunday->format('Y-m-d H:i:s'), $exclude_id]
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
