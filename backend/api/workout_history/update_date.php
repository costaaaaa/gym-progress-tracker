<?php
// Headers
include_once '../../config/cors_headers.php';

// Includi i file necessari
include_once '../../config/database.php';
include_once '../../models/WorkoutHistory.php';

// Inizializza il database
$database = new Database();
$db = $database->getConnection();

// Inizializza l'oggetto WorkoutHistory
$workout = new WorkoutHistory($db);

// Ottieni i dati inviati
$data = json_decode(file_get_contents("php://input"));

// Ottieni l'ID utente dalla sessione
$user_id = isset($_SESSION['user_id']) ? $_SESSION['user_id'] : null;

// Verifica che tutti i dati necessari siano presenti
if (!$user_id) {
    http_response_code(401);
    echo json_encode(array(
        "success" => false,
        "message" => "Utente non autenticato."
    ));
    exit;
}

if (
    !empty($data->id) &&
    !empty($data->new_date)
) {
    // Log per debug
    error_log("Richiesta di aggiornamento data per ID: " . $data->id . ", nuova data: " . $data->new_date);

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

    // Aggiorna solo la data
    $workout->date = $formatted_date;

    // Esegui l'aggiornamento
    if ($workout->update()) {
        // Formatta la data in formato ISO 8601 per il frontend
        $date_for_frontend = date('c', $timestamp); // 'c' è il formato ISO 8601

        http_response_code(200);
        echo json_encode(array(
            "success" => true,
            "message" => "Data dell'allenamento aggiornata con successo.",
            "id" => $workout->id,
            "new_date" => $date_for_frontend
        ));
    } else {
        http_response_code(503);
        echo json_encode(array(
            "success" => false,
            "message" => "Impossibile aggiornare la data dell'allenamento."
        ));
    }
} else {
    http_response_code(400);
    echo json_encode(array(
        "success" => false,
        "message" => "Dati incompleti. Specificare ID allenamento e nuova data."
    ));
}
?>
