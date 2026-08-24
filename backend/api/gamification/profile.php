<?php
include_once '../../config/cors_headers.php';
include_once '../../config/database.php';
include_once '../../config/api_helpers.php';
require_once '../../lib/gamification_rules.php';

try {
    $database = new Database();
    $db       = $database->getConnection();

    // resolve_authenticated_user_id() copre sia il percorso web (sessione) sia quello
    // mobile (header Authorization: Bearer).
    $user_id = resolve_authenticated_user_id($db);

    if (!$user_id) {
        http_response_code(401);
        if (ob_get_length()) ob_clean();
        echo json_encode(['success' => false, 'message' => 'Utente non autenticato']);
        exit;
    }

    // Gamification utente
    $stmt = $db->prepare(
        "SELECT total_xp, level, lifetime_volume_kg, longest_streak_weeks
         FROM gym_user_gamification WHERE user_id = ?"
    );
    $stmt->execute([$user_id]);
    $gam = $stmt->fetch(PDO::FETCH_ASSOC);

    $total_xp        = (int)   ($gam['total_xp']             ?? 0);
    $level           = (int)   ($gam['level']                 ?? 1);
    $lifetime_volume = (float) ($gam['lifetime_volume_kg']    ?? 0);
    $longest_streak  = (int)   ($gam['longest_streak_weeks']  ?? 0);

    // Sessioni totali
    $stmt_cnt = $db->prepare("SELECT COUNT(*) FROM gym_workout_history WHERE user_id = ?");
    $stmt_cnt->execute([$user_id]);
    $total_sessions = (int) $stmt_cnt->fetchColumn();

    // Livelli per-esercizio (ordinati per XP desc)
    $stmt_ex = $db->prepare(
        "SELECT eg.exercise_id, e.name, eg.xp, eg.level
         FROM gym_exercise_gamification eg
         JOIN gym_exercises e ON eg.exercise_id = e.id
         WHERE eg.user_id = ?
         ORDER BY eg.xp DESC"
    );
    $stmt_ex->execute([$user_id]);
    $exercises = $stmt_ex->fetchAll(PDO::FETCH_ASSOC);

    // Achievement sbloccati
    $stmt_ach = $db->prepare(
        "SELECT achievement_key, unlocked_at
         FROM gym_achievements WHERE user_id = ?
         ORDER BY unlocked_at ASC"
    );
    $stmt_ach->execute([$user_id]);
    $unlocked_rows = $stmt_ach->fetchAll(PDO::FETCH_ASSOC);
    $unlocked_map  = array_column($unlocked_rows, 'unlocked_at', 'achievement_key');

    // Catalogo completo con stato locked/unlocked
    $achievements = [];
    foreach (achievementCatalog() as $entry) {
        $key = $entry['key'];
        $achievements[] = [
            'key'         => $key,
            'label'       => $entry['label'],
            'category'    => $entry['category'],
            'threshold'   => $entry['threshold'],
            'locked'      => !isset($unlocked_map[$key]),
            'unlocked_at' => $unlocked_map[$key] ?? null,
        ];
    }

    if (ob_get_length()) ob_clean();
    header('Content-Type: application/json');
    echo json_encode([
        'success'           => true,
        'level'             => $level,
        'total_xp'          => $total_xp,
        'xp_into_level'     => xpIntoLevel($total_xp),
        'xp_for_next_level' => xpForNextLevel($total_xp),
        'lifetime_volume_kg'=> $lifetime_volume,
        'total_sessions'    => $total_sessions,
        'longest_streak'    => $longest_streak,
        'exercises'         => $exercises,
        'achievements'      => $achievements,
    ]);

} catch (Throwable $e) {
    error_log("profile.php error: " . $e->getMessage());
    http_response_code(500);
    if (ob_get_length()) ob_clean();
    echo json_encode(['success' => false, 'message' => 'Errore interno']);
}
ob_end_flush();
