<?php
// Include common CORS headers
include_once '../../config/cors_headers.php';

// Include database and exercise model
include_once '../../config/database.php';
include_once '../../models/Exercise.php';

try {
    // Get database connection
    $database = new Database();
    $db = $database->getConnection();

    if (!$db) {
        throw new Exception("Impossibile stabilire una connessione al database.");
    }

    // Instantiate exercise object
    $exercise = new Exercise($db);

    // Read all exercises
    $stmt = $exercise->readAll();
    $num = $stmt->rowCount();

    // Check if more than 0 record found
    if ($num > 0) {
        // Exercises array
        $exercises_arr = array();
        $exercises_arr["records"] = array();

        // Retrieve table contents
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            extract($row);

            $exercise_item = array(
                "id" => $id,
                "name" => $name,
                "muscle_group" => $muscle_group,
                "created_at" => $created_at,
                "updated_at" => $updated_at
            );

            // Add exercise to exercises array
            array_push($exercises_arr["records"], $exercise_item);
        }

        // Set response code - 200 OK
        http_response_code(200);

        // Show exercises data
        echo json_encode($exercises_arr);
    } else {
        // Set response code - 404 Not found
        http_response_code(404);

        // Tell the user no exercises found
        echo json_encode(array("message" => "Nessun esercizio trovato."));
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(array(
        "message" => "Errore del server: " . $e->getMessage(),
        "success" => false
    ));
}