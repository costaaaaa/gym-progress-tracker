<?php
include_once '../../config/cors_headers.php';
include_once '../../config/database.php';
include_once '../../models/WorkoutHistory.php';
include_once '../../models/WorkoutSet.php';

session_start();

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Utente non autenticato']);
    exit;
}

// Returns the YEARWEEK(ISO) integer of the week following $yw (e.g. 202426 → 202427, handles year wrap)
function nextWeekYearweek(int $yw): int {
    $year = intval(substr((string)$yw, 0, 4));
    $week = intval(substr((string)$yw, 4));
    $d = new DateTime();
    $d->setISODate($year, $week);
    $d->modify('+7 days');
    return intval($d->format('oW'));
}

try {
    $data = json_decode(file_get_contents("php://input"));

    if (!$data || !isset($data->workout_records) || !is_array($data->workout_records) || empty($data->workout_records)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Dati mancanti o non validi']);
        exit;
    }

    // Determine workout date: use start_time if gap <= 4h, else now
    $now = new DateTime();
    $data_workout = $now->format('Y-m-d H:i:s');

    if (!empty($data->start_time)) {
        try {
            $start = new DateTime($data->start_time);
            $gap_seconds = $now->getTimestamp() - $start->getTimestamp();
            if ($gap_seconds >= 0 && $gap_seconds <= 4 * 3600) {
                $data_workout = $start->format('Y-m-d H:i:s');
            }
        } catch (Exception $e) {
            // invalid start_time — fall back to now
        }
    }

    $database = new Database();
    $db = $database->getConnection();
    $db->beginTransaction();

    try {
        $user_id = $_SESSION['user_id'];

        $workout_history = new WorkoutHistory($db);
        $workout_history->user_id = $user_id;
        $workout_history->date = $data_workout;
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

        // Count workouts this ISO week (Mon–Sun) — includes the workout just inserted
        $week_monday = clone $workout_dt;
        $week_monday->setISODate(intval($workout_dt->format('o')), intval($workout_dt->format('W')));
        $week_monday->setTime(0, 0, 0);
        $week_sunday = clone $week_monday;
        $week_sunday->modify('+6 days')->setTime(23, 59, 59);

        $stmt_count = $db->prepare(
            "SELECT COUNT(*) as cnt FROM gym_workout_history
             WHERE user_id = ? AND date >= ? AND date <= ?"
        );
        $stmt_count->execute([
            $user_id,
            $week_monday->format('Y-m-d H:i:s'),
            $week_sunday->format('Y-m-d H:i:s')
        ]);
        $weekly_count = intval($stmt_count->fetch(PDO::FETCH_ASSOC)['cnt']);

        // Goal = days in active plan, fallback 3
        $stmt_goal = $db->prepare(
            "SELECT COUNT(wd.id) as days_count
             FROM gym_workout_plans wp
             JOIN gym_workout_days wd ON wp.id = wd.plan_id
             WHERE wp.user_id = ? AND wp.is_active = 1"
        );
        $stmt_goal->execute([$user_id]);
        $goal = intval($stmt_goal->fetch(PDO::FETCH_ASSOC)['days_count'] ?? 0);
        if ($goal === 0) $goal = 3;

        // Ensure gamification row exists
        $db->prepare(
            "INSERT IGNORE INTO gym_user_gamification (user_id, current_streak_weeks, longest_streak_weeks, last_completed_week, updated_at)
             VALUES (?, 0, 0, NULL, NOW())"
        )->execute([$user_id]);

        $stmt_row = $db->prepare("SELECT * FROM gym_user_gamification WHERE user_id = ?");
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

        $db->commit();

        http_response_code(201);
        echo json_encode([
            'success' => true,
            'message' => 'Allenamento registrato con successo',
            'id' => $workout_id,
            'sets_saved' => $sets_saved,
            'current_streak_weeks' => $current_streak_val,
            'week_completed_now' => $week_completed_now,
            'new_longest' => $new_longest,
            'streak_milestone' => $streak_milestone,
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
