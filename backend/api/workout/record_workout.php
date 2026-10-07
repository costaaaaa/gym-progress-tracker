<?php
include_once '../../config/cors_headers.php';
include_once '../../config/database.php';
include_once '../../config/api_helpers.php';
include_once '../../models/WorkoutHistory.php';
include_once '../../models/WorkoutSet.php';
include_once '../../models/Exercise.php';
require_once '../../lib/weekly_stats.php';

$database = new Database();
$db = $database->getConnection();

$user_id = require_authenticated_user($db);

try {
    $data = json_decode(file_get_contents("php://input"));

    if (!$data || !isset($data->workout_records) || !is_array($data->workout_records) || empty($data->workout_records)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Dati mancanti o non validi']);
        exit;
    }

    // Solo esercizi approvati o creati dall'utente: quelli in attesa degli altri non si usano
    $exercise_ids = array();
    foreach ($data->workout_records as $record) {
        if (isset($record->exercise_id) && !empty($record->exercise_id)) {
            $exercise_ids[(int) $record->exercise_id] = true;
        }
    }
    foreach (array_keys($exercise_ids) as $eid) {
        if (!Exercise::isVisibleTo($db, $eid, $user_id)) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Esercizio non trovato.']);
            exit;
        }
    }

    // Cambiare o aggiungere esercizi rispetto alla scheda durante il Focus Mode è premium
    // (focus_session_edit). Senza, ogni set deve essere di un esercizio presente nel giorno di
    // scheda indicato (day_id), che sia dell'utente. Il controllo sta qui perché quello dei client
    // si aggira: chi forza l'interfaccia vede l'esercizio a schermo ma non lo salva.
    if (!user_has_feature($db, $user_id, 'focus_session_edit')) {
        $pairs = array();
        foreach ($data->workout_records as $record) {
            if (!isset($record->exercise_id) || empty($record->exercise_id)) continue;
            $day = isset($record->day_id) && is_numeric($record->day_id) ? (int) $record->day_id : 0;
            $eid = (int) $record->exercise_id;
            $pairs[$day . ':' . $eid] = array($day, $eid);
        }
        $stmt_in_plan = $db->prepare(
            "SELECT 1
             FROM gym_workout_exercises we
             JOIN gym_workout_days d ON d.id = we.day_id
             JOIN gym_workout_plans p ON p.id = d.plan_id
             WHERE we.day_id = ? AND we.exercise_id = ? AND p.user_id = ?
             LIMIT 1"
        );
        foreach ($pairs as $pair) {
            $stmt_in_plan->execute(array($pair[0], $pair[1], $user_id));
            if (!$stmt_in_plan->fetchColumn()) {
                http_response_code(403);
                echo json_encode([
                    'success' => false,
                    'code'    => 'premium_required',
                    'message' => "Cambiare o aggiungere esercizi durante l'allenamento è una funzione Premium: "
                        . "puoi salvare solo gli esercizi del giorno di scheda.",
                ]);
                exit;
            }
        }
    }

    // Determine workout date: use start_time if gap <= 4h, else now
    $now = new DateTime();
    $data_workout = $now->format('Y-m-d H:i:s');
    $start_gap = null;

    if (!empty($data->start_time)) {
        try {
            $start = new DateTime($data->start_time);
            $gap_seconds = $now->getTimestamp() - $start->getTimestamp();
            if ($gap_seconds >= 0 && $gap_seconds <= 4 * 3600) {
                $data_workout = $start->format('Y-m-d H:i:s');
                $start_gap = $gap_seconds;
            }
        } catch (Exception $e) {
            // invalid start_time — fall back to now
        }
    }

    // Durata: quella del client (fermata a fine allenamento, prima di note e salvataggio) se
    // plausibile, altrimenti il tempo dall'inizio. Le app che non mandano duration_seconds
    // ottengono così una durata comunque; senza start_time valido resta NULL.
    $duration_seconds = null;
    if ($start_gap !== null) {
        $duration_seconds = $start_gap;
        if (isset($data->duration_seconds) && is_numeric($data->duration_seconds)) {
            $client_duration = (int) $data->duration_seconds;
            if ($client_duration > 0 && $client_duration <= $start_gap + 300) {
                $duration_seconds = $client_duration;
            }
        }
        if ($duration_seconds < 60) $duration_seconds = null;
    }

    $db->beginTransaction();

    try {
        $workout_history = new WorkoutHistory($db);
        $workout_history->user_id = $user_id;
        $workout_history->date = $data_workout;
        $workout_history->duration_seconds = $duration_seconds;
        $workout_history->notes = isset($data->notes) ? $data->notes : '';
        $workout_history->exercises = json_encode($data->workout_records);

        if (!$workout_history->create()) {
            throw new Exception("Impossibile registrare l'allenamento");
        }

        $workout_id = $workout_history->id;
        $sets_saved = 0;
        $workout_set = new WorkoutSet($db);

        foreach ($data->workout_records as $record) {
            if (!isset($record->exercise_id) || empty($record->exercise_id)) continue;

            $workout_set->workout_history_id = $workout_id;
            $workout_set->exercise_id = $record->exercise_id;
            $workout_set->set_number = $record->set_number;
            $workout_set->weight = $record->weight;
            $workout_set->reps = $record->reps;
            $workout_set->intensity_technique = isset($record->intensity_technique) && $record->intensity_technique !== "" ? $record->intensity_technique : null;

            if ($workout_set->create()) {
                $sets_saved++;
            } else {
                throw new Exception("Impossibile salvare il set per l'esercizio ID: {$record->exercise_id}");
            }
        }

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

            if ($last_cw !== null && intval($last_cw) === $current_week) {
                // Same week already counted — no change
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
        foreach ($data->workout_records as $rec) {
            if (!isset($rec->exercise_id) || empty($rec->exercise_id)) continue;
            $eid = (int) $rec->exercise_id;
            $w   = (float) ($rec->weight ?? 0);
            $r   = parseReps($rec->reps ?? '0');
            if ($w <= 0 || $r <= 0) continue;
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
                   AND ws.workout_history_id != ?"
            );
            $stmt_prev->execute(array_merge([$user_id], $eids_list, [$workout_id]));
            while ($prow = $stmt_prev->fetch(PDO::FETCH_ASSOC)) {
                $eid  = (int)   $prow['exercise_id'];
                $pw   = (float) $prow['weight'];
                $pr   = parseReps($prow['reps']);
                $p1rm = estimateOneRepMax($pw, $pr);
                if (!isset($prev_bests[$eid])) $prev_bests[$eid] = ['best_weight' => 0.0, 'best_1rm' => 0.0];
                if ($pw   > $prev_bests[$eid]['best_weight']) $prev_bests[$eid]['best_weight'] = $pw;
                if ($p1rm > $prev_bests[$eid]['best_1rm'])   $prev_bests[$eid]['best_1rm']   = $p1rm;
            }
        }

        // XP di sessione: solo se la sessione rispetta le regole (scheda, completamento, durata,
        // distanza dall'ultima sessione con XP). Il salvataggio dell'allenamento non cambia.
        $day_id = 0;
        $done_sets = 0;
        foreach ($data->workout_records as $rec) {
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
            $seconds_since_last_xp = $now->getTimestamp() - (new DateTime($gam_row['last_xp_session_at']))->getTimestamp();
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
            foreach ($sets as $s) {
                $session_volume_kg += $s['weight'] * $s['reps'];
                if ($s['weight'] > $ex_best_weight) $ex_best_weight = $s['weight'];
                $orm = estimateOneRepMax($s['weight'], $s['reps']);
                if ($orm > $ex_best_1rm) $ex_best_1rm = $orm;
            }

            $prev = $prev_bests[$eid] ?? null;
            // PR solo se c'è storico precedente (coerente con detectPersonalRecords in JS)
            $is_weight_pr = $prev !== null && $ex_best_weight > $prev['best_weight'];
            $is_1rm_pr    = $prev !== null && $ex_best_1rm   > $prev['best_1rm'];

            $ex_xp = $xp_session ? XP_EXERCISE_SESSION : 0;
            if ($is_weight_pr || $is_1rm_pr) {
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
            $xp_session ? $now->format('Y-m-d H:i:s') : null, $user_id,
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

        $db->commit();

        http_response_code(201);
        echo json_encode([
            'success'               => true,
            'message'               => 'Allenamento registrato con successo',
            'id'                    => $workout_id,
            'sets_saved'            => $sets_saved,
            'duration_seconds'      => $duration_seconds,
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
        ]);

    } catch (Exception $e) {
        $db->rollBack();
        throw $e;
    }

} catch (Exception $e) {
    error_log("Error in record_workout.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Errore durante la registrazione dell\'allenamento'
    ]);
}
