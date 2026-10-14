<?php
// Streak, XP, livelli per esercizio e achievement di un allenamento appena salvato.
// La chiamante (record_workout.php) la esegue dentro la transazione del salvataggio.
require_once __DIR__ . '/weekly_stats.php';

// $workout_records: le serie come arrivano dal client (oggetti con exercise_id, day_id, weight, reps).
// Ritorna i campi di gamification della risposta di record_workout.php, nello stesso ordine.
function apply_workout_gamification(PDO $db, int $user_id, int $workout_id, string $data_workout, ?int $duration_seconds, array $workout_records): array {
    // ── Streak logic ──────────────────────────────────────────────────────
    $workout_dt = new DateTime($data_workout);
    $current_week = intval($workout_dt->format('oW')); // ISO YEARWEEK equivalent to YEARWEEK(date, 3)

    // Workouts this ISO week (Mon–Sun) — includes the workout just inserted
    $weekly_count = weekly_workout_counts($db, [$user_id], $workout_dt)[$user_id];

    // Goal = days in active plan, fallback 3
    $goal = weekly_goals($db, [$user_id])[$user_id];

    // Ensure gamification row exists
    $db->prepare(
        "INSERT IGNORE INTO gym_user_gamification (user_id, current_streak_weeks, longest_streak_weeks, last_completed_week, updated_at)
         VALUES (?, 0, 0, NULL, NOW())"
    )->execute([$user_id]);

    $stmt_row = $db->prepare("SELECT * FROM gym_user_gamification WHERE user_id = ? FOR UPDATE");
    $stmt_row->execute([$user_id]);
    $gam_row = $stmt_row->fetch(PDO::FETCH_ASSOC);

    $week_completed_now = false;
    $new_longest = false;
    $streak_milestone = false;
    $current_streak_val = intval($gam_row['current_streak_weeks']);

    if ($weekly_count >= $goal) {
        $last_cw = $gam_row['last_completed_week'];

        if ($last_cw !== null && intval($last_cw) >= $current_week) {
            // Settimana già contata, o sessione recuperata di una settimana precedente:
            // lo streak non arretra mai
        } else {
            $week_completed_now = true;
            $is_consecutive = ($last_cw !== null) &&
                nextWeekYearweek(intval($last_cw)) === $current_week;

            $new_streak = $is_consecutive ? intval($gam_row['current_streak_weeks']) + 1 : 1;
            $new_longest_val = max($new_streak, intval($gam_row['longest_streak_weeks']));
            $new_longest = $new_longest_val > intval($gam_row['longest_streak_weeks']);
            $streak_milestone = ($new_streak === 1) || ($new_streak % 4 === 0);
            $current_streak_val = $new_streak;

            $db->prepare(
                "UPDATE gym_user_gamification
                 SET current_streak_weeks = ?, longest_streak_weeks = ?, last_completed_week = ?, updated_at = NOW()
                 WHERE user_id = ?"
            )->execute([$new_streak, $new_longest_val, $current_week, $user_id]);
        }
    }
    // ── End streak logic ──────────────────────────────────────────────────

    // ── Gamification: XP + livelli + achievement ──────────────────────────

    // Raggruppa set validi per esercizio (peso > 0 e reps > 0)
    $current_ex_sets = [];
    foreach ($workout_records as $rec) {
        if (!isset($rec->exercise_id) || empty($rec->exercise_id)) continue;
        $eid = (int) $rec->exercise_id;
        $w   = (float) ($rec->weight ?? 0);
        $r   = parseReps($rec->reps ?? '0');
        // Il peso può essere 0 (corpo libero, macchinari): conta la serie se ha ripetizioni
        if ($r <= 0) continue;
        if (!isset($current_ex_sets[$eid])) $current_ex_sets[$eid] = [];
        $current_ex_sets[$eid][] = ['weight' => $w, 'reps' => $r];
    }

    // Best pregressi per gli esercizi allenati, escluso il workout appena inserito
    $prev_bests = [];
    if (!empty($current_ex_sets)) {
        $eids_list    = array_keys($current_ex_sets);
        $placeholders = implode(',', array_fill(0, count($eids_list), '?'));
        $stmt_prev    = $db->prepare(
            "SELECT ws.exercise_id, ws.weight, ws.reps
             FROM gym_workout_sets ws
             JOIN gym_workout_history wh ON ws.workout_history_id = wh.id
             WHERE wh.user_id = ?
               AND ws.exercise_id IN ($placeholders)
               AND ws.workout_history_id != ?
               AND (wh.date < ? OR (wh.date = ? AND wh.id < ?))"
        );
        $stmt_prev->execute(array_merge([$user_id], $eids_list, [$workout_id, $data_workout, $data_workout, $workout_id]));
        while ($prow = $stmt_prev->fetch(PDO::FETCH_ASSOC)) {
            $eid  = (int)   $prow['exercise_id'];
            $pw   = (float) $prow['weight'];
            $pr   = parseReps($prow['reps']);
            $p1rm = estimateOneRepMax($pw, $pr);
            if (!isset($prev_bests[$eid])) $prev_bests[$eid] = ['best_weight' => 0.0, 'best_1rm' => 0.0, 'best_bw_reps' => 0];
            if ($pw   > $prev_bests[$eid]['best_weight']) $prev_bests[$eid]['best_weight'] = $pw;
            if ($p1rm > $prev_bests[$eid]['best_1rm'])   $prev_bests[$eid]['best_1rm']   = $p1rm;
            if ($pw == 0.0 && $pr > $prev_bests[$eid]['best_bw_reps']) $prev_bests[$eid]['best_bw_reps'] = $pr;
        }
    }

    // XP di sessione: solo se la sessione rispetta le regole (scheda, completamento, durata,
    // distanza dall'ultima sessione con XP). Il salvataggio dell'allenamento non cambia.
    $day_id = 0;
    $done_sets = 0;
    foreach ($workout_records as $rec) {
        if (!isset($rec->exercise_id) || empty($rec->exercise_id)) continue;
        if ($day_id === 0 && isset($rec->day_id) && is_numeric($rec->day_id)) $day_id = (int) $rec->day_id;
        if (parseReps($rec->reps ?? '0') > 0) $done_sets++;
    }
    $planned_sets = null;
    if ($day_id > 0) {
        $stmt_plan = $db->prepare(
            "SELECT COALESCE(SUM(CAST(we.sets AS UNSIGNED)), 0)
             FROM gym_workout_exercises we
             JOIN gym_workout_days d ON d.id = we.day_id
             JOIN gym_workout_plans p ON p.id = d.plan_id
             WHERE we.day_id = ? AND p.user_id = ?"
        );
        $stmt_plan->execute([$day_id, $user_id]);
        $planned_sets = (int) $stmt_plan->fetchColumn();
    }
    $seconds_since_last_xp = null;
    if (!empty($gam_row['last_xp_session_at'])) {
        $seconds_since_last_xp = abs((new DateTime($data_workout))->getTimestamp() - (new DateTime($gam_row['last_xp_session_at']))->getTimestamp());
    }
    $xp_status  = sessionXpStatus($planned_sets, $done_sets, $duration_seconds, $seconds_since_last_xp);
    $xp_session = $xp_status === 'ok';

    // Calcola XP guadagnati e volume sessione
    $xp_gained_general  = $xp_session ? XP_SESSION : 0;
    $pr_in_session      = false;
    $session_volume_kg  = 0.0;
    $exercise_xp_deltas = [];

    foreach ($current_ex_sets as $eid => $sets) {
        $ex_best_weight = 0.0;
        $ex_best_1rm    = 0.0;
        $ex_best_bw_reps = 0;
        foreach ($sets as $s) {
            $session_volume_kg += $s['weight'] * $s['reps'];
            if ($s['weight'] > $ex_best_weight) $ex_best_weight = $s['weight'];
            $orm = estimateOneRepMax($s['weight'], $s['reps']);
            if ($orm > $ex_best_1rm) $ex_best_1rm = $orm;
            if ($s['weight'] == 0.0 && $s['reps'] > $ex_best_bw_reps) $ex_best_bw_reps = $s['reps'];
        }

        $prev = $prev_bests[$eid] ?? null;
        // PR solo se c'è storico precedente (coerente con detectPersonalRecords in JS)
        $is_weight_pr = $prev !== null && $ex_best_weight > $prev['best_weight'];
        $is_1rm_pr    = $prev !== null && $ex_best_1rm   > $prev['best_1rm'];
        // A peso 0 (corpo libero) il progresso sono le ripetizioni
        $is_reps_pr   = $prev !== null && $ex_best_bw_reps > $prev['best_bw_reps'];

        $ex_xp = $xp_session ? XP_EXERCISE_SESSION : 0;
        if ($is_weight_pr || $is_1rm_pr || $is_reps_pr) {
            $pr_in_session = true;
            $ex_xp += XP_EXERCISE_PR;
        }
        if ($ex_xp > 0) $exercise_xp_deltas[$eid] = $ex_xp;
    }

    // PR generale: una volta sola per sessione, comunque siano i PR
    if ($pr_in_session) $xp_gained_general += XP_PR;
    if ($week_completed_now) $xp_gained_general += XP_STREAK_WEEK;

    // Aggiorna totali utente
    $old_total_xp     = (int)   ($gam_row['total_xp']          ?? 0);
    $old_level_gam    = (int)   ($gam_row['level']              ?? 1);
    $old_volume       = (float) ($gam_row['lifetime_volume_kg'] ?? 0);
    $new_total_xp     = $old_total_xp + $xp_gained_general;
    $new_level_gam    = levelForXp($new_total_xp);
    $new_lifetime_vol = $old_volume + $session_volume_kg;
    $leveled_up       = $new_level_gam > $old_level_gam;

    $db->prepare(
        "UPDATE gym_user_gamification
         SET total_xp = ?, level = ?, lifetime_volume_kg = ?,
             last_xp_session_at = COALESCE(?, last_xp_session_at), updated_at = NOW()
         WHERE user_id = ?"
    )->execute([
        $new_total_xp, $new_level_gam, $new_lifetime_vol,
        $xp_session ? max($data_workout, (string) ($gam_row['last_xp_session_at'] ?? '')) : null, $user_id,
    ]);

    // Upsert per-esercizio e rileva level-up
    $exercise_levelups = [];
    $stmt_ex_sel = $db->prepare(
        "SELECT xp, level FROM gym_exercise_gamification WHERE user_id = ? AND exercise_id = ? FOR UPDATE"
    );
    $stmt_ex_ups = $db->prepare(
        "INSERT INTO gym_exercise_gamification (user_id, exercise_id, xp, level)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE xp = ?, level = ?"
    );
    foreach ($exercise_xp_deltas as $eid => $xp_delta) {
        $stmt_ex_sel->execute([$user_id, $eid]);
        $ex_row    = $stmt_ex_sel->fetch(PDO::FETCH_ASSOC);
        $old_ex_xp = (int) ($ex_row['xp']    ?? 0);
        $old_ex_lv = (int) ($ex_row['level']  ?? 1);
        $new_ex_xp = $old_ex_xp + $xp_delta;
        $new_ex_lv = levelForXp($new_ex_xp, LEVEL_UNIT_EXERCISE);
        if ($new_ex_lv > $old_ex_lv) $exercise_levelups[] = $eid;
        $stmt_ex_ups->execute([$user_id, $eid, $new_ex_xp, $new_ex_lv, $new_ex_xp, $new_ex_lv]);
    }

    // Achievement
    $stmt_scnt = $db->prepare("SELECT COUNT(*) FROM gym_workout_history WHERE user_id = ?");
    $stmt_scnt->execute([$user_id]);
    $total_sessions_cnt = (int) $stmt_scnt->fetchColumn();

    $stmt_mxw = $db->prepare(
        "SELECT COALESCE(MAX(ws.weight), 0)
         FROM gym_workout_sets ws
         JOIN gym_workout_history wh ON ws.workout_history_id = wh.id
         WHERE wh.user_id = ?"
    );
    $stmt_mxw->execute([$user_id]);
    $max_weight_ever = (float) $stmt_mxw->fetchColumn();

    $current_longest = $week_completed_now
        ? max($current_streak_val, intval($gam_row['longest_streak_weeks']))
        : intval($gam_row['longest_streak_weeks']);

    $earned_keys = achievementsForTotals([
        'sessions'        => $total_sessions_cnt,
        'lifetime_volume' => $new_lifetime_vol,
        'max_weight_ever' => $max_weight_ever,
        'longest_streak'  => $current_longest,
    ]);

    $stmt_existing_ach = $db->prepare(
        "SELECT achievement_key FROM gym_achievements WHERE user_id = ?"
    );
    $stmt_existing_ach->execute([$user_id]);
    $existing_keys = $stmt_existing_ach->fetchAll(PDO::FETCH_COLUMN);

    $unlocked_achievements = [];
    $stmt_ins_ach = $db->prepare(
        "INSERT IGNORE INTO gym_achievements (user_id, achievement_key) VALUES (?, ?)"
    );
    foreach ($earned_keys as $key) {
        if (!in_array($key, $existing_keys, true)) {
            $stmt_ins_ach->execute([$user_id, $key]);
            $unlocked_achievements[] = ['key' => $key, 'label' => achievementLabel($key)];
        }
    }
    // ── End gamification ─────────────────────────────────────────────────

    return [
        'session_volume_kg'     => round($session_volume_kg, 2),
        'total_sessions'        => $total_sessions_cnt,
        'current_streak_weeks'  => $current_streak_val,
        'week_completed_now'    => $week_completed_now,
        'new_longest'           => $new_longest,
        'streak_milestone'      => $streak_milestone,
        'xp_gained'             => $xp_gained_general,
        'xp_session_awarded'    => $xp_session,
        'xp_session_reason'     => $xp_status,
        'completion_pct'        => $planned_sets > 0 ? (int) round(100 * sessionCompletion($done_sets, $planned_sets)) : null,
        'total_xp'              => $new_total_xp,
        'level'                 => $new_level_gam,
        'leveled_up'            => $leveled_up,
        'new_level'             => $leveled_up ? $new_level_gam : null,
        'exercise_levelups'     => $exercise_levelups,
        'unlocked_achievements' => $unlocked_achievements,
    ];
}
