<?php
// Limite di tentativi sulla password attuale, in comune tra cambio password (user/change_password.php)
// e cancellazione dell'account (user/delete.php): un solo contatore per account, così chi ha rubato un
// token non può provare le password da un endpoint e poi dall'altro.

include_once __DIR__ . '/../config/api_helpers.php';
include_once __DIR__ . '/../config/rate_limiter.php';

function password_check_key($user_id)
{
    return 'password:user:' . (int)$user_id;
}

// Risponde 429 (e termina) se l'account ha già esaurito i tentativi.
function password_check_guard($db, $user_id)
{
    $limiter = rate_limiter($db);
    $key = password_check_key($user_id);
    list($max) = rate_limit_rule('password_check_user');
    if ($limiter->tooManyAttempts($key, $max)) {
        $retryAfter = $limiter->availableIn($key);
        header('Retry-After: ' . $retryAfter);
        api_json_response(array(
            "success" => false,
            "message" => t_server('auth.too_many_password', array('seconds' => $retryAfter))
        ), 429);
    }
}

function password_check_failed($db, $user_id)
{
    list(, $decay) = rate_limit_rule('password_check_user');
    rate_limiter($db)->hit(password_check_key($user_id), $decay);
}

function password_check_ok($db, $user_id)
{
    rate_limiter($db)->clear(password_check_key($user_id));
}
