<?php
// Primo passo della registrazione: dice se username ed email sono già in uso, prima di chiedere
// il profilo. Come quasi tutti i servizi pubblici rivela se un'email è registrata: il limite per IP
// rallenta chi prova indirizzi in massa. register.php ripete comunque gli stessi controlli.
include_once '../../config/cors_headers.php';

include_once '../../config/database.php';
include_once '../../config/rate_limiter.php';
include_once '../../config/api_helpers.php';
include_once '../../models/User.php';

try {
    $data = json_decode(file_get_contents("php://input"));
    if (!is_object($data)) {
        http_response_code(400);
        echo json_encode(array("success" => false, "message" => t_server('register.incomplete')));
        exit;
    }

    $database = new Database();
    $db = $database->getConnection();

    $limiter = rate_limiter($db);
    $ip = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : 'unknown';
    $key = 'check:ip:' . hash('sha256', $ip);
    list($max, $decay) = rate_limit_rule('check_ip');
    if ($limiter->tooManyAttempts($key, $max)) {
        $retryAfter = $limiter->availableIn($key);
        header('Retry-After: ' . $retryAfter);
        http_response_code(429);
        echo json_encode(array("success" => false, "message" => t_server('check.too_many', array('seconds' => $retryAfter))));
        exit;
    }
    $limiter->hit($key, $decay);

    // Stesse regole di register.php: un valore non valido non si controlla (null)
    $user = new User($db);
    $usernameTaken = null;
    if (isset($data->username) && is_string($data->username) && preg_match('/^[a-zA-Z0-9]{3,50}$/', $data->username)) {
        $user->username = $data->username;
        $usernameTaken = $user->usernameExists();
    }
    $emailTaken = null;
    if (isset($data->email) && is_string($data->email) && filter_var(trim($data->email), FILTER_VALIDATE_EMAIL)) {
        $user->email = strtolower(trim($data->email));
        $emailTaken = $user->emailExists();
    }

    http_response_code(200);
    echo json_encode(array("success" => true, "username_taken" => $usernameTaken, "email_taken" => $emailTaken));
} catch (Exception $e) {
    error_log("Check availability error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(array("success" => false, "message" => t_server('register.error')));
}
