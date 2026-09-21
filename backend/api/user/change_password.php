<?php
// Include common CORS headers
include_once '../../config/cors_headers.php';

// Include database and user model
include_once '../../config/database.php';
include_once '../../config/api_helpers.php';
include_once '../../lib/password_policy.php';
include_once '../../models/ApiToken.php';
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
        "message" => "Sessione non valida. Effettua nuovamente il login."
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
    if (empty($data->current_password) || empty($data->new_password)) {
        // Set response code - 400 Bad Request
        http_response_code(400);
        echo json_encode(array(
            "success" => false,
            "message" => "Password attuale e nuova password sono obbligatorie."
        ));
        exit;
    }
    
    // Verifica che la nuova password sia diversa dalla password attuale
    if ($data->current_password === $data->new_password) {
        // Set response code - 400 Bad Request
        http_response_code(400);
        echo json_encode(array(
            "success" => false,
            "message" => "La nuova password deve essere diversa da quella attuale."
        ));
        exit;
    }

    $policyError = password_policy_error($data->new_password);
    if ($policyError !== null) {
        http_response_code(400);
        echo json_encode(array("success" => false, "message" => $policyError));
        exit;
    }

    // Try to change password
    if ($user->changePassword($data->current_password, $data->new_password)) {
        // Le altre sessioni e gli altri dispositivi devono rifare il login: la sessione web
        // in uso riparte con un nuovo id, il token mobile in uso resta valido, gli altri no.
        if (isset($_SESSION['user_id'])) {
            session_regenerate_id(true);
            $_SESSION['auth_at'] = time();
        }
        (new ApiToken($db))->revokeAllForUserExcept($user_id, bearer_token_from_request());
        // Set response code - 200 OK
        http_response_code(200);
        echo json_encode(array(
            "success" => true,
            "message" => "Password modificata con successo."
        ));
    } else {
        // Set response code - 400 Bad Request
        http_response_code(400);
        echo json_encode(array(
            "success" => false,
            "message" => "La password attuale non è corretta."
        ));
    }
} catch (Exception $e) {
    // Log the error
    error_log("Change Password Error: " . $e->getMessage());

    // Return error response
    http_response_code(500);
    echo json_encode(array(
        "success" => false,
        "message" => "Si è verificato un errore durante il cambio password."
    ));
}
