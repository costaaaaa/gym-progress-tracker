<?php
// Include common CORS headers
include_once '../../config/cors_headers.php';

// Include database and models
include_once '../../config/database.php';
include_once '../../models/User.php';

// Start session
session_start();

// Verifica se l'utente è autenticato
if (!isset($_SESSION['user_id'])) {
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

    // Inizializza la connessione al database
    $database = new Database();
    $db = $database->getConnection();

    // Crea un'istanza del modello User
    $user = new User($db);
    $user->id = $_SESSION['user_id'];

    // Aggiorna le impostazioni
    $rest_timer_enabled = (bool)$data->rest_timer_enabled;
    $age = isset($data->age) ? intval($data->age) : null;
    $gender = isset($data->gender) ? $data->gender : null;
    $experience_years = isset($data->experience_years) ? floatval($data->experience_years) : null;

    if ($user->updateProfile($rest_timer_enabled, $age, $gender, $experience_years)) {
        http_response_code(200);
        echo json_encode([
            'success' => true,
            'message' => 'Profilo aggiornato con successo',
            'rest_timer_enabled' => $rest_timer_enabled,
            'age' => $age,
            'gender' => $gender,
            'experience_years' => $experience_years
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
        'message' => 'Errore durante l\'aggiornamento delle impostazioni',
        'error' => $e->getMessage()
    ]);
}
