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

    if (!$data || !is_object($data)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Dati mancanti']);
        exit;
    }

    // Aggiornamento parziale: si modificano solo i campi presenti nella richiesta.
    $fields = [];
    if (isset($data->rest_timer_enabled)) {
        $fields['rest_timer_enabled'] = (bool)$data->rest_timer_enabled;
    }
    // Data di nascita e sesso non si possono svuotare: se presenti devono essere validi.
    if (property_exists($data, 'birth_date')) {
        $error = birth_date_error($data->birth_date);
        if ($error !== null) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => $error]);
            exit;
        }
        $fields['birth_date'] = $data->birth_date;
    }
    if (property_exists($data, 'gender')) {
        if (!valid_gender($data->gender)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Seleziona il sesso.']);
            exit;
        }
        $fields['gender'] = $data->gender;
    }
    if (property_exists($data, 'training_start_date')) {
        $tsd = $data->training_start_date;
        if ($tsd !== null && $tsd !== '') {
            $d = is_string($tsd) ? DateTime::createFromFormat('!Y-m-d', $tsd) : false;
            if (!$d || $d->format('Y-m-d') !== $tsd || $d > new DateTime('today')) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Data di inizio allenamento non valida.']);
                exit;
            }
            $fields['training_start_date'] = $tsd;
        } else {
            $fields['training_start_date'] = null;
        }
    }
    if (empty($fields)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Nessun campo da aggiornare']);
        exit;
    }

    // Crea un'istanza del modello User
    $user = new User($db);
    $user->id = $user_id;

    if ($user->updateProfile($fields)) {
        http_response_code(200);
        echo json_encode([
            'success' => true,
            'message' => 'Profilo aggiornato con successo',
            'rest_timer_enabled' => $user->rest_timer_enabled,
            'birth_date' => $user->birth_date,
            'gender' => $user->gender,
            'training_start_date' => $user->training_start_date,
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
