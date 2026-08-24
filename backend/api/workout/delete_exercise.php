<?php
// Include common CORS headers
include_once '../../config/cors_headers.php';

// Include database and workout models
include_once '../../config/database.php';
include_once '../../config/api_helpers.php';
include_once '../../models/WorkoutPlan.php';
include_once '../../models/WorkoutExercise.php';

// Connessione creata prima del check di autenticazione: resolve_authenticated_user_id()
// ne ha bisogno per validare sia la sessione web sia il token Bearer mobile.
$database = new Database();
$db = $database->getConnection();

$user_id = resolve_authenticated_user_id($db);
if (!$user_id) {
    // Set response code - 401 Unauthorized
    http_response_code(401);

    // Tell the user
    echo json_encode(array("message" => "Accesso non autorizzato. Effettua il login."));
    exit;
}

// Get posted data
$data = json_decode(file_get_contents("php://input"));

// Make sure data is not empty
if (!empty($data->exercise_id) && !empty($data->day_id)) {
    // Create workout plan object
    $workout_exercise = new WorkoutExercise($db);

    // Set properties
    $workout_exercise->id = $data->exercise_id;
    $workout_exercise->day_id = $data->day_id;

    if (!workout_exercise_belongs_to_user($db, $data->exercise_id, $data->day_id, $user_id)) {
        api_not_found();
    }
    
    // Delete the exercise
    if ($workout_exercise->delete()) {
        // Set response code - 200 OK
        http_response_code(200);
        
        // Tell the user
        echo json_encode(array("message" => "Esercizio rimosso con successo."));
    } else {
        // Set response code - 503 service unavailable
        http_response_code(503);
        
        // Tell the user
        echo json_encode(array("message" => "Impossibile rimuovere l'esercizio."));
    }
} else {
    // Set response code - 400 bad request
    http_response_code(400);
    
    // Tell the user
    echo json_encode(array("message" => "Impossibile rimuovere l'esercizio. Dati incompleti."));
}
