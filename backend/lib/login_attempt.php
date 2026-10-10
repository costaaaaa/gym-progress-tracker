<?php
// Controllo delle credenziali con limite di tentativi, in comune tra il login web (sessione,
// user/login.php) e quello mobile (token, user/mobile_login.php): nessuno dei due ha un percorso
// più permissivo dell'altro.

include_once __DIR__ . '/../config/api_helpers.php';
include_once __DIR__ . '/../config/rate_limiter.php';
include_once __DIR__ . '/../models/User.php';

// Verifica username e password di una richiesta di login. Se mancano i dati risponde 400, se i
// tentativi sono troppi 429, se le credenziali sono errate 401 (e termina). Se vanno bene ritorna
// lo User, con id e username valorizzati; la lingua dell'account la dà request_locale().
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
            "message" => t_server('auth.missing_credentials')
        ), 400);
    }

    // Tre contatori: per IP, per coppia IP+utente e per utente da qualunque IP (brute force
    // distribuito). trim: MySQL ignora gli spazi finali nel confronto dello username.
    $ip = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : 'unknown';
    $username = strtolower(trim($data->username));
    $ipKey = 'login:ip:' . hash('sha256', $ip);
    $userKey = 'login:user:' . hash('sha256', $ip . '|' . $username);
    $accountKey = 'login:acct:' . hash('sha256', $username);

    list($ipMax, $ipDecay) = rate_limit_rule('login_ip');
    list($userMax, $userDecay) = rate_limit_rule('login_user');
    list($accountMax, $accountDecay) = rate_limit_rule('login_account');

    if (
        $limiter->tooManyAttempts($ipKey, $ipMax) ||
        $limiter->tooManyAttempts($userKey, $userMax) ||
        $limiter->tooManyAttempts($accountKey, $accountMax)
    ) {
        $retryAfter = max($limiter->availableIn($ipKey), $limiter->availableIn($userKey), $limiter->availableIn($accountKey));
        header('Retry-After: ' . $retryAfter);
        api_json_response(array(
            "success" => false,
            "message" => t_server('auth.too_many_logins', array('seconds' => $retryAfter))
        ), 429);
    }

    $user->username = $data->username;
    $user->password = $data->password;

    if (!$user->login()) {
        $limiter->hit($ipKey, $ipDecay);
        $limiter->hit($userKey, $userDecay);
        $limiter->hit($accountKey, $accountDecay);
        api_json_response(array(
            "success" => false,
            "message" => t_server('auth.invalid_credentials')
        ), 401);
    }

    // Accesso riuscito: azzera il contatore del bersaglio specifico. Da qui la lingua della
    // richiesta è quella dell'account.
    $limiter->clear($userKey);
    $limiter->clear($accountKey);
    request_user_context($db, $user->id);
    return $user;
}
