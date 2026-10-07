<?php
// Controllo delle credenziali con limite di tentativi, in comune tra il login web (sessione,
// user/login.php) e quello mobile (token, user/mobile_login.php): nessuno dei due ha un percorso
// più permissivo dell'altro.

include_once __DIR__ . '/../config/api_helpers.php';
include_once __DIR__ . '/../config/rate_limiter.php';
include_once __DIR__ . '/../models/User.php';

// Verifica username e password di una richiesta di login. Se mancano i dati risponde 400, se i
// tentativi sono troppi 429, se le credenziali sono errate 401 (e termina). Se vanno bene ritorna
// lo User, con id e username valorizzati.
function authenticate_login_request($db, $data)
{
    $user = new User($db);
    $limiter = rate_limiter($db);

    if (
        empty($data) || !isset($data->username) || !isset($data->password) ||
        empty($data->username) || empty($data->password)
    ) {
        api_json_response(array(
            "success" => false,
            "message" => "Username and password are required."
        ), 400);
    }

    // Due contatori: per IP e per coppia IP+utente
    $ip = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : 'unknown';
    $ipKey = 'login:ip:' . hash('sha256', $ip);
    $userKey = 'login:user:' . hash('sha256', $ip . '|' . strtolower($data->username));

    list($ipMax, $ipDecay) = rate_limit_rule('login_ip');
    list($userMax, $userDecay) = rate_limit_rule('login_user');

    if ($limiter->tooManyAttempts($ipKey, $ipMax) || $limiter->tooManyAttempts($userKey, $userMax)) {
        $retryAfter = max($limiter->availableIn($ipKey), $limiter->availableIn($userKey));
        header('Retry-After: ' . $retryAfter);
        api_json_response(array(
            "success" => false,
            "message" => "Troppi tentativi di accesso. Riprova tra " . $retryAfter . " secondi."
        ), 429);
    }

    $user->username = $data->username;
    $user->password = $data->password;

    if (!$user->login()) {
        $limiter->hit($ipKey, $ipDecay);
        $limiter->hit($userKey, $userDecay);
        api_json_response(array(
            "success" => false,
            "message" => "Invalid username or password."
        ), 401);
    }

    // Accesso riuscito: azzera il contatore del bersaglio specifico
    $limiter->clear($userKey);
    return $user;
}
