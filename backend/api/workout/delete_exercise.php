<?php
include_once '../../config/cors_headers.php';

include_once '../../config/database.php';
include_once '../../config/api_helpers.php';
include_once '../../models/WorkoutPlan.php';
include_once '../../models/WorkoutExercise.php';

$database = new Database();
$db = $database->getConnection();

$user_id = require_authenticated_user($db);

$data = json_decode(file_get_contents("php://input"));

if (!empty($data->exercise_id) && !empty($data->day_id)) {
    $workout_exercise = new WorkoutExercise($db);

    $workout_exercise->id = $data->exercise_id;
    $workout_exercise->day_id = $data->day_id;

    if (!workout_exercise_belongs_to_user($db, $data->exercise_id, $data->day_id, $user_id)) {
        api_not_found();
    }
    
    // Delete the exercise
    if ($workout_exercise->delete()) {
        http_response_code(200);
        
        echo json_encode(array("message" => "Esercizio rimosso con successo."));
    } else {
        http_response_code(503);
        
        echo json_encode(array("message" => "Impossibile rimuovere l'esercizio."));
    }
} else {
    http_response_code(400);
    
    echo json_encode(array("message" => "Impossibile rimuovere l'esercizio. Dati incompleti."));
}
