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

    // Verifica e formatta la data. La data di un allenamento è l'ora locale del suo luogo: cambiarla
    // ne conserva il fuso (l'ora legale si ricalcola dal nome IANA) e il "futuro" è quello di quel luogo.
    $new_date = $data->new_date;
    $stmt_row = $db->prepare("SELECT TIME(date) AS time_of_day, time_zone FROM gym_workout_history WHERE id = ? AND user_id = ?");
    $stmt_row->execute([$data->id, $user_id]);
    $row = $stmt_row->fetch(PDO::FETCH_ASSOC);
    $time_zone = $row ? $row['time_zone'] : request_time_zone();
    $zone = new DateTimeZone($time_zone);

    // Con la sola data (YYYY-MM-DD) l'orario originale dell'allenamento resta: va riletto prima di
    // calcolare la nuova data. Se data nuova + orario originale cade nel futuro (oggi, orario non
    // ancora arrivato) si usa l'ora attuale del luogo.
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $new_date)) {
        if (!$row) {
            http_response_code(404);
            echo json_encode(array(
                "success" => false,
                "code" => "not_found",
                "message" => t_server('history.not_yours')
            ));
            exit;
        }
        $with_original_time = $new_date . ' ' . $row['time_of_day'];
        $new_date .= ' ' . (workout_instant($with_original_time, $time_zone)->getTimestamp() > time()
            ? (new DateTime('now', $zone))->format('H:i:s')
            : $row['time_of_day']);
    }

    // Verifica che sia una data valida
    try {
        $new_local = client_datetime($new_date, $time_zone);
    } catch (Exception $e) {
        http_response_code(400);
        echo json_encode(array(
            "success" => false,
            "code" => "invalid_date",
            "message" => t_server('history.date_format')
        ));
        exit;
    }
    $timestamp = $new_local->getTimestamp();

    if ($timestamp > time()) {
        http_response_code(400);
        echo json_encode(array(
            "success" => false,
            "code" => "future_date",
            "message" => t_server('history.date_future')
        ));
        exit;
    }

    // Spostamenti solo dentro gli ultimi 30 giorni, sia la data di partenza sia quella nuova: i giorni
    // si contano nel fuso attuale del dispositivo, sul giorno locale dell'allenamento
    $oldest_day = user_now()->modify('-30 days')->format('Y-m-d');
    if (substr($new_local->format('Y-m-d'), 0, 10) < $oldest_day) {
        http_response_code(400);
        echo json_encode(array(
            "success" => false,
            "code" => "target_too_old",
            "message" => t_server('history.date_too_old')
        ));
        exit;
    }

    // Formatta la data in un formato standardizzato per MySQL
    $formatted_date = $new_local->format('Y-m-d H:i:s');

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
        if (substr($old_date, 0, 10) < $oldest_day) {
            $db->rollBack();
            api_json_response([
                "success" => false,
                "code" => "source_too_old",
                "message" => t_server('history.locked_old')
            ], 400);
        }
        $old_dt = new DateTime($old_date);

        $before = ensure_streak_registry($db, $user_id, $gam_row);
        $now = user_now();
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
        "new_date" => workout_started_at($formatted_date, $time_zone),
        "started_at" => workout_started_at($formatted_date, $time_zone),
        "time_zone" => $time_zone,
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
