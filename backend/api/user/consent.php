<?php
// Consensi dell'utente autenticato.
//   GET                                    -> stato di ogni finalita' (granted, versione, data)
//   POST {purpose, action: grant|revoke}   -> concede o revoca. Revocare health_data cancella
//                                             le misure corporee (l'export va proposto prima).
include_once '../../config/cors_headers.php';
include_once '../../config/database.php';
include_once '../../config/api_helpers.php';
include_once '../../models/Consent.php';

$database = new Database();
$db = $database->getConnection();

$user_id = resolve_authenticated_user_id($db);
if (!$user_id) {
    api_json_response(array('success' => false, 'message' => 'Utente non autenticato'), 401);
}

try {
    $consent = new Consent($db);

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        api_json_response(array('success' => true, 'consents' => $consent->status($user_id)));
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        api_json_response(array('success' => false, 'message' => 'Metodo non consentito'), 405);
    }

    $data = json_decode(file_get_contents('php://input'));
    $purpose = (is_object($data) && isset($data->purpose)) ? $data->purpose : null;
    $action = (is_object($data) && isset($data->action)) ? $data->action : null;

    if (!Consent::isKnownPurpose($purpose) || !in_array($action, array('grant', 'revoke'), true)) {
        api_json_response(array('success' => false, 'message' => 'Richiesta non valida'), 400);
    }

    if ($action === 'grant') {
        $consent->grant($user_id, $purpose);
        api_json_response(array('success' => true, 'consents' => $consent->status($user_id)));
    }

    if (!in_array($purpose, Consent::REVOCABLE, true)) {
        api_json_response(array(
            'success' => false,
            'message' => 'Questo consenso non si può revocare: per ritirarlo elimina l\'account.'
        ), 400);
    }
    $deleted = $consent->revoke($user_id, $purpose);
    api_json_response(array(
        'success' => true,
        'deleted_stats' => $deleted,
        'consents' => $consent->status($user_id)
    ));
} catch (Exception $e) {
    error_log('Consent error: ' . $e->getMessage());
    api_json_response(array('success' => false, 'message' => 'Errore durante l\'operazione'), 500);
}
