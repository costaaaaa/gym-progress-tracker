<?php
include_once '../../config/cors_headers.php';

include_once '../../config/database.php';
include_once '../../config/api_helpers.php';
include_once '../../models/Consent.php';
include_once '../../models/UserStat.php';

$database = new Database();
$db = $database->getConnection();

$user_id = require_authenticated_user($db);

// Senza consenso attivo le misure non si leggono e il client mostra la richiesta di consenso.
// consent_updated: c'è un consenso a una versione precedente del testo, va ridato (le misure
// restano salvate finché l'utente non lo revoca).
$consent = new Consent($db);
if (!$consent->isActive($user_id, 'health_data')) {
    http_response_code(200);
    echo json_encode(array(
        "records" => array(),
        "consent_required" => true,
        "consent_updated" => $consent->isActive($user_id, 'health_data', false),
    ));
    exit;
}

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
            // Campi arrivati da Apple Salute / Health Connect, separati da virgola ("" se nessuno)
            "health_fields" => $health_fields,
            "created_at" => $created_at,
            "updated_at" => $updated_at
        );
        array_push($user_stats_arr["records"], $user_stat_item);
    }

    $user_stats_arr["consent_required"] = false;
    http_response_code(200);
    echo json_encode($user_stats_arr);
} else {
    http_response_code(200); // Return 200 with empty array instead of 404 for easier frontend handling
    echo json_encode(array("records" => array(), "consent_required" => false));
}
