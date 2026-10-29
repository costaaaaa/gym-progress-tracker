<?php
// Streak, XP, livelli per esercizio e achievement di un allenamento appena salvato.
// La chiamante (record_workout.php) la esegue dentro la transazione del salvataggio.
require_once __DIR__ . '/weekly_stats.php';

// $data_workout è l'ora locale del luogo ($time_zone): giorno e settimana si leggono dalla stringa,
// la pausa XP e last_xp_session_at (ora del server) lavorano sull'istante.
// $workout_records: le serie come arrivano dal client (oggetti con exercise_id, day_id, weight, reps).
// Ritorna i campi di gamification della risposta di record_workout.php, nello stesso ordine.
function apply_workout_gamification(PDO $db, int $user_id, int $workout_id, string $data_workout, string $time_zone, ?int $duration_seconds, array $workout_records): array {
    // ── Streak: la settimana dell'allenamento si chiude se raggiunge l'obiettivo, anche se è passata
    // (salvataggio ripreso in ritardo): lo streak si ricava dal registro e si riattacca se riempie un buco
    $gam_row = lock_gamification_row($db, $user_id);
    $before = ensure_streak_registry($db, $user_id, $gam_row, $workout_id);
    $week_completed_now = close_week_if_reached($db, $user_id, new DateTime($data_workout)) > 0;
    $streak = recompute_streak($db, $user_id);
    $current_streak_val = effectiveStreakWeeks($streak['current'], $streak['last_completed_week'], user_now());
    $new_longest = $streak['longest'] > $before['longest'];
    $streak_milestone = $week_completed_now && ($current_streak_val === 1 || $current_streak_val % 4 === 0);

    // ── Gamification: XP + livelli + achievement ──────────────────────────

    // Serie con ripetizioni, per esercizio (il peso può essere 0: corpo libero, macchinari)
    $current_ex_sets = [];
    foreach ($workout_records as $rec) {
        if (!isset($rec->exercise_id) || empty($rec->exercise_id)) continue;
        $r = parseReps($rec->reps ?? '0');
        if ($r <= 0) continue;
        $current_ex_sets[(int) $rec->exercise_id][] = ['weight' => (float) ($rec->weight ?? 0), 'reps' => $r];
    }

    // Migliori valori precedenti degli esercizi allenati, escluso il workout appena inserito
    $prev_bests = [];
    $pr_paid_today = [];
    $workout_day = substr($data_workout, 0, 10);
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
        $prev_sets = [];
        while ($prow = $stmt_prev->fetch(PDO::FETCH_ASSOC)) {
            $prev_sets[(int) $prow['exercise_id']][] = $prow;
        }
        $prev_bests = array_map('setBests', $prev_sets);

        $stmt_paid = $db->prepare(
            "SELECT DISTINCT exercise_id FROM gym_workout_exercise_rewards
             WHERE user_id = ? AND day = ? AND is_pr = 1 AND exercise_id IN ($placeholders)"
        );
        $stmt_paid->execute(array_merge([$user_id, $workout_day], $eids_list));
        $pr_paid_today = array_map('intval', $stmt_paid->fetchAll(PDO::FETCH_COLUMN));
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
    $workout_server_time = workout_instant($data_workout, $time_zone)->setTimezone(new DateTimeZone(date_default_timezone_get()))->format('Y-m-d H:i:s');
    $seconds_since_last_xp = null;
    if (!empty($gam_row['last_xp_session_at'])) {
        $seconds_since_last_xp = abs((new DateTime($workout_server_time))->getTimestamp() - (new DateTime($gam_row['last_xp_session_at']))->getTimestamp());
    }
    $xp_status  = sessionXpStatus($planned_sets, $done_sets, $duration_seconds, $seconds_since_last_xp);
    $xp_session = $xp_status === 'ok';

    $rewards = workoutRewards($current_ex_sets, $prev_bests, $xp_session, $pr_paid_today);
    $session_volume_kg     = $rewards['volume'];
    $exercise_xp_deltas    = $rewards['exercises'];
    $xp_gained_general     = $rewards['xp_general'];
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
        $xp_session ? max($workout_server_time, (string) ($gam_row['last_xp_session_at'] ?? '')) : null, $user_id,
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
    $now = user_now();

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
            "SELECT wh.date, wh.time_zone
             FROM gym_workout_rewards r
             JOIN gym_workout_history wh ON wh.id = r.workout_id
             WHERE r.user_id = ? AND r.xp_session = 1 AND r.workout_id != ?"
        );
        $stmt_last->execute([$user_id, $workout_id]);
        $server_zone = new DateTimeZone(date_default_timezone_get());
        $last_xp_session_at = null;
        while ($row = $stmt_last->fetch(PDO::FETCH_ASSOC)) {
            $at = workout_instant($row['date'], $row['time_zone'])->setTimezone($server_zone)->format('Y-m-d H:i:s');
            if ($last_xp_session_at === null || $at > $last_xp_session_at) $last_xp_session_at = $at;
        }
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

    $now = user_now();
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

// Registra un cambio di obiettivo settimanale ($goal null = default). Vale da goalChangeStartMonday($now);
// un cambio rimandato e poi superato da uno nuovo non resta. La chiamante ha la transazione aperta.
function apply_weekly_goal_change(PDO $db, int $user_id, ?int $goal, DateTime $now): void {
    $gam_row = lock_gamification_row($db, $user_id);
    $from = (int) goalChangeStartMonday($now)->format('oW');
    $immediate = $from === (int) $now->format('oW');
    // Il registro di chi non l'ha ancora va ricostruito con l'obiettivo di prima del cambio
    if ($immediate) ensure_streak_registry($db, $user_id, $gam_row);
    $db->prepare(
        "INSERT INTO gym_weekly_goal_changes (user_id, from_yearweek, goal) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE goal = VALUES(goal)"
    )->execute([$user_id, $from, $goal]);
    $db->prepare("DELETE FROM gym_weekly_goal_changes WHERE user_id = ? AND from_yearweek > ?")->execute([$user_id, $from]);
    if ($goal === null) {
        // Tornare al default quando prima non c'era una scelta non è un cambio
        $stmt = $db->prepare("SELECT goal FROM gym_weekly_goal_changes WHERE user_id = ? AND from_yearweek < ? ORDER BY from_yearweek DESC LIMIT 1");
        $stmt->execute([$user_id, $from]);
        $previous = $stmt->fetchColumn();
        if ($previous === false || $previous === null) {
            $db->prepare("DELETE FROM gym_weekly_goal_changes WHERE user_id = ? AND from_yearweek = ?")->execute([$user_id, $from]);
        }
    }
    // Obiettivo abbassato e già raggiunto: la settimana va chiusa subito, altrimenti resterebbe aperta
    if ($immediate && close_week_if_reached($db, $user_id, $now) > 0) {
        add_general_xp($db, $user_id, XP_STREAK_WEEK);
        $streak = recompute_streak($db, $user_id);
        sync_streak_achievements($db, $user_id, $streak['longest']);
    }
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
