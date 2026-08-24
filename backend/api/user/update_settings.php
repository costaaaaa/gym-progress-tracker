<?php
// Include common CORS headers
include_once '../../config/cors_headers.php';

// Include database e modelli
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
    echo json_encode(['success' => false, 'message' => 'Utente non autenticato']);
    exit;
}

// Solo richieste POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Metodo non consentito']);
    exit;
}

try {
    // Recupera i dati inviati
    $data = json_decode(file_get_contents("php://input"));

    if (!$data || !isset($data->rest_timer_enabled)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Dati mancanti: rest_timer_enabled è obbligatorio']);
        exit;
    }

    // Crea un'istanza del modello User
    $user = new User($db);
    $user->id = $user_id;

    // Aggiorna le impostazioni
    $rest_timer_enabled = (bool)$data->rest_timer_enabled;
    $birth_date = isset($data->birth_date) ? $data->birth_date : null;
    $gender = isset($data->gender) ? $data->gender : null;
    $training_start_date = isset($data->training_start_date) ? $data->training_start_date : null;

    if ($user->updateProfile($rest_timer_enabled, $birth_date, $gender, $training_start_date)) {
        http_response_code(200);
        echo json_encode([
            'success' => true,
            'message' => 'Profilo aggiornato con successo',
            'rest_timer_enabled' => $rest_timer_enabled,
            'birth_date' => $birth_date,
            'gender' => $gender,
            'training_start_date' => $training_start_date,
            'age' => $user->age,
            'experience_years' => $user->experience_years
        ]);
    } else {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Errore durante l\'aggiornamento delle impostazioni'
        ]);
    }
} catch (Exception $e) {
    error_log("Error in update_settings.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Errore durante l\'aggiornamento delle impostazioni'
    ]);
}
