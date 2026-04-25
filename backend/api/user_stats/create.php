<?php
// Include common CORS headers
include_once '../../config/cors_headers.php';

// Include database and model
include_once '../../config/database.php';
include_once '../../models/UserStat.php';

// Start session
session_start();

// Check if user is logged in
if(!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(array("message" => "Accesso non autorizzato. Effettua il login."));
    exit;
}

// Get database connection
$database = new Database();
$db = $database->getConnection();

// Get posted data
$data = json_decode(file_get_contents("php://input"));

// Make sure data is not empty (at least date is required)
if (!empty($data->date)) {
    // Instantiate user stat object
    $user_stat = new UserStat($db);
    
    // Set property values
    $user_stat->user_id = $_SESSION['user_id'];
    $user_stat->date = $data->date;
    $user_stat->weight = isset($data->weight) ? $data->weight : null;
    $user_stat->body_fat_percentage = isset($data->body_fat_percentage) ? $data->body_fat_percentage : null;
    $user_stat->muscle_mass_percentage = isset($data->muscle_mass_percentage) ? $data->muscle_mass_percentage : null;
    $user_stat->chest_size = isset($data->chest_size) ? $data->chest_size : null;
    $user_stat->arm_size = isset($data->arm_size) ? $data->arm_size : null;
    $user_stat->waist_size = isset($data->waist_size) ? $data->waist_size : null;
    $user_stat->leg_size = isset($data->leg_size) ? $data->leg_size : null;
    
    // Create the record
    if ($user_stat->create()) {
        http_response_code(201);
        echo json_encode(array(
            "message" => "Statistiche registrate con successo.",
            "user_stat" => array(
                "id" => $user_stat->id,
                "date" => $user_stat->date,
                "weight" => $user_stat->weight,
                "body_fat_percentage" => $user_stat->body_fat_percentage,
                "muscle_mass_percentage" => $user_stat->muscle_mass_percentage,
                "chest_size" => $user_stat->chest_size,
                "arm_size" => $user_stat->arm_size,
                "waist_size" => $user_stat->waist_size,
                "leg_size" => $user_stat->leg_size
            )
        ));
    } else {
        http_response_code(503);
        echo json_encode(array("message" => "Impossibile registrare le statistiche. Riprova più tardi."));
    }
} else {
    http_response_code(400);
    echo json_encode(array("message" => "Impossibile registrare le statistiche. Data mancante."));
}
