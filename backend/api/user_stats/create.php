<?php
// Include common CORS headers
include_once '../../config/cors_headers.php';

// Include database and model
include_once '../../config/database.php';
include_once '../../config/api_helpers.php';
include_once '../../models/Consent.php';
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

// Le misure corporee sono dati sulla salute: servono il consenso esplicito e ancora attivo
if (!(new Consent($db))->isActive($user_id, 'health_data')) {
    http_response_code(403);
    echo json_encode(array(
        "success" => false,
        "code" => "consent_required",
        "message" => "Per salvare le misure corporee serve il tuo consenso."
    ));
    exit;
}

// Get posted data
$data = json_decode(file_get_contents("php://input"));

// Valori plausibili: numeri finiti, non negativi, con un tetto ragionevole
$limits = array(
    'weight' => 500, 'body_fat_percentage' => 100, 'muscle_mass_percentage' => 100,
    'chest_size' => 300, 'arm_size' => 150, 'waist_size' => 300, 'leg_size' => 200,
);
$dateObj = (isset($data->date) && is_string($data->date)) ? DateTime::createFromFormat('!Y-m-d', $data->date) : false;
if (!empty($data->date) && (!$dateObj || $dateObj->format('Y-m-d') !== $data->date || $dateObj > new DateTime('today'))) {
    http_response_code(400);
    echo json_encode(array("message" => "Data non valida."));
    exit;
}
foreach ($limits as $field => $max) {
    if (isset($data->$field) && $data->$field !== '' && $data->$field !== null) {
        if (!is_numeric($data->$field) || $data->$field < 0 || $data->$field > $max) {
            http_response_code(400);
            echo json_encode(array("message" => "Valore non valido per $field."));
            exit;
        }
    }
}

// Make sure data is not empty (at least date is required)
if (!empty($data->date)) {
    // Instantiate user stat object
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
