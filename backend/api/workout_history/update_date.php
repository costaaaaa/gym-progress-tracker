<?php
// Headers
include_once '../../config/cors_headers.php';

// Includi i file necessari
include_once '../../config/database.php';
include_once '../../config/api_helpers.php';
include_once '../../models/WorkoutHistory.php';
require_once '../../lib/workout_gamification.php';

// Inizializza il database
$database = new Database();
$db = $database->getConnection();

// Inizializza l'oggetto WorkoutHistory
$workout = new WorkoutHistory($db);

// Ottieni i dati inviati
$data = json_decode(file_get_contents("php://input"));

$user_id = require_authenticated_user($db);

if (
    !empty($data->id) &&
    !empty($data->new_date)
) {
    // Log per debug

    // Verifica e formatta la data
    $new_date = $data->new_date;

    // Con la sola data (YYYY-MM-DD) l'orario originale dell'allenamento resta: va riletto prima di
    // calcolare la nuova data. Se data nuova + orario originale cade nel futuro (oggi, orario non
    // ancora arrivato) si usa l'ora attuale.
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $new_date)) {
        $stmt_time = $db->prepare("SELECT TIME(date) FROM gym_workout_history WHERE id = ? AND user_id = ?");
        $stmt_time->execute([$data->id, $user_id]);
        $original_time = $stmt_time->fetchColumn();
        if ($original_time === false) {
            http_response_code(404);
            echo json_encode(array(
                "success" => false,
                "code" => "not_found",
                "message" => t_server('history.not_yours')
            ));
            exit;
        }
        $with_original_time = $new_date . ' ' . $original_time;
        $new_date .= ' ' . (strtotime($with_original_time) > time() ? date('H:i:s') : $original_time);
    }

    // Verifica che sia una data valida
    $timestamp = strtotime($new_date);
    if ($timestamp === false) {
        http_response_code(400);
        echo json_encode(array(
            "success" => false,
            "code" => "invalid_date",
            "message" => t_server('history.date_format')
        ));
        exit;
    }

    if ($timestamp > time()) {
        http_response_code(400);
        echo json_encode(array(
            "success" => false,
            "code" => "future_date",
            "message" => t_server('history.date_future')
        ));
        exit;
    }

    // Spostamenti solo dentro gli ultimi 30 giorni, sia la data di partenza sia quella nuova
    $oldest_allowed = (new DateTime('today'))->modify('-30 days')->getTimestamp();
    if ($timestamp < $oldest_allowed) {
        http_response_code(400);
        echo json_encode(array(
            "success" => false,
            "code" => "target_too_old",
            "message" => t_server('history.date_too_old')
        ));
        exit;
    }

    // Formatta la data in un formato standardizzato per MySQL
    $formatted_date = date('Y-m-d H:i:s', $timestamp);

    // Imposta le proprietà dell'oggetto
    $workout->id = $data->id;
    $workout->user_id = $user_id;

    // Prima leggiamo i dati esistenti
    if (!$workout->readOne()) {
        http_response_code(404);
        echo json_encode(array(
            "success" => false,
            "code" => "not_found",
            "message" => t_server('history.not_yours')
        ));
        exit;
    }

    // Lo spostamento conta, per lo streak, come «cancella dalla settimana vecchia e salva nella nuova»:
    // prima si riapre la vecchia, poi si chiude la nuova. XP dell'allenamento e cooldown non cambiano.
    $new_dt = new DateTime($formatted_date);
    $workout->date = $formatted_date;

    // Anteprima: stessi calcoli, poi tutto annullato
    $preview = !empty($data->preview);
    $db->beginTransaction();
    try {
        $gam_row = lock_gamification_row($db, $user_id);

        // Data di partenza riletta sotto lock: due spostamenti contemporanei partirebbero entrambi da
        // quella letta da readOne(), e il secondo non riaprirebbe la settimana lasciata dal primo
        $stmt_date = $db->prepare("SELECT date FROM gym_workout_history WHERE id = ? AND user_id = ? FOR UPDATE");
        $stmt_date->execute([$workout->id, $user_id]);
        $old_date = $stmt_date->fetchColumn();
        if ($old_date === false) {
            $db->rollBack();
            api_json_response([
                "success" => false,
                "code" => "not_found",
                "message" => t_server('history.not_yours')
            ], 404);
        }
        if (strtotime($old_date) < $oldest_allowed) {
            $db->rollBack();
            api_json_response([
                "success" => false,
                "code" => "source_too_old",
                "message" => t_server('history.locked_old')
            ], 400);
        }
        $old_dt = new DateTime($old_date);

        $before = ensure_streak_registry($db, $user_id, $gam_row);
        $now = new DateTime();
        $streak_before = effectiveStreakWeeks($before['current'], $before['last_completed_week'], $now);

        if (!$workout->update()) {
            throw new Exception(t_server('history.date_update_failed'));
        }
        $xp = reopen_week_if_below($db, $user_id, $old_dt) + close_week_if_reached($db, $user_id, $new_dt);
        $streak = recompute_streak($db, $user_id);
        $xp_delta = add_general_xp($db, $user_id, $xp);
        $achievements = sync_streak_achievements($db, $user_id, $streak['longest']);
        if ($preview) {
            $db->rollBack();
        } else {
            $db->commit();
        }
    } catch (Throwable $e) {
        $db->rollBack();
        error_log("update_date.php: " . $e->getMessage());
        http_response_code(503);
        echo json_encode(array(
            "success" => false,
            "code" => "update_failed",
            "message" => t_server('history.date_update_failed')
        ));
        exit;
    }

    http_response_code(200);
    echo json_encode(array(
        "success" => true,
        "preview" => $preview,
        "message" => $preview ? t_server('history.date_preview') : t_server('history.date_updated'),
        "id" => $workout->id,
        "new_date" => date('c', $timestamp),
        "xp_delta" => $xp_delta,
        "streak_before" => $streak_before,
        "streak_after" => effectiveStreakWeeks($streak['current'], $streak['last_completed_week'], $now),
        "achievements_unlocked" => $achievements['unlocked'],
        "achievements_removed" => $achievements['removed'],
    ));
} else {
    http_response_code(400);
    echo json_encode(array(
        "success" => false,
        "code" => "missing_data",
        "message" => t_server('history.date_incomplete')
    ));
}
?>
