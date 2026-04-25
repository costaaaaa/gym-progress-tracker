<?php
// Include common CORS headers
include_once '../../config/cors_headers.php';

include_once '../../config/database.php';
include_once '../../models/User.php';

// La sessione è già gestita in cors_headers.php

try {
    $database = new Database();
    $db = $database->getConnection();

    if (!$db) {
        throw new Exception("Impossibile stabilire una connessione al database.");
    }

    $user = new User($db);

    $user_id = isset($_SESSION['user_id']) ? $_SESSION['user_id'] : null;

    if (!$user_id) {
        http_response_code(401);
        echo json_encode(array('success' => false, 'message' => 'Utente non autenticato'));
        exit;
    }

    if ($user->readById($user_id)) {
        echo json_encode(array(
            'success' => true,
            'id' => $user->id,
            'username' => $user->username,
            'email' => $user->email,
            'created_at' => $user->created_at,
            'rest_timer_enabled' => $user->rest_timer_enabled
        ));
    } else {
        http_response_code(404);
        echo json_encode(array('success' => false, 'message' => 'Utente non trovato'));
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(array(
        'success' => false,
        'message' => 'Errore del server: ' . $e->getMessage()
    ));
}