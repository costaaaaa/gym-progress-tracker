<?php
include_once '../../config/cors_headers.php';
include_once '../../config/database.php';

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    if (ob_get_length()) ob_clean();
    echo json_encode(['success' => false, 'message' => 'Utente non autenticato']);
    exit;
}

function nextWeekYearweek(int $yw): int {
    $year = intval(substr((string)$yw, 0, 4));
    $week = intval(substr((string)$yw, 4));
    $d = new DateTime();
    $d->setISODate($year, $week);
    $d->modify('+7 days');
    return intval($d->format('oW'));
}

try {
    $database = new Database();
    $db = $database->getConnection();
    $user_id = $_SESSION['user_id'];

    // Fetch or default gamification row
    $stmt = $db->prepare("SELECT * FROM gym_user_gamification WHERE user_id = ?");
    $stmt->execute([$user_id]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    $current_streak = $row ? intval($row['current_streak_weeks']) : 0;
    $longest_streak = $row ? intval($row['longest_streak_weeks']) : 0;
    $last_completed_week = $row ? $row['last_completed_week'] : null;

    // Lazy-reset: if a full week was skipped without completing, streak is broken
    $now = new DateTime();
    $current_week = intval($now->format('oW'));

    if ($last_completed_week !== null && $current_streak > 0) {
        $next_after_last = nextWeekYearweek(intval($last_completed_week));
        if ($next_after_last < $current_week) {
            $current_streak = 0;
            if ($row) {
                $db->prepare("UPDATE gym_user_gamification SET current_streak_weeks = 0 WHERE user_id = ?")
                   ->execute([$user_id]);
            }
        }
    }

    // Count this week's workouts (Mon–Sun)
    $week_monday = new DateTime();
    $week_monday->setISODate(intval($now->format('o')), intval($now->format('W')));
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
    $week_count = intval($stmt_count->fetch(PDO::FETCH_ASSOC)['cnt']);

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

    if (ob_get_length()) ob_clean();
    header('Content-Type: application/json');
    echo json_encode([
        'success' => true,
        'current_streak_weeks' => $current_streak,
        'longest_streak_weeks' => $longest_streak,
        'this_week' => [
            'count' => $week_count,
            'goal'  => $goal,
            'completed' => $week_count >= $goal
        ]
    ]);

} catch (Throwable $e) {
    error_log("streak.php error: " . $e->getMessage());
    http_response_code(500);
    if (ob_get_length()) ob_clean();
    echo json_encode(['success' => false, 'message' => 'Errore interno']);
}
ob_end_flush();
