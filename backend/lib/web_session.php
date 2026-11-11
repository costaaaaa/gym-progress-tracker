<?php
// Sessione web (cookie PHPSESSID): si apre solo quando serve.
//  - senza cookie di sessione non esiste nessuna sessione, nessun file e nessun Set-Cookie;
//  - la sessione nasce al login (web_session_login) e porta sempre un utente;
//  - con "remember" il cookie dura 30 giorni dal login, altrimenti finisce con la chiusura del browser;
//  - una sessione senza utente viene distrutta e il suo cookie cancellato.
// Il client mobile usa il token Bearer e non passa di qui.

const WEB_SESSION_LIFETIME = 30 * 24 * 60 * 60;

function web_session_is_https()
{
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && strtolower($_SERVER['HTTP_X_FORWARDED_PROTO']) === 'https');
}

// Attributi comuni del cookie di sessione.
function web_session_cookie_attributes()
{
    return array(
        'path' => '/',
        'secure' => web_session_is_https(),
        'httponly' => true,
        'samesite' => 'Lax',
    );
}

// Attributi comuni più la scadenza, per il cookie che scriviamo noi; $expires = 0 significa cookie
// che finisce con il browser.
function web_session_cookie_with_expiry($expires)
{
    return array('expires' => $expires) + web_session_cookie_attributes();
}

// Impostazioni da dare prima di session_start(): inattività massima lato server di 30 giorni per tutte
// le sessioni. lifetime 0 al posto della durata impostata nel php.ini: così, davanti a un cookie
// valido, PHP non ne accoda uno di rinnovo. Quando invece PHP accoda il suo (id nuovo), non arriva mai
// al browser così com'è: lo sostituisce web_session_send_cookie() o lo cancella
// web_session_clear_cookie().
function web_session_configure()
{
    ini_set('session.gc_maxlifetime', (string)WEB_SESSION_LIFETIME);
    session_set_cookie_params(array('lifetime' => 0) + web_session_cookie_attributes());
}

// Toglie dalla risposta ogni Set-Cookie del cookie di sessione (anche quelli che PHP ha già accodato).
function web_session_drop_cookie_headers()
{
    $prefix = strtolower(session_name()) . '=';
    $kept = array();
    foreach (headers_list() as $line) {
        if (stripos($line, 'Set-Cookie:') !== 0) {
            continue;
        }
        if (strpos(strtolower(ltrim(substr($line, strlen('Set-Cookie:')))), $prefix) !== 0) {
            $kept[] = $line;
        }
    }
    header_remove('Set-Cookie');
    foreach ($kept as $line) {
        header($line, false);
    }
}

// Un solo Set-Cookie per il cookie di sessione, con la scadenza voluta (0 = fino alla chiusura del browser).
function web_session_send_cookie($expires)
{
    web_session_drop_cookie_headers();
    setcookie(session_name(), session_id(), web_session_cookie_with_expiry($expires));
}

// Cancella il cookie nel browser, con gli stessi attributi con cui è stato creato.
function web_session_clear_cookie()
{
    web_session_drop_cookie_headers();
    setcookie(session_name(), '', web_session_cookie_with_expiry(1));
}

// Chiude la sessione (il file sparisce) e cancella il cookie. Senza sessione né cookie non fa nulla.
function web_session_end()
{
    $had_cookie = isset($_COOKIE[session_name()]);
    if (session_status() === PHP_SESSION_ACTIVE) {
        $_SESSION = array();
        session_destroy();
        $had_cookie = true;
    }
    if ($had_cookie) {
        web_session_clear_cookie();
    }
}

// Apre la sessione solo se la richiesta porta il cookie. Se dentro non c'è un utente (o i dati sono
// incoerenti) la chiude subito: non si riapre una sessione vuota.
function web_session_open_if_present()
{
    if (session_status() !== PHP_SESSION_NONE || !isset($_COOKIE[session_name()])) {
        return;
    }
    web_session_configure();
    session_start();
    if (empty($_SESSION['user_id']) || empty($_SESSION['username'])) {
        web_session_end();
    }
}

// Apre la sessione di un utente appena autenticato, con un id nuovo. $remember vero: il cookie scade
// fra 30 giorni; la scadenza resta nella sessione per quando l'id viene rigenerato.
function web_session_login($user_id, $username, $remember)
{
    if (session_status() === PHP_SESSION_NONE) {
        web_session_configure();
        session_start();
    }
    session_regenerate_id(true);
    $_SESSION = array(
        'user_id' => $user_id,
        'username' => $username,
        'auth_at' => time(),
    );
    $expires = 0;
    if ($remember) {
        $expires = time() + WEB_SESSION_LIFETIME;
        $_SESSION['cookie_expires'] = $expires;
    }
    web_session_send_cookie($expires);
}

// Nuovo id per la sessione in corso, con la stessa scadenza assoluta del cookie di prima.
// Una sessione aperta prima che la scelta venisse ricordata non ha una scadenza: il cookie nuovo
// finisce con la chiusura del browser, come se non avesse mai scelto i 30 giorni.
function web_session_regenerate()
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        return;
    }
    session_regenerate_id(true);
    $_SESSION['auth_at'] = time();
    web_session_send_cookie((int)($_SESSION['cookie_expires'] ?? 0));
}
