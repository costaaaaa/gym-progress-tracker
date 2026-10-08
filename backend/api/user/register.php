<?php
include_once '../../config/cors_headers.php';

include_once '../../config/database.php';
include_once '../../config/rate_limiter.php';
include_once '../../config/api_helpers.php';
include_once '../../lib/password_policy.php';
include_once '../../models/Consent.php';
include_once '../../models/User.php';

try {
    $raw_data = file_get_contents("php://input");
    if (!$raw_data) {
        throw new Exception("No data provided");
    }

    $data = json_decode($raw_data);
    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new Exception("Invalid JSON format: " . json_last_error_msg());
    }

    $database = new Database();
    $db = $database->getConnection();

    $user = new User($db);

    // Rate limiter (DB-backed, swappable a Redis)
    $limiter = rate_limiter($db);

    // Make sure data is not empty and contains all required fields
    if (
        !empty($data) &&
        isset($data->username) && isset($data->email) && isset($data->password) &&
        !empty($data->username) && !empty($data->email) && !empty($data->password)
    ) {
        // Throttling per-IP: anti registrazioni di massa
        $ip = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : 'unknown';
        $regKey = 'register:ip:' . hash('sha256', $ip);
        list($regMax, $regDecay) = rate_limit_rule('register_ip');

        if ($limiter->tooManyAttempts($regKey, $regMax)) {
            $retryAfter = $limiter->availableIn($regKey);
            header('Retry-After: ' . $retryAfter);
            http_response_code(429);
            echo json_encode(array(
                "success" => false,
                "message" => t_server('register.too_many', array('seconds' => $retryAfter))
            ));
            exit;
        }

        // Conta questo tentativo di registrazione
        $limiter->hit($regKey, $regDecay);

        // Stesse regole di User::validateInputs(), ma con un messaggio preciso: altrimenti
        // create() fallisce e l'utente legge "nome utente o email gia' in uso".
        if (!is_string($data->username) || !preg_match('/^[a-zA-Z0-9]{3,50}$/', $data->username)) {
            http_response_code(400);
            echo json_encode(array("success" => false, "message" => t_server('register.username_invalid')));
            exit;
        }
        if (!is_string($data->email) || !filter_var($data->email, FILTER_VALIDATE_EMAIL)) {
            http_response_code(400);
            echo json_encode(array("success" => false, "message" => t_server('common.email_invalid')));
            exit;
        }

        $passwordError = password_policy_error($data->password);
        if ($passwordError !== null) {
            http_response_code(400);
            echo json_encode(array("success" => false, "message" => $passwordError));
            exit;
        }

        // Data di nascita obbligatoria e valida (eta' minima 14 anni) e sesso scelto dall'utente.
        $birthError = birth_date_error(isset($data->birth_date) ? $data->birth_date : null);
        if ($birthError !== null) {
            http_response_code(400);
            echo json_encode(array("success" => false, "message" => $birthError));
            exit;
        }
        if (!isset($data->gender) || !valid_gender($data->gender)) {
            http_response_code(400);
            echo json_encode(array("success" => false, "message" => t_server('register.gender_required')));
            exit;
        }

        // Termini d'uso e informativa privacy vanno accettati esplicitamente
        if (!isset($data->accept_terms) || $data->accept_terms !== true) {
            http_response_code(400);
            echo json_encode(array("success" => false, "message" => t_server('register.terms_required')));
            exit;
        }

        $user->username = $data->username;
        $user->email = $data->email;
        $user->password = $data->password;
        $user->birth_date = $data->birth_date;
        $user->gender = $data->gender;
        $tsd = isset($data->training_start_date) ? $data->training_start_date : null;
        $tsdError = training_start_date_error($tsd);
        if ($tsdError !== null) {
            http_response_code(400);
            echo json_encode(array("success" => false, "message" => $tsdError));
            exit;
        }
        $user->training_start_date = ($tsd === '') ? null : $tsd;
        $user->locale = normalize_locale(isset($data->locale) ? $data->locale : null) ?: 'it';

        // Create the user
        if ($user->create()) {
            (new Consent($db))->grant((int)$user->id, 'terms');
            http_response_code(201);
            echo json_encode(array(
                "success" => true,
                "message" => t_server('register.ok')
            ));
        } else {
            http_response_code(400);
            echo json_encode(array(
                "success" => false,
                "message" => t_server('register.failed')
            ));
        }
    } else {
        http_response_code(400);
        echo json_encode(array(
            "success" => false,
            "message" => t_server('register.incomplete')
        ));
    }
} catch (Exception $e) {
    error_log("Registration Error: " . $e->getMessage());

    http_response_code(500);
    echo json_encode(array(
        "success" => false,
        "message" => t_server('register.error')
    ));
}
