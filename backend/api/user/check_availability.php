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
        echo json_encode(array("success" => false, "message" => t_server('common.invalid_request')));
        exit;
    }

    // Si controlla solo un valore valido (gli altri restano null): stesse regole di register.php
    $username = (isset($data->username) && is_string($data->username) && preg_match(User::USERNAME_PATTERN, $data->username))
        ? $data->username : null;
    $email = (isset($data->email) && is_string($data->email) && filter_var(trim($data->email), FILTER_VALIDATE_EMAIL))
        ? strtolower(trim($data->email)) : null;
    if ($username === null && $email === null) {
        http_response_code(200);
        echo json_encode(array("success" => true, "username_taken" => null, "email_taken" => null));
        exit;
    }

    $database = new Database();
    $db = $database->getConnection();

    $limiter = rate_limiter($db);
    $key = client_ip_key('check');
    list($max, $decay) = rate_limit_rule('check_ip');
    if ($limiter->tooManyAttempts($key, $max)) {
        $retryAfter = $limiter->availableIn($key);
        header('Retry-After: ' . $retryAfter);
        http_response_code(429);
        echo json_encode(array("success" => false, "message" => t_server('register.check_too_many', array('seconds' => $retryAfter))));
        exit;
    }
    $limiter->hit($key, $decay);

    $user = new User($db);
    $usernameTaken = null;
    if ($username !== null) {
        $user->username = $username;
        $usernameTaken = $user->usernameExists();
    }
    $emailTaken = null;
    if ($email !== null) {
        $user->email = $email;
        $emailTaken = $user->emailExists();
    }

    http_response_code(200);
    echo json_encode(array("success" => true, "username_taken" => $usernameTaken, "email_taken" => $emailTaken));
} catch (Exception $e) {
    error_log("Check availability error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(array("success" => false, "message" => t_server('common.error_retry')));
}
