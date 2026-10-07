<?php
// Include common CORS headers
include_once '../../config/cors_headers.php';

include_once '../../config/database.php';
include_once '../../config/api_helpers.php';
include_once '../../models/User.php';

try {
    $database = new Database();
    $db = $database->getConnection();

    if (!$db) {
        throw new Exception("Impossibile stabilire una connessione al database.");
    }

    $user = new User($db);

    $user_id = require_authenticated_user($db);

    if ($user->readById($user_id)) {
        echo json_encode(array(
            'success' => true,
            'id' => $user->id,
            'username' => $user->username,
            'email' => $user->email,
            'created_at' => $user->created_at,
            'rest_timer_enabled' => $user->rest_timer_enabled,
            'age' => $user->age,
            'birth_date' => $user->birth_date,
            'gender' => $user->gender,
            'training_start_date' => $user->training_start_date,
            'locale' => $user->locale,
            'experience_years' => $user->experience_years,
            'password_changed_at' => $user->password_changed_at,
            'is_admin' => user_is_admin($db, $user_id),
            'features' => user_features($db, $user_id)
        ));
    } else {
        http_response_code(404);
        echo json_encode(array('success' => false, 'message' => 'Utente non trovato'));
    }
} catch (Exception $e) {
    error_log("Read User Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(array(
        'success' => false,
        'message' => 'Errore del server.'
    ));
}
