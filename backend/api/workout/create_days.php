<?php
// Include common CORS headers
include_once '../../config/cors_headers.php';

// Include database and workout model
include_once '../../config/database.php';
include_once '../../config/api_helpers.php';
include_once '../../models/WorkoutDay.php';
include_once '../../models/WorkoutPlan.php';

// Start session
session_start();

// Check if user is logged in
if (!isset($_SESSION['user_id'])) {
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
if (!empty($data->plan_id) && !empty($data->days)) {
    if (!workout_plan_belongs_to_user($db, $data->plan_id, $_SESSION['user_id'])) {
        api_not_found();
    }

    $workout_day = new WorkoutDay($db);
    $created_days = array();

    foreach ($data->days as $index => $day) {
        // Set workout day property values
        $workout_day->plan_id = $data->plan_id;
        $workout_day->name = $day->name;
        $workout_day->day_order = $index + 1;

        // Create the workout day
        if ($workout_day->create()) {
            $created_days[] = array(
                "id" => $workout_day->id,
                "name" => $workout_day->name,
                "day_order" => $workout_day->day_order
            );
        }
    }

    if (count($created_days) === count($data->days)) {
        // Set response code - 201 created
        http_response_code(201);

        // Tell the user
        echo json_encode(array(
            "message" => "Giorni di allenamento creati con successo.",
            "days" => $created_days
        ));
    } else {
        // Set response code - 503 service unavailable
        http_response_code(503);

        // Tell the user
        echo json_encode(array("message" => "Impossibile creare tutti i giorni di allenamento. Riprova più tardi."));
    }
} else {
    // Set response code - 400 bad request
    http_response_code(400);

    // Tell the user
    echo json_encode(array("message" => "Impossibile creare i giorni di allenamento. Dati incompleti."));
}
