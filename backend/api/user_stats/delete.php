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

// Get id of record to be deleted
$data = json_decode(file_get_contents("php://input"));

if (!empty($data->id)) {
    // Instantiate user stat object
    $user_stat = new UserStat($db);
    $user_stat->id = $data->id;
    $user_stat->user_id = $user_id;

    // Delete record
    if ($user_stat->delete()) {
        http_response_code(200);
        echo json_encode(array("message" => "Statistica eliminata con successo."));
    } else {
        http_response_code(503);
        echo json_encode(array("message" => "Impossibile eliminare la statistica. Riprova più tardi."));
    }
} else {
    http_response_code(400);
    echo json_encode(array("message" => "Impossibile eliminare la statistica. ID mancante."));
}
