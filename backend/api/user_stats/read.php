<?php
// Include common CORS headers
include_once '../../config/cors_headers.php';

// Include database and model
include_once '../../config/database.php';
include_once '../../config/api_helpers.php';
include_once '../../models/UserStat.php';

// Connessione creata prima del check di autenticazione: resolve_authenticated_user_id()
// ne ha bisogno per validare sia la sessione web sia il token Bearer mobile.
$database = new Database();
$db = $database->getConnection();

$user_id = resolve_authenticated_user_id($db);
if (!$user_id) {
    http_response_code(401);
    echo json_encode(array("message" => "Accesso non autorizzato. Effettua il login."));
    exit;
}

// Instantiate user stat object
$user_stat = new UserStat($db);
$user_stat->user_id = $user_id;

// Read records
$stmt = $user_stat->readByUser();
$num = $stmt->rowCount();

if ($num > 0) {
    $user_stats_arr = array();
    $user_stats_arr["records"] = array();

    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        extract($row);
        $user_stat_item = array(
            "id" => $id,
            "date" => $date,
            "weight" => $weight,
            "body_fat_percentage" => $body_fat_percentage,
            "muscle_mass_percentage" => $muscle_mass_percentage,
            "chest_size" => $chest_size,
            "arm_size" => $arm_size,
            "waist_size" => $waist_size,
            "leg_size" => $leg_size,
            "created_at" => $created_at,
            "updated_at" => $updated_at
        );
        array_push($user_stats_arr["records"], $user_stat_item);
    }

    http_response_code(200);
    echo json_encode($user_stats_arr);
} else {
    http_response_code(200); // Return 200 with empty array instead of 404 for easier frontend handling
    echo json_encode(array("records" => array()));
}
