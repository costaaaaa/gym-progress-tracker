<?php
include_once '../../config/cors_headers.php';

include_once '../../config/database.php';
include_once '../../config/api_helpers.php';
include_once '../../models/Exercise.php';

// Senza login: solo gli esercizi approvati. Con login (sessione web o Bearer mobile): anche quelli
// personali dell'utente, ancora in attesa o rifiutati.

try {
    $database = new Database();
    $db = $database->getConnection();

    if (!$db) {
        throw new Exception("Impossibile stabilire una connessione al database.");
    }

    $exercise = new Exercise($db);

    $user_id = resolve_authenticated_user_id($db);
    $stmt = $exercise->readVisibleTo($user_id ? (int)$user_id : null);
    $num = $stmt->rowCount();

    // Check if more than 0 record found
    if ($num > 0) {
        // Exercises array
        $exercises_arr = array();
        $exercises_arr["records"] = array();

        // Retrieve table contents
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $exercise_item = exercise_public($row, $user_id ? (int)$user_id : null);
            $exercise_item["created_at"] = $row["created_at"];
            $exercise_item["updated_at"] = $row["updated_at"];
            array_push($exercises_arr["records"], $exercise_item);
        }
        // In inglese l'ordine alfabetico cambia: la query ordina per nome italiano
        if (request_locale() === 'en') {
            usort($exercises_arr["records"], function ($x, $y) {
                return strcasecmp($x['name'], $y['name']);
            });
        }

        http_response_code(200);

        // Show exercises data
        echo json_encode($exercises_arr);
    } else {
        http_response_code(404);

        // Tell the user no exercises found
        echo json_encode(array("message" => "Nessun esercizio trovato."));
    }
} catch (Exception $e) {
    error_log("Read exercises error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(array(
        "message" => "Errore del server.",
        "success" => false
    ));
}
