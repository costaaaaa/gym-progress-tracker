<?php
// Logout per client mobile (React Native): revoca il token Bearer invece di distruggere
// una sessione (il client mobile non ne ha mai avuta una).
include_once '../../config/cors_headers.php';

include_once '../../config/database.php';
include_once '../../models/ApiToken.php';

try {
    $auth_header = $_SERVER['HTTP_AUTHORIZATION'] ?? null;
    if (!$auth_header || stripos($auth_header, 'Bearer ') !== 0) {
        http_response_code(401);
        echo json_encode(array("success" => false, "message" => "Token mancante."));
        exit;
    }

    $plain_token = trim(substr($auth_header, 7));

    $database = new Database();
    $db = $database->getConnection();

    $api_token = new ApiToken($db);
    $api_token->revoke($plain_token);

    // Idempotente: risponde 200 anche se il token era già scaduto/revocato/inesistente,
    // l'esito per il client è comunque "non più autenticato".
    http_response_code(200);
    echo json_encode(array("success" => true, "message" => "Logout effettuato con successo."));
} catch (Exception $e) {
    error_log("Mobile Logout Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(array("success" => false, "message" => "Errore durante il logout."));
}
