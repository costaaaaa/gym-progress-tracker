<?php
include_once '../../config/cors_headers.php';
include_once '../../config/database.php';
include_once '../../config/api_helpers.php';
require_once '../../lib/weekly_stats.php';

try {
    $database = new Database();
    $db = $database->getConnection();

    // resolve_authenticated_user_id() copre sia il percorso web (sessione) sia quello
    // mobile (header Authorization: Bearer).
    $user_id = resolve_authenticated_user_id($db);

    if (!$user_id) {
        http_response_code(401);
        if (ob_get_length()) ob_clean();
        echo json_encode(['success' => false, 'message' => 'Utente non autenticato']);
        exit;
    }

    // Fetch or default gamification row
    $stmt = $db->prepare("SELECT * FROM gym_user_gamification WHERE user_id = ?");
    $stmt->execute([$user_id]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    $current_streak = $row ? intval($row['current_streak_weeks']) : 0;
    $longest_streak = $row ? intval($row['longest_streak_weeks']) : 0;
    $last_completed_week = $row ? $row['last_completed_week'] : null;

    // Lazy-reset: if a full week was skipped without completing, streak is broken
    $now = new DateTime();
    $effective_streak = effectiveStreakWeeks($current_streak, $last_completed_week, $now);
    if ($effective_streak !== $current_streak) {
        $current_streak = $effective_streak;
        if ($row) {
            $db->prepare("UPDATE gym_user_gamification SET current_streak_weeks = 0 WHERE user_id = ?")
               ->execute([$user_id]);
        }
    }

    // This week's workouts (Mon–Sun) and goal (days in active plan, fallback 3)
    $week_count = weekly_workout_counts($db, [$user_id], $now)[$user_id];
    $goal = weekly_goals($db, [$user_id])[$user_id];

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
