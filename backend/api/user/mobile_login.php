<?php
// Login per client mobile (React Native): stessa validazione credenziali e stesso rate
// limiting di login.php, ma risponde con un token Bearer invece di creare una sessione.
include_once '../../config/cors_headers.php';

include_once '../../config/database.php';
include_once '../../config/rate_limiter.php';
include_once '../../models/User.php';
include_once '../../models/ApiToken.php';

try {
    // Get posted data
    $raw_data = file_get_contents("php://input");
    if (!$raw_data) {
        throw new Exception("No data provided");
    }

    $data = json_decode($raw_data);
    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new Exception("Invalid JSON format: " . json_last_error_msg());
    }

    // Get database connection
    $database = new Database();
    $db = $database->getConnection();

    // Instantiate user object
    $user = new User($db);

    // Rate limiter (stesse soglie di login.php: nessun percorso più permissivo per il mobile)
    $limiter = rate_limiter($db);

    // Make sure data is not empty and properties are defined
    if (
        !empty($data) && isset($data->username) && isset($data->password) &&
        !empty($data->username) && !empty($data->password)
    ) {

        // Chiavi di throttling per questo tentativo
        $ip = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : 'unknown';
        $ipKey = 'login:ip:' . $ip;
        $userKey = 'login:user:' . $ip . '|' . strtolower($data->username);

        list($ipMax, $ipDecay) = rate_limit_rule('login_ip');
        list($userMax, $userDecay) = rate_limit_rule('login_user');

        // Blocca se una delle due soglie è già superata
        if ($limiter->tooManyAttempts($ipKey, $ipMax) || $limiter->tooManyAttempts($userKey, $userMax)) {
            $retryAfter = max($limiter->availableIn($ipKey), $limiter->availableIn($userKey));
            header('Retry-After: ' . $retryAfter);
            http_response_code(429);
            echo json_encode(array(
                "success" => false,
                "message" => "Troppi tentativi di accesso. Riprova tra " . $retryAfter . " secondi."
            ));
            exit;
        }

        // Set user property values
        $user->username = $data->username;
        $user->password = $data->password;

        // Attempt to login
        if ($user->login()) {
            // Accesso riuscito: azzera il contatore del bersaglio specifico
            $limiter->clear($userKey);

            // Crea il token Bearer al posto della sessione
            $device_info = isset($data->device_info) ? substr((string)$data->device_info, 0, 255) : null;
            $api_token = new ApiToken($db);
            $token_result = $api_token->create($user->id, $device_info);

            if (!$token_result) {
                throw new Exception("Impossibile generare il token di accesso.");
            }

            // Return success response
            http_response_code(200);
            echo json_encode(array(
                "success" => true,
                "message" => "Login successful.",
                "token" => $token_result['token'],
                "expires_at" => $token_result['expires_at'],
                "user" => array(
                    "id" => $user->id,
                    "username" => $user->username
                )
            ));
        } else {
            // Tentativo fallito: incrementa entrambi i contatori
            $limiter->hit($ipKey, $ipDecay);
            $limiter->hit($userKey, $userDecay);

            // Set response code - 401 Unauthorized
            http_response_code(401);
            echo json_encode(array(
                "success" => false,
                "message" => "Invalid username or password."
            ));
        }
    } else {
        // Set response code - 400 Bad Request
        http_response_code(400);
        echo json_encode(array(
            "success" => false,
            "message" => "Username and password are required."
        ));
    }
} catch (Exception $e) {
    // Log the error
    error_log("Mobile Login Error: " . $e->getMessage());

    // Return error response
    http_response_code(500);
    echo json_encode(array(
        "success" => false,
        "message" => "An error occurred during login."
    ));
}
