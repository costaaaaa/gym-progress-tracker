<?php
include_once '../../config/cors_headers.php';

// Include database e modelli
include_once '../../config/database.php';
include_once '../../config/api_helpers.php';
include_once '../../models/User.php';

$database = new Database();
$db = $database->getConnection();

$user_id = require_authenticated_user($db);

// Solo richieste POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => t_server('common.method_not_allowed')]);
    exit;
}

try {
    // Recupera i dati inviati
    $data = json_decode(file_get_contents("php://input"));

    if (!$data || !is_object($data)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => t_server('common.missing_data')]);
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
            echo json_encode(['success' => false, 'message' => t_server('register.gender_required')]);
            exit;
        }
        $fields['gender'] = $data->gender;
    }
    if (property_exists($data, 'training_start_date')) {
        $tsd = $data->training_start_date;
        $error = training_start_date_error($tsd);
        if ($error !== null) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => $error]);
            exit;
        }
        $fields['training_start_date'] = ($tsd === null || $tsd === '') ? null : $tsd;
    }
    if (property_exists($data, 'locale')) {
        if (!is_string($data->locale) || !in_array($data->locale, SUPPORTED_LOCALES, true)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => t_server('settings.locale_invalid')]);
            exit;
        }
        $fields['locale'] = $data->locale;
    }
    if (empty($fields)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => t_server('settings.no_fields')]);
        exit;
    }

    // Crea un'istanza del modello User
    $user = new User($db);
    $user->id = $user_id;

    if ($user->updateProfile($fields)) {
        request_locale(true);
        http_response_code(200);
        echo json_encode([
            'success' => true,
            'message' => t_server('settings.updated'),
            'rest_timer_enabled' => $user->rest_timer_enabled,
            'birth_date' => $user->birth_date,
            'gender' => $user->gender,
            'training_start_date' => $user->training_start_date,
            'locale' => $user->locale,
            'age' => $user->age,
            'experience_years' => $user->experience_years
        ]);
    } else {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => t_server('settings.update_error')
        ]);
    }
} catch (Exception $e) {
    error_log("Error in update_settings.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => t_server('settings.update_error')
    ]);
}
