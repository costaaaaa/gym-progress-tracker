<?php
// Required headers
include_once '../../config/cors_headers.php';

include_once '../../config/database.php';
include_once '../../config/api_helpers.php';
include_once '../../models/User.php';

$database = new Database();
$db = $database->getConnection();

$user_id = require_authenticated_user($db);

try {
    $raw_data = file_get_contents("php://input");
    if (!$raw_data) {
        throw new Exception("Nessun dato fornito");
    }

    $data = json_decode($raw_data);
    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new Exception("Formato JSON non valido: " . json_last_error_msg());
    }

    $user = new User($db);
    $user->id = $user_id;

    if (empty($data->password)) {
        http_response_code(400);
        echo json_encode(array(
            "success" => false,
            "message" => "La password è obbligatoria."
        ));
        exit;
    }

    // Try to delete account
    if ($user->deleteAccount($data->password)) {
        // Pulizia sessione solo se presente (percorso web) — sul percorso
        // mobile (token Bearer) non esiste una sessione da distruggere; il
        // token stesso viene rimosso via ON DELETE CASCADE su gym_api_tokens.
        if (session_status() === PHP_SESSION_ACTIVE) {
            session_unset();
            session_destroy();
        }

        http_response_code(200);
        echo json_encode(array(
            "success" => true,
            "message" => "Account eliminato con successo."
        ));
    } else {
        // 400 e non 401: i client trattano ogni 401 come sessione scaduta e fanno logout
        http_response_code(400);
        echo json_encode(array(
            "success" => false,
            "message" => "Password non corretta. Impossibile eliminare l'account."
        ));
    }
} catch (Exception $e) {
    error_log("Delete User Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(array(
        "success" => false,
        "message" => "Errore interno del server."
    ));
}
