<?php
// Include common CORS headers
include_once '../../config/cors_headers.php';

// Include database and progress model
include_once '../../config/database.php';
include_once '../../models/Progress.php';

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

// Instantiate progress object
$progress = new Progress($db);
$progress->user_id = $_SESSION['user_id'];

// Check if exercise_id is provided
if(isset($_GET['exercise_id'])) {
    // Read progress for specific exercise
    $progress->exercise_id = $_GET['exercise_id'];
    $stmt = $progress->readByUserAndExercise();
} else if(isset($_GET['muscle_group'])) {
    // Read progress for specific muscle group
    $progress->muscle_group = $_GET['muscle_group'];
    $stmt = $progress->readByUserAndMuscleGroup();
} else {
    // Read latest progress for all exercises
    $stmt = $progress->readLatestByUser();
}

$num = $stmt->rowCount();

// Check if more than 0 record found
if ($num > 0) {
    // Progress array
    $progress_arr = array();
    $progress_arr["records"] = array();

    // Retrieve table contents
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        extract($row);

        $progress_item = array(
            "id" => $id,
            "exercise_id" => $exercise_id,
            "exercise_name" => $exercise_name,
            "muscle_group" => $muscle_group,
            "weight" => $weight,
            "date" => $date,
            "created_at" => $created_at,
            "updated_at" => $updated_at
        );

        // Add progress to progress array
        array_push($progress_arr["records"], $progress_item);
    }

    // Set response code - 200 OK
    http_response_code(200);

    // Show progress data
    echo json_encode($progress_arr);
} else {
    // Set response code - 200 OK
    http_response_code(200);

    // Tell the user no progress found
    echo json_encode(array(
        "message" => "Nessun progresso trovato.",
        "records" => array()
    ));
}