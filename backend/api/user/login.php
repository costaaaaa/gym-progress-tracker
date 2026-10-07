<?php
include_once '../../config/cors_headers.php';

include_once '../../config/database.php';
include_once '../../config/rate_limiter.php';
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

    if (
        !empty($data) && isset($data->username) && isset($data->password) &&
        !empty($data->username) && !empty($data->password)
    ) {

        // Chiavi di throttling per questo tentativo
        $ip = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : 'unknown';
        $ipKey = 'login:ip:' . hash('sha256', $ip);
        $userKey = 'login:user:' . hash('sha256', $ip . '|' . strtolower($data->username));

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

        $user->username = $data->username;
        $user->password = $data->password;

        // Attempt to login
        if ($user->login()) {
            // Accesso riuscito: azzera il contatore del bersaglio specifico
            $limiter->clear($userKey);

            // Create session
            if (session_status() === PHP_SESSION_NONE) {
                session_start();
            }
            // Nuovo id di sessione a ogni login (contro il session fixation); auth_at serve a
            // invalidare la sessione se la password cambia dopo l'accesso
            session_regenerate_id(true);
            $_SESSION['user_id'] = $user->id;
            $_SESSION['username'] = $user->username;
            $_SESSION['auth_at'] = time();

            http_response_code(200);
            echo json_encode(array(
                "success" => true,
                "message" => "Login successful.",
                "user" => array(
                    "id" => $user->id,
                    "username" => $user->username
                )
            ));
        } else {
            // Tentativo fallito: incrementa entrambi i contatori
            $limiter->hit($ipKey, $ipDecay);
            $limiter->hit($userKey, $userDecay);

            http_response_code(401);
            echo json_encode(array(
                "success" => false,
                "message" => "Invalid username or password."
            ));
        }
    } else {
        http_response_code(400);
        echo json_encode(array(
            "success" => false,
            "message" => "Username and password are required."
        ));
    }
} catch (Exception $e) {
    error_log("Login Error: " . $e->getMessage());

    http_response_code(500);
    echo json_encode(array(
        "success" => false,
        "message" => "An error occurred during login."
    ));
}
