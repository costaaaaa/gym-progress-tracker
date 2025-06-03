<?php
// Include common CORS headers
include_once '../../config/cors_headers.php';

// Include database and workout model
include_once '../../config/database.php';
include_once '../../models/WorkoutDay.php';
include_once '../../models/WorkoutPlan.php';

// Start session
session_start();

// Check if user is logged in
if(!isset($_SESSION['user_id'])) {
    // Set response code - 401 Unauthorized
    http_response_code(401);
    
    // Tell the user
    echo json_encode(array("message" => "Accesso non autorizzato. Effettua il login."));
    exit;
}

// Get database connection
$database = new Database();
$db = $database->getConnection();

// Get posted data
$data = json_decode(file_get_contents("php://input"));

// Make sure data is not empty
if (
    !empty($data->plan_id) &&
    !empty($data->name) &&
    !empty($data->day_order)
) {
    // First, verify that the plan belongs to the current user
    $workout_plan = new WorkoutPlan($db);
    $workout_plan->id = $data->plan_id;
    $workout_plan->user_id = $_SESSION['user_id'];
    
    if ($workout_plan->readOne()) {
        // Plan belongs to user, proceed with creating the day
        $workout_day = new WorkoutDay($db);
        
        // Set workout day property values
        $workout_day->plan_id = $data->plan_id;
        $workout_day->name = $data->name;
        $workout_day->day_order = $data->day_order;
        
        // Create the workout day
        if ($workout_day->create()) {
            // Set response code - 201 created
            http_response_code(201);

            // Tell the user
            echo json_encode(array(
                "message" => "Giorno di allenamento creato con successo.",
                "day" => array(
                    "id" => $workout_day->id,
                    "plan_id" => $workout_day->plan_id,
                    "name" => $workout_day->name,
                    "day_order" => $workout_day->day_order
                )
            ));
        } else {
            // Set response code - 503 service unavailable
            http_response_code(503);

            // Tell the user
            echo json_encode(array("message" => "Impossibile creare il giorno di allenamento. Riprova più tardi."));
        }
    } else {
        // Set response code - 403 forbidden
        http_response_code(403);

        // Tell the user
        echo json_encode(array("message" => "Non hai il permesso di modificare questa scheda di allenamento."));
    }
} else {
    // Set response code - 400 bad request
    http_response_code(400);

    // Tell the user
    echo json_encode(array("message" => "Impossibile creare il giorno di allenamento. Dati incompleti."));
}