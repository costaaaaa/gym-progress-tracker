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
    // ── Streak: la settimana dell'allenamento si chiude se raggiunge l'obiettivo, anche se è passata
    // (salvataggio ripreso in ritardo): lo streak si ricava dal registro e si riattacca se riempie un buco
    $gam_row = lock_gamification_row($db, $user_id);
    $before = ensure_streak_registry($db, $user_id, $gam_row, $workout_id);
    $week_completed_now = close_week_if_reached($db, $user_id, new DateTime($data_workout)) > 0;
    $streak = recompute_streak($db, $user_id);
    $current_streak_val = effectiveStreakWeeks($streak['current'], $streak['last_completed_week'], new DateTime());
    $new_longest = $streak['longest'] > $before['longest'];
    $streak_milestone = $week_completed_now && ($current_streak_val === 1 || $current_streak_val % 4 === 0);

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
    $xp_general_registered = $xp_gained_general; // il bonus streak lo segue gym_streak_weeks, non l'allenamento
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

    $earned_keys = achievementsForTotals([
        'sessions'        => $total_sessions_cnt,
        'lifetime_volume' => $new_lifetime_vol,
        'max_weight_ever' => $max_weight_ever,
        'longest_streak'  => $streak['longest'],
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
// Se l'allenamento teneva chiusa una settimana dello streak, la riapre (−30 XP, streak ricalcolato).
// Ritorna ['xp_removed' => int, 'achievements_removed' => [chiavi], 'streak_before' => int, 'streak_after' => int].
function undo_workout_gamification(PDO $db, int $user_id, int $workout_id): array {
    $gam_row = lock_gamification_row($db, $user_id);
    $now = new DateTime();

    // Già cancellato da una richiesta contemporanea: non c'è più nulla da togliere
    $stmt_date = $db->prepare("SELECT date FROM gym_workout_history WHERE id = ? AND user_id = ? FOR UPDATE");
    $stmt_date->execute([$workout_id, $user_id]);
    $workout_date = $stmt_date->fetchColumn();
    if ($workout_date === false) {
        $streak = effectiveStreakWeeks((int) $gam_row['current_streak_weeks'], $gam_row['last_completed_week'], $now);
        return ['xp_removed' => 0, 'achievements_removed' => [], 'streak_before' => $streak, 'streak_after' => $streak];
    }

    $before = ensure_streak_registry($db, $user_id, $gam_row);
    $streak_before = effectiveStreakWeeks($before['current'], $before['last_completed_week'], $now);

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

    // Streak: la settimana dell'allenamento si riapre se senza di lui scende sotto l'obiettivo
    $streak_xp = reopen_week_if_below($db, $user_id, new DateTime($workout_date), $workout_id);
    $streak = recompute_streak($db, $user_id);
    $new_total_xp += add_general_xp($db, $user_id, $streak_xp);

    // Achievement: ricalcolati sui totali rimasti
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
        'longest_streak'  => $streak['longest'],
    ]);
    $stmt_existing = $db->prepare("SELECT achievement_key FROM gym_achievements WHERE user_id = ?");
    $stmt_existing->execute([$user_id]);
    $achievements_removed = [];
    $stmt_del_ach = $db->prepare("DELETE FROM gym_achievements WHERE user_id = ? AND achievement_key = ?");
    foreach ($stmt_existing->fetchAll(PDO::FETCH_COLUMN) as $key) {
        if (in_array($key, $still_earned, true)) continue;
        $stmt_del_ach->execute([$user_id, $key]);
        $achievements_removed[] = $key;
    }

    return [
        'xp_removed'           => $old_total_xp - $new_total_xp,
        'achievements_removed' => $achievements_removed,
        'streak_before'        => $streak_before,
        'streak_after'         => effectiveStreakWeeks($streak['current'], $streak['last_completed_week'], $now),
    ];
}

// ── Streak: registro delle settimane chiuse (gym_streak_weeks) ─────────────────
// Tutte le funzioni qui sotto vanno chiamate in transazione, con la riga di gym_user_gamification
// già presa FOR UPDATE.

// Riga di gym_user_gamification dell'utente, creata se manca, bloccata fino alla fine della transazione
function lock_gamification_row(PDO $db, int $user_id): array {
    // ON DUPLICATE KEY prende subito il lock esclusivo; INSERT IGNORE prenderebbe quello condiviso e due
    // richieste insieme andrebbero in deadlock al FOR UPDATE
    $db->prepare(
        "INSERT INTO gym_user_gamification (user_id, current_streak_weeks, longest_streak_weeks, last_completed_week, updated_at)
         VALUES (?, 0, 0, NULL, NOW())
         ON DUPLICATE KEY UPDATE user_id = user_id"
    )->execute([$user_id]);
    $stmt = $db->prepare("SELECT * FROM gym_user_gamification WHERE user_id = ? FOR UPDATE");
    $stmt->execute([$user_id]);
    return $stmt->fetch(PDO::FETCH_ASSOC);
}

// Al primo uso dopo il rilascio (streak_floor_weeks NULL) ricostruisce il registro dalla copia
// in gym_user_gamification: la serie in corso per intero, più le settimane degli ultimi 30
// giorni che raggiungono l'obiettivo attuale. Lo streak massimo salvato resta come minimo solo
// se viene da una serie vecchia. Non cambia XP né achievement. $exclude_id: l'allenamento appena
// salvato, che non deve entrare nella ricostruzione (la sua settimana la chiude poi il salvataggio).
// Ritorna lo streak prima dell'azione (come recompute_streak), già comprensivo della ricostruzione.
function ensure_streak_registry(PDO $db, int $user_id, array $gam_row, int $exclude_id = 0): array {
    if ($gam_row['streak_floor_weeks'] !== null) {
        return [
            'current'             => (int) $gam_row['current_streak_weeks'],
            'longest'             => (int) $gam_row['longest_streak_weeks'],
            'last_completed_week' => $gam_row['last_completed_week'],
        ];
    }

    $now = new DateTime();
    $goal = weekly_goals($db, [$user_id])[$user_id];
    $ins = $db->prepare("INSERT IGNORE INTO gym_streak_weeks (user_id, yearweek, goal) VALUES (?, ?, ?)");

    $current = effectiveStreakWeeks((int) $gam_row['current_streak_weeks'], $gam_row['last_completed_week'], $now);
    if ($current > 0) {
        $week = yearweekMonday((int) $gam_row['last_completed_week']);
        for ($i = 0; $i < $current; $i++) {
            $count = weekly_workout_counts($db, [$user_id], $week, $exclude_id)[$user_id];
            $ins->execute([$user_id, (int) $week->format('oW'), min($goal, $count)]);
            $week->modify('-7 days');
        }
    }

    $this_week = (int) $now->format('oW');
    for ($day = (clone $now)->modify('-30 days'); (int) $day->format('oW') <= $this_week; $day->modify('+7 days')) {
        if (weekly_workout_counts($db, [$user_id], $day, $exclude_id)[$user_id] >= $goal) {
            $ins->execute([$user_id, (int) $day->format('oW'), $goal]);
        }
    }

    $longest = (int) $gam_row['longest_streak_weeks'];
    $db->prepare("UPDATE gym_user_gamification SET streak_floor_weeks = ? WHERE user_id = ?")
        ->execute([$longest > $current ? $longest : 0, $user_id]);
    return recompute_streak($db, $user_id);
}

// Chiude la settimana di $dt se raggiunge l'obiettivo attuale e non è già nel registro.
// Ritorna gli XP da dare (XP_STREAK_WEEK o 0).
function close_week_if_reached(PDO $db, int $user_id, DateTime $dt): int {
    $goal = weekly_goals($db, [$user_id])[$user_id];
    if (weekly_workout_counts($db, [$user_id], $dt)[$user_id] < $goal) return 0;
    $ins = $db->prepare("INSERT IGNORE INTO gym_streak_weeks (user_id, yearweek, goal) VALUES (?, ?, ?)");
    $ins->execute([$user_id, (int) $dt->format('oW'), $goal]);
    return $ins->rowCount() > 0 ? XP_STREAK_WEEK : 0;
}

// Riapre la settimana di $dt se è nel registro e gli allenamenti rimasti (senza $exclude_id) sono
// sotto il minore fra l'obiettivo alla chiusura e quello attuale. Ritorna gli XP da togliere (negativi).
function reopen_week_if_below(PDO $db, int $user_id, DateTime $dt, int $exclude_id = 0): int {
    $yw = (int) $dt->format('oW');
    $stmt = $db->prepare("SELECT goal FROM gym_streak_weeks WHERE user_id = ? AND yearweek = ?");
    $stmt->execute([$user_id, $yw]);
    $goal_at_close = $stmt->fetchColumn();
    if ($goal_at_close === false) return 0;
    $needed = min((int) $goal_at_close, weekly_goals($db, [$user_id])[$user_id]);
    if (weekly_workout_counts($db, [$user_id], $dt, $exclude_id)[$user_id] >= $needed) return 0;
    $db->prepare("DELETE FROM gym_streak_weeks WHERE user_id = ? AND yearweek = ?")->execute([$user_id, $yw]);
    return -XP_STREAK_WEEK;
}

// Ricava streak corrente e massimo dal registro e li copia in gym_user_gamification.
// Ritorna ['current', 'longest', 'last_completed_week'].
function recompute_streak(PDO $db, int $user_id): array {
    $stmt = $db->prepare("SELECT yearweek FROM gym_streak_weeks WHERE user_id = ? ORDER BY yearweek");
    $stmt->execute([$user_id]);
    $weeks = array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));
    [$current, $longest_run] = streakRuns($weeks);
    $last = empty($weeks) ? null : end($weeks);

    $stmt = $db->prepare("SELECT COALESCE(streak_floor_weeks, 0) FROM gym_user_gamification WHERE user_id = ?");
    $stmt->execute([$user_id]);
    $longest = max((int) $stmt->fetchColumn(), $longest_run);

    $db->prepare(
        "UPDATE gym_user_gamification SET current_streak_weeks = ?, longest_streak_weeks = ?, last_completed_week = ?, updated_at = NOW() WHERE user_id = ?"
    )->execute([$current, $longest, $last, $user_id]);
    return ['current' => $current, 'longest' => $longest, 'last_completed_week' => $last];
}

// Aggiunge (o toglie) XP generali e ricalcola il livello; mai sotto 0. Ritorna la variazione applicata.
function add_general_xp(PDO $db, int $user_id, int $delta): int {
    if ($delta === 0) return 0;
    $stmt = $db->prepare("SELECT total_xp FROM gym_user_gamification WHERE user_id = ?");
    $stmt->execute([$user_id]);
    $old = (int) $stmt->fetchColumn();
    $new = max(0, $old + $delta);
    $db->prepare("UPDATE gym_user_gamification SET total_xp = ?, level = ?, updated_at = NOW() WHERE user_id = ?")
        ->execute([$new, levelForXp($new), $user_id]);
    return $new - $old;
}

// Allinea gli achievement di streak allo streak massimo: aggiunge quelli raggiunti, toglie quelli persi.
// Ritorna ['unlocked' => [chiavi], 'removed' => [chiavi]].
function sync_streak_achievements(PDO $db, int $user_id, int $longest): array {
    $earned = achievementsForTotals(['longest_streak' => $longest]);
    $stmt = $db->prepare("SELECT achievement_key FROM gym_achievements WHERE user_id = ? AND achievement_key LIKE 'streak\\_%'");
    $stmt->execute([$user_id]);
    $existing = $stmt->fetchAll(PDO::FETCH_COLUMN);

    $unlocked = array_values(array_diff($earned, $existing));
    $removed = array_values(array_diff($existing, $earned));
    $ins = $db->prepare("INSERT IGNORE INTO gym_achievements (user_id, achievement_key) VALUES (?, ?)");
    foreach ($unlocked as $key) $ins->execute([$user_id, $key]);
    $del = $db->prepare("DELETE FROM gym_achievements WHERE user_id = ? AND achievement_key = ?");
    foreach ($removed as $key) $del->execute([$user_id, $key]);
    return ['unlocked' => $unlocked, 'removed' => $removed];
}
