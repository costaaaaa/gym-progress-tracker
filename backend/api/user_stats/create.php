<?php
include_once '../../config/cors_headers.php';

include_once '../../config/database.php';
include_once '../../config/api_helpers.php';
include_once '../../models/Consent.php';
include_once '../../models/UserStat.php';
include_once '../../lib/stats_rules.php';

$database = new Database();
$db = $database->getConnection();

$user_id = require_authenticated_user($db);

// Le misure corporee sono dati sulla salute: servono il consenso esplicito e ancora attivo
if (!(new Consent($db))->isActive($user_id, 'health_data')) {
    http_response_code(403);
    echo json_encode(array(
        "success" => false,
        "code" => "consent_required",
        "message" => t_server('stats.consent_required')
    ));
    exit;
}

$data = json_decode(file_get_contents("php://input"));

$dateObj = (isset($data->date) && is_string($data->date)) ? DateTime::createFromFormat('!Y-m-d', $data->date) : false;
if (!empty($data->date) && (!$dateObj || $dateObj->format('Y-m-d') !== $data->date || $dateObj > user_today())) {
    http_response_code(400);
    echo json_encode(array("message" => t_server('stats.date_invalid')));
    exit;
}
$invalid_field = stats_invalid_field($data);
if ($invalid_field !== null) {
    http_response_code(400);
    echo json_encode(stats_invalid_value($invalid_field));
    exit;
}

// Make sure data is not empty (at least date is required)
if (!empty($data->date)) {
    $user_stat = new UserStat($db);
    
    // Set property values
    $user_stat->user_id = $user_id;
    $user_stat->date = $data->date;
    $user_stat->weight = isset($data->weight) ? $data->weight : null;
    $user_stat->body_fat_percentage = isset($data->body_fat_percentage) ? $data->body_fat_percentage : null;
    $user_stat->muscle_mass_percentage = isset($data->muscle_mass_percentage) ? $data->muscle_mass_percentage : null;
    $user_stat->chest_size = isset($data->chest_size) ? $data->chest_size : null;
    $user_stat->arm_size = isset($data->arm_size) ? $data->arm_size : null;
    $user_stat->waist_size = isset($data->waist_size) ? $data->waist_size : null;
    $user_stat->leg_size = isset($data->leg_size) ? $data->leg_size : null;
    
    // Una riga per giorno: se il giorno c'è già (per esempio dal peso di Apple Salute),
    // i campi inseriti la completano
    if ($user_stat->create() && $user_stat->readOne()) {
        http_response_code($user_stat->created ? 201 : 200);
        echo json_encode(array(
            "message" => t_server('stats.created'),
            "user_stat" => array(
                "id" => $user_stat->id,
                "date" => $user_stat->date,
                "weight" => $user_stat->weight,
                "body_fat_percentage" => $user_stat->body_fat_percentage,
                "muscle_mass_percentage" => $user_stat->muscle_mass_percentage,
                "chest_size" => $user_stat->chest_size,
                "arm_size" => $user_stat->arm_size,
                "waist_size" => $user_stat->waist_size,
                "leg_size" => $user_stat->leg_size,
                "health_fields" => $user_stat->health_fields
            )
        ));
    } else {
        http_response_code(503);
        echo json_encode(array("message" => t_server('stats.create_failed')));
    }
} else {
    http_response_code(400);
    echo json_encode(array("message" => t_server('stats.create_missing_date')));
}
