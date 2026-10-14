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

    // Assicuriamoci che la data sia in un formato valido per MySQL (YYYY-MM-DD)
    // Se la data è solo in formato YYYY-MM-DD, aggiungiamo l'ora corrente
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $new_date)) {
        $new_date .= ' ' . date('H:i:s');
        error_log("Data formattata con ora corrente: " . $new_date);
    }

    // Verifica che sia una data valida
    $timestamp = strtotime($new_date);
    if ($timestamp === false) {
        http_response_code(400);
        echo json_encode(array(
            "success" => false,
            "message" => "Formato data non valido. Usare YYYY-MM-DD."
        ));
        exit;
    }

    if ($timestamp > time()) {
        http_response_code(400);
        echo json_encode(array(
            "success" => false,
            "message" => "La data dell'allenamento non può essere nel futuro."
        ));
        exit;
    }

    // Spostamenti solo dentro gli ultimi 30 giorni, sia la data di partenza sia quella nuova
    $oldest_allowed = (new DateTime('today'))->modify('-30 days')->getTimestamp();
    if ($timestamp < $oldest_allowed) {
        http_response_code(400);
        echo json_encode(array(
            "success" => false,
            "message" => "Puoi spostare un allenamento al massimo a 30 giorni fa."
        ));
        exit;
    }

    // Formatta la data in un formato standardizzato per MySQL
    $formatted_date = date('Y-m-d H:i:s', $timestamp);
    error_log("Data finale formattata per MySQL: " . $formatted_date);

    // Imposta le proprietà dell'oggetto
    $workout->id = $data->id;
    $workout->user_id = $user_id;

    // Prima leggiamo i dati esistenti
    if (!$workout->readOne()) {
        http_response_code(404);
        echo json_encode(array(
            "success" => false,
            "message" => "Allenamento non trovato o non appartiene all'utente corrente."
        ));
        exit;
    }

    if (strtotime($workout->date) < $oldest_allowed) {
        http_response_code(400);
        echo json_encode(array(
            "success" => false,
            "message" => "Gli allenamenti di più di 30 giorni fa non si possono spostare."
        ));
        exit;
    }

    // Lo spostamento conta, per lo streak, come «cancella dalla settimana vecchia e salva nella nuova»:
    // prima si riapre la vecchia, poi si chiude la nuova. XP dell'allenamento e cooldown non cambiano.
    $old_dt = new DateTime($workout->date);
    $new_dt = new DateTime($formatted_date);
    $workout->date = $formatted_date;

    // Anteprima: stessi calcoli, poi tutto annullato
    $preview = !empty($data->preview);
    $db->beginTransaction();
    try {
        $gam_row = lock_gamification_row($db, $user_id);
        ensure_streak_registry($db, $user_id, $gam_row);
        $now = new DateTime();
        $streak_before = effectiveStreakWeeks((int) $gam_row['current_streak_weeks'], $gam_row['last_completed_week'], $now);

        if (!$workout->update()) {
            throw new Exception("Impossibile aggiornare la data dell'allenamento.");
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
            "message" => "Impossibile aggiornare la data dell'allenamento."
        ));
        exit;
    }

    http_response_code(200);
    echo json_encode(array(
        "success" => true,
        "preview" => $preview,
        "message" => $preview ? "Anteprima: la data non è cambiata." : "Data dell'allenamento aggiornata con successo.",
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
        "message" => "Dati incompleti. Specificare ID allenamento e nuova data."
    ));
}
?>
