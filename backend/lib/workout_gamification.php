<?php
// Streak, XP, livelli per esercizio e achievement di un allenamento appena salvato.
// La chiamante (record_workout.php) la esegue dentro la transazione del salvataggio.
require_once __DIR__ . '/weekly_stats.php';

// I record di un esercizio danno XP al massimo una volta al giorno (giorno dell'allenamento al salvataggio)
function exercise_pr_paid_on_day(PDO $db, int $user_id, int $exercise_id, string $day): bool {
    $stmt = $db->prepare(
        "SELECT 1 FROM gym_workout_exercise_rewards WHERE user_id = ? AND exercise_id = ? AND day = ? AND is_pr = 1 LIMIT 1"
    );
    $stmt->execute([$user_id, $exercise_id, $day]);
    return (bool) $stmt->fetchColumn();
}

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

    $workout_day = substr($data_workout, 0, 10);

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
        $ex_is_pr = false;
        if (($is_weight_pr || $is_1rm_pr || $is_reps_pr) && !exercise_pr_paid_on_day($db, $user_id, $eid, $workout_day)) {
            $pr_in_session = true;
            $ex_is_pr = true;
            $ex_xp += XP_EXERCISE_PR;
        }
        if ($ex_xp > 0) $exercise_xp_deltas[$eid] = ['xp' => $ex_xp, 'is_pr' => $ex_is_pr];
    }

    // PR generale: una volta sola per sessione, comunque siano i PR
    if ($pr_in_session) $xp_gained_general += XP_PR;
    $xp_general_registered = $xp_gained_general; // lo streak non si annulla: non entra nel registro
    if ($week_completed_now) $xp_gained_general += XP_STREAK_WEEK;

    $db->prepare(
        "INSERT INTO gym_workout_rewards (workout_id, user_id, xp_general, xp_session) VALUES (?, ?, ?, ?)"
    )->execute([$workout_id, $user_id, $xp_general_registered, $xp_session ? 1 : 0]);

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
    $stmt_ex_reward = $db->prepare(
        "INSERT INTO gym_workout_exercise_rewards (workout_id, exercise_id, user_id, xp, is_pr, day)
         VALUES (?, ?, ?, ?, ?, ?)"
    );
    foreach ($exercise_xp_deltas as $eid => $reward) {
        $xp_delta = $reward['xp'];
        $stmt_ex_reward->execute([$workout_id, $eid, $user_id, $xp_delta, $reward['is_pr'] ? 1 : 0, $workout_day]);
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

// Toglie a utente ed esercizi quello che l'allenamento aveva dato. La chiamante la esegue in transazione,
// prima del DELETE (il registro cade a cascata con l'allenamento).
// Ritorna ['xp_removed' => int, 'achievements_removed' => [chiavi]].
function undo_workout_gamification(PDO $db, int $user_id, int $workout_id): array {
    $db->prepare(
        "INSERT IGNORE INTO gym_user_gamification (user_id, current_streak_weeks, longest_streak_weeks, last_completed_week, updated_at)
         VALUES (?, 0, 0, NULL, NOW())"
    )->execute([$user_id]);
    $stmt_row = $db->prepare("SELECT * FROM gym_user_gamification WHERE user_id = ? FOR UPDATE");
    $stmt_row->execute([$user_id]);
    $gam_row = $stmt_row->fetch(PDO::FETCH_ASSOC);

    $stmt_reward = $db->prepare("SELECT xp_general, xp_session FROM gym_workout_rewards WHERE workout_id = ? AND user_id = ?");
    $stmt_reward->execute([$workout_id, $user_id]);
    $reward = $stmt_reward->fetch(PDO::FETCH_ASSOC) ?: ['xp_general' => 0, 'xp_session' => 0];
    $xp_general = (int) $reward['xp_general'];

    // Se dava XP di sessione, il cooldown riparte dalla sessione con XP più recente fra quelle rimaste
    $last_xp_session_at = $gam_row['last_xp_session_at'];
    if ((int) $reward['xp_session'] === 1) {
        $stmt_last = $db->prepare(
            "SELECT MAX(wh.date)
             FROM gym_workout_rewards r
             JOIN gym_workout_history wh ON wh.id = r.workout_id
             WHERE r.user_id = ? AND r.xp_session = 1 AND r.workout_id != ?"
        );
        $stmt_last->execute([$user_id, $workout_id]);
        $last_xp_session_at = $stmt_last->fetchColumn() ?: null;
    }

    $old_total_xp = (int) $gam_row['total_xp'];
    $new_total_xp = max(0, $old_total_xp - $xp_general);
    // Volume: ricavato dalle serie, quindi vale anche per gli allenamenti senza registro
    $stmt_sets = $db->prepare("SELECT weight, reps FROM gym_workout_sets WHERE workout_history_id = ?");
    $stmt_sets->execute([$workout_id]);
    $workout_volume = 0.0;
    foreach ($stmt_sets->fetchAll(PDO::FETCH_ASSOC) as $set) {
        $reps = parseReps($set['reps']);
        if ($reps > 0) $workout_volume += (float) $set['weight'] * $reps;
    }
    $new_volume = max(0.0, (float) $gam_row['lifetime_volume_kg'] - $workout_volume);

    $db->prepare("UPDATE gym_user_gamification SET total_xp = ?, level = ?, lifetime_volume_kg = ?, last_xp_session_at = ?, updated_at = NOW() WHERE user_id = ?")
        ->execute([$new_total_xp, levelForXp($new_total_xp), $new_volume, $last_xp_session_at, $user_id]);

    $stmt_ex_rewards = $db->prepare("SELECT exercise_id, xp FROM gym_workout_exercise_rewards WHERE workout_id = ? AND user_id = ?");
    $stmt_ex_rewards->execute([$workout_id, $user_id]);
    $stmt_ex_sel = $db->prepare("SELECT xp FROM gym_exercise_gamification WHERE user_id = ? AND exercise_id = ? FOR UPDATE");
    $stmt_ex_upd = $db->prepare("UPDATE gym_exercise_gamification SET xp = ?, level = ? WHERE user_id = ? AND exercise_id = ?");
    foreach ($stmt_ex_rewards->fetchAll(PDO::FETCH_ASSOC) as $reward) {
        $stmt_ex_sel->execute([$user_id, $reward['exercise_id']]);
        $ex_xp = $stmt_ex_sel->fetchColumn();
        if ($ex_xp === false) continue;
        $new_ex_xp = max(0, (int) $ex_xp - (int) $reward['xp']);
        $stmt_ex_upd->execute([$new_ex_xp, levelForXp($new_ex_xp, LEVEL_UNIT_EXERCISE), $user_id, $reward['exercise_id']]);
    }

    // Achievement: ricalcolati sui totali rimasti. Quelli di streak non si toccano.
    $stmt_cnt = $db->prepare("SELECT COUNT(*) FROM gym_workout_history WHERE user_id = ? AND id != ?");
    $stmt_cnt->execute([$user_id, $workout_id]);
    $stmt_max = $db->prepare(
        "SELECT COALESCE(MAX(ws.weight), 0)
         FROM gym_workout_sets ws
         JOIN gym_workout_history wh ON ws.workout_history_id = wh.id
         WHERE wh.user_id = ? AND wh.id != ?"
    );
    $stmt_max->execute([$user_id, $workout_id]);
    $still_earned = achievementsForTotals([
        'sessions'        => (int) $stmt_cnt->fetchColumn(),
        'lifetime_volume' => $new_volume,
        'max_weight_ever' => (float) $stmt_max->fetchColumn(),
    ]);
    $stmt_existing = $db->prepare("SELECT achievement_key FROM gym_achievements WHERE user_id = ?");
    $stmt_existing->execute([$user_id]);
    $achievements_removed = [];
    $stmt_del_ach = $db->prepare("DELETE FROM gym_achievements WHERE user_id = ? AND achievement_key = ?");
    foreach ($stmt_existing->fetchAll(PDO::FETCH_COLUMN) as $key) {
        if (str_starts_with($key, 'streak_') || in_array($key, $still_earned, true)) continue;
        $stmt_del_ach->execute([$user_id, $key]);
        $achievements_removed[] = $key;
    }

    return ['xp_removed' => $old_total_xp - $new_total_xp, 'achievements_removed' => $achievements_removed];
}
