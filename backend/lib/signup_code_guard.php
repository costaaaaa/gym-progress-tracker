<?php
// Parte comune di register.php e check_availability.php per il codice di registrazione: il limite per IP sui
// codici NON utilizzabili (conta solo i fallimenti) e la risposta d'errore, la stessa nei due endpoint.
// Errori: 400 signup_code_invalid (inesistente, spento o malformato: stesso messaggio), 400
// signup_code_expired, 409 signup_code_exhausted, tutti con field "signup_code"; 429 rate_limited con
// retry_after dopo 10 codici non utilizzabili in un'ora dallo stesso IP.
require_once __DIR__ . '/../models/SignupCode.php';

// Il campo facoltativo "signup_code" del corpo: null se manca o è vuoto (solo spazi compresi), altrimenti il valore
// così com'è (stringa o altro: la normalizzazione decide)
function signup_code_field($data)
{
    if (!is_object($data) || !isset($data->signup_code) || $data->signup_code === null) {
        return null;
    }
    if (is_string($data->signup_code) && trim($data->signup_code) === '') {
        return null;
    }
    return $data->signup_code;
}

// 429 se l'IP ha già fatto troppi codici non utilizzabili. Ritorna la chiave e la regola per signup_code_fail().
function signup_code_rate_guard($limiter)
{
    $key = client_ip_key('signupcode');
    list($max, $decay) = rate_limit_rule('signup_code_ip');
    if ($limiter->tooManyAttempts($key, $max)) {
        $retryAfter = $limiter->availableIn($key);
        header('Retry-After: ' . $retryAfter);
        api_error(429, 'rate_limited', t_server('signup_code.too_many', array('seconds' => $retryAfter)),
            array('retry_after' => $retryAfter, 'field' => 'signup_code'));
    }
    return array($key, $decay);
}

// Conta il fallimento e risponde con l'errore ($status: invalid, expired o exhausted). Non ritorna.
function signup_code_fail($limiter, $guard, $status)
{
    $limiter->hit($guard[0], $guard[1]);
    $map = array(
        'expired' => array(400, 'signup_code_expired', 'signup_code.expired'),
        'exhausted' => array(409, 'signup_code_exhausted', 'signup_code.exhausted'),
    );
    list($http, $code, $key) = $map[$status] ?? array(400, 'signup_code_invalid', 'signup_code.invalid');
    api_error($http, $code, t_server($key), array('field' => 'signup_code'));
}
