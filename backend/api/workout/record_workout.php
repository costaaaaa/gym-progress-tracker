<?php
include_once '../../config/cors_headers.php';
include_once '../../config/database.php';
include_once '../../config/api_helpers.php';
include_once '../../models/WorkoutHistory.php';
include_once '../../models/WorkoutSet.php';
include_once '../../models/Exercise.php';
require_once '../../lib/workout_gamification.php';

// Allenamento già salvato con la stessa chiave: per il client è un successo, senza nuovi XP.
// Lo streak serve al riepilogo e alla card di condivisione, che altrimenti lo mostrerebbero vuoto.
function already_saved_response($db, $user_id, $workout_id)
{
    $stmt = $db->prepare("SELECT current_streak_weeks FROM gym_user_gamification WHERE user_id = ?");
    $stmt->execute([$user_id]);
    api_json_response([
        'success'              => true,
        'already_saved'        => true,
        'message'              => t_server('workout.record_already_saved'),
        'id'                   => $workout_id,
        'current_streak_weeks' => (int) $stmt->fetchColumn(),
    ]);
}

$database = new Database();
$db = $database->getConnection();

$user_id = require_authenticated_user($db);

try {
    $data = json_decode(file_get_contents("php://input"));

    if (!$data || !isset($data->workout_records) || !is_array($data->workout_records) || empty($data->workout_records)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => t_server('workout.record_invalid')]);
        exit;
    }

    // Limiti di colonna (gym_workout_sets): weight decimal(5,2), reps varchar(50). Peso 0 ammesso
    // (corpo libero, macchinari senza carico); oltre i limiti il database darebbe un 500 generico.
    // Ripetizioni: intero da 1 a 250, come le controllano le app (un 910 nato da "9" scritto
    // accanto a "10" falserebbe volume, record e obiettivi).
    if (count($data->workout_records) > 500) {
        api_json_response(['success' => false, 'message' => t_server('workout.record_too_many_sets')], 400);
    }
    // Testi liberi: stringhe, con i limiti delle colonne
    if (!free_text_ok($data, 'notes')) {
        api_json_response(['success' => false, 'message' => t_server('workout.record_invalid')], 400);
    }
    foreach ($data->workout_records as $record) {
        if (!is_object($record)) {
            api_json_response(['success' => false, 'message' => t_server('workout.record_invalid')], 400);
        }
        if (!free_text_ok($record, 'intensity_technique')) {
            api_json_response(['success' => false, 'message' => t_server('workout.record_invalid')], 400);
        }
        if (!isset($record->exercise_id) || empty($record->exercise_id)) continue;
        $weight = $record->weight ?? null;
        $reps = $record->reps ?? null;
        $set_number = $record->set_number ?? null;
        if (!is_numeric($weight) || $weight < 0 || $weight > 999.99) {
            api_json_response(['success' => false, 'message' => t_server('workout.record_weight_invalid')], 400);
        }
        if (!(is_string($reps) || is_int($reps)) || !preg_match('/^\d{1,3}$/', (string) $reps)
            || (int) $reps < 1 || (int) $reps > 250) {
            api_json_response(['success' => false, 'message' => t_server('workout.record_reps_invalid')], 400);
        }
        if (!is_int($set_number) || $set_number < 1 || $set_number > 100) {
            api_json_response(['success' => false, 'message' => t_server('workout.record_sets_invalid')], 400);
        }
    }

    // Chiave del client contro i doppi invii: la genera all'inizio della sessione e la rimanda a
    // ogni tentativo. Se la risposta del primo salvataggio si è persa, il secondo trova
    // l'allenamento già salvato e non ridà XP, streak e volume. Senza chiave (app vecchie) si
    // salva come sempre.
    $idempotency_key = null;
    if (isset($data->idempotency_key)) {
        if (!is_string($data->idempotency_key) || !preg_match('/^[A-Za-z0-9_-]{8,64}$/', $data->idempotency_key)) {
            api_json_response(['success' => false, 'message' => t_server('workout.record_invalid')], 400);
        }
        $idempotency_key = $data->idempotency_key;
        $saved_id = WorkoutHistory::findIdByIdempotencyKey($db, $user_id, $idempotency_key);
        if ($saved_id !== null) already_saved_response($db, $user_id, $saved_id);
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
            echo json_encode(['success' => false, 'message' => t_server('workout.exercise_not_found')]);
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
                    'message' => t_server('workout.record_premium_required'),
                ]);
                exit;
            }
        }
    }

    // Data dell'allenamento: start_time se l'inizio è entro 4 ore, altrimenti adesso.
    // Bozza ripresa in ritardo: il client manda backdated=true, start_time sul giorno scelto e
    // ended_at (ultimo set registrato) spostato dello stesso scarto.
    $now = new DateTime();
    $data_workout = $now->format('Y-m-d H:i:s');
    $start_gap = null;
    $start = null;

    if (!empty($data->start_time)) {
        try {
            $start = new DateTime($data->start_time);
            $gap_seconds = $now->getTimestamp() - $start->getTimestamp();
            if ($gap_seconds >= 0 && $gap_seconds <= 4 * 3600) {
                $data_workout = $start->format('Y-m-d H:i:s');
                $start_gap = $gap_seconds;
            }
        } catch (Exception $e) {
            $start = null;
        }
    }

    $duration_seconds = null;
    if ($start_gap !== null) {
        // Durata: quella del client (fermata a fine allenamento, prima di note e salvataggio) se
        // plausibile, altrimenti il tempo dall'inizio. Le app che non mandano duration_seconds
        // ottengono così una durata comunque; senza start_time valido resta NULL.
        $duration_seconds = $start_gap;
        if (isset($data->duration_seconds) && is_numeric($data->duration_seconds)) {
            $client_duration = (int) $data->duration_seconds;
            if ($client_duration > 0 && $client_duration <= $start_gap + 300) {
                $duration_seconds = $client_duration;
            }
        }
    } elseif (!empty($data->backdated) && $start) {
        // Sessione ripresa in ritardo: start_time è già sul giorno scelto dall'utente. Il client
        // limita la scelta a 7 giorni fa; qui 8 per assorbire i fusi orari.
        if ($start < (new DateTime('today'))->modify('-8 days')) {
            api_json_response(['success' => false, 'message' => t_server('workout.record_date_invalid')], 400);
        }
        $data_workout = ($start > $now ? $now : $start)->format('Y-m-d H:i:s');

        if (!empty($data->ended_at)) {
            try {
                $ended_gap = (new DateTime($data->ended_at))->getTimestamp() - $start->getTimestamp();
                if ($ended_gap > 0 && $ended_gap <= 12 * 3600) $duration_seconds = $ended_gap;
            } catch (Exception $e) {
                // ended_at non valido: durata NULL
            }
        }
    }
    if ($duration_seconds !== null && $duration_seconds < 60) $duration_seconds = null;

    $db->beginTransaction();

    try {
        $workout_history = new WorkoutHistory($db);
        $workout_history->user_id = $user_id;
        $workout_history->date = $data_workout;
        $workout_history->duration_seconds = $duration_seconds;
        $workout_history->notes = isset($data->notes) ? $data->notes : '';
        $workout_history->exercises = json_encode($data->workout_records);
        $workout_history->idempotency_key = $idempotency_key;

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

        $gamification = apply_workout_gamification($db, $user_id, (int) $workout_id, $data_workout, $duration_seconds, $data->workout_records);

        $db->commit();

        http_response_code(201);
        echo json_encode(array_merge([
            'success'          => true,
            'message'          => t_server('workout.record_saved'),
            'id'               => $workout_id,
            'sets_saved'       => $sets_saved,
            'duration_seconds' => $duration_seconds,
        ], $gamification));

    } catch (Exception $e) {
        $db->rollBack();
        // Due invii con la stessa chiave arrivati insieme: il secondo trova l'indice unico occupato
        if ($idempotency_key !== null && $e instanceof PDOException && ($e->errorInfo[1] ?? null) == 1062) {
            $saved_id = WorkoutHistory::findIdByIdempotencyKey($db, $user_id, $idempotency_key);
            if ($saved_id !== null) already_saved_response($db, $user_id, $saved_id);
        }
        throw $e;
    }

} catch (Exception $e) {
    error_log("Error in record_workout.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => t_server('workout.record_error')
    ]);
}
