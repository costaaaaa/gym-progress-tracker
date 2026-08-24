<?php
// Required headers
include_once '../../config/cors_headers.php';

// Include database and object files
include_once '../../config/database.php';
include_once '../../config/api_helpers.php';
include_once '../../models/User.php';

// Connessione creata prima del check di autenticazione: resolve_authenticated_user_id()
// ne ha bisogno per validare sia la sessione web sia il token Bearer mobile.
$database = new Database();
$db = $database->getConnection();

$user_id = resolve_authenticated_user_id($db);
if (!$user_id) {
    http_response_code(401);
    echo json_encode(array(
        "success" => false,
        "message" => "Sessione non valida. Effettua il login."
    ));
    exit;
}

try {
    // Get posted data
    $raw_data = file_get_contents("php://input");
    if (!$raw_data) {
        throw new Exception("Nessun dato fornito");
    }

    $data = json_decode($raw_data);
    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new Exception("Formato JSON non valido: " . json_last_error_msg());
    }

    // Instantiate user object
    $user = new User($db);
    $user->id = $user_id;

    // Make sure data is not empty
    if (empty($data->password)) {
        // Set response code - 400 Bad Request
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

        // Set response code - 200 OK
        http_response_code(200);
        echo json_encode(array(
            "success" => true,
            "message" => "Account eliminato con successo."
        ));
    } else {
        // Set response code - 401 Unauthorized
        http_response_code(401);
        echo json_encode(array(
            "success" => false,
            "message" => "Password non corretta. Impossibile eliminare l'account."
        ));
    }
} catch (Exception $e) {
    error_log("Delete User Error: " . $e->getMessage());
    // Set response code - 500 Internal Server Error
    http_response_code(500);
    echo json_encode(array(
        "success" => false,
        "message" => "Errore interno del server."
    ));
}
