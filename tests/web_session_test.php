<?php
// Sessione web (backend/lib/web_session.php): nessuna sessione senza cookie, durata del cookie scelta
// al login, un solo Set-Cookie, cookie cancellato alla chiusura, controllo dell'origine.
// Si lancia con tests/web_session.sh. Esce con 1 se un controllo fallisce.

$fails = 0;
$checks = 0;
function check($desc, $cond)
{
    global $fails, $checks;
    $checks++;
    if ($cond) {
        echo "  \033[32m✓\033[0m $desc\n";
    } else {
        $fails++;
        echo "  \033[31m✗\033[0m $desc\n";
    }
}

$dir = sys_get_temp_dir() . '/web_session_test_' . getmypid();
mkdir($dir . '/sessions', 0700, true);
$port = 18000 + getmypid() % 1000;
$server = proc_open(
    array(PHP_BINARY, '-S', "127.0.0.1:$port", '-d', "session.save_path=$dir/sessions", '-d', 'error_reporting=-1', '-d', 'log_errors=1', __DIR__ . '/web_session_server.php'),
    array(0 => array('file', '/dev/null', 'r'), 1 => array('file', "$dir/server.log", 'w'), 2 => array('file', "$dir/server.log", 'w')),
    $pipes
);
register_shutdown_function(function () use ($server, $dir) {
    proc_terminate($server);
    exec('rm -rf ' . escapeshellarg($dir));
});
for ($i = 0; $i < 50 && !@fsockopen('127.0.0.1', $port); $i++) {
    usleep(100000);
}

// Richiesta GET: ritorna [corpo JSON, righe Set-Cookie del cookie di sessione, tutte le righe Set-Cookie]
function request($path, $headers = array())
{
    global $port;
    $ctx = stream_context_create(array('http' => array('method' => 'GET', 'header' => implode("\r\n", $headers), 'ignore_errors' => true)));
    $body = file_get_contents("http://127.0.0.1:$port$path", false, $ctx);
    $cookies = array();
    foreach ($http_response_header ?? array() as $line) {
        if (stripos($line, 'Set-Cookie:') === 0) {
            $cookies[] = trim(substr($line, 11));
        }
    }
    $session = array_values(array_filter($cookies, fn($c) => strpos($c, 'PHPSESSID=') === 0));
    preg_match('/^HTTP\/\S+ (\d+)/', $http_response_header[0] ?? '', $m);
    return array(json_decode($body, true), $session, $cookies, (int)($m[1] ?? 0));
}

function session_files()
{
    global $dir;
    return glob("$dir/sessions/sess_*") ?: array();
}

function cookie_id($line)
{
    preg_match('/^PHPSESSID=([^;]*)/', $line, $m);
    return $m[1] ?? '';
}

function cookie_expiry($line)
{
    return preg_match('/expires=([^;]+)/i', $line, $m) ? strtotime($m[1]) : null;
}

function is_deleted($line)
{
    return cookie_id($line) === 'deleted' || (cookie_id($line) === '' && preg_match('/max-age=0/i', $line));
}

echo "Richiesta anonima\n";
[$body, $session, $cookies] = request('/whoami');
check('nessun Set-Cookie', count($cookies) === 0);
check('nessun file di sessione', count(session_files()) === 0);
check('nessuna sessione aperta', $body['session_active'] === false);

echo "Cookie di sessione sconosciuto\n";
[$body, $session, $cookies] = request('/whoami', array('Cookie: PHPSESSID=abcdefabcdefabcdefabcdefabcdefab'));
check('un solo Set-Cookie, e cancella il cookie', count($cookies) === 1 && count($session) === 1 && is_deleted($session[0]));
check('il cookie cancellato ha gli stessi attributi (path, HttpOnly, SameSite)', stripos($session[0], 'path=/') !== false && stripos($session[0], 'httponly') !== false && stripos($session[0], 'samesite=Lax') !== false);
check('nessun file di sessione resta', count(session_files()) === 0);
check('nessun utente', $body['user_id'] === null);

echo "Cookie di sessione con formato non valido\n";
[$body, $session, $cookies] = request('/whoami', array('Cookie: PHPSESSID=%3Cx%3E'));
check('un solo Set-Cookie, e cancella il cookie', count($cookies) === 1 && is_deleted($session[0] ?? ''));
check('nessun file di sessione resta', count(session_files()) === 0);

echo "Accesso con Resta collegato\n";
[$body, $session, $cookies] = request('/login?remember=1');
check('un solo Set-Cookie', count($cookies) === 1 && count($session) === 1);
check('utente riconosciuto', $body['user_id'] === 7);
$expiry = cookie_expiry($session[0]);
check('scadenza a 30 giorni dal login', $expiry !== null && abs($expiry - (time() + 30 * 86400)) < 10);
check('HttpOnly, SameSite=Lax, path=/', stripos($session[0], 'httponly') !== false && stripos($session[0], 'samesite=Lax') !== false && stripos($session[0], 'path=/') !== false);
check('non Secure su http', stripos($session[0], 'secure') === false);
[, $https] = request('/login?remember=1', array('X-Forwarded-Proto: https'));
check('Secure dietro HTTPS', stripos($https[0] ?? '', '; secure') !== false);
request('/logout', array('Cookie: PHPSESSID=' . cookie_id($https[0] ?? '')));
check('un file di sessione', count(session_files()) === 1);
$id = cookie_id($session[0]);
$remember_expiry = $expiry;

echo "Richieste successive con il cookie valido\n";
[$body, $session, $cookies] = request('/whoami', array("Cookie: PHPSESSID=$id"));
check('utente riconosciuto', $body['user_id'] === 7);
check('nessun nuovo Set-Cookie', count($cookies) === 0);

echo "Id rigenerato (cambio password)\n";
[$body, $session, $cookies] = request('/regenerate', array("Cookie: PHPSESSID=$id"));
check('un solo Set-Cookie', count($cookies) === 1 && count($session) === 1);
check('nuovo id', cookie_id($session[0]) !== '' && cookie_id($session[0]) !== $id);
check('stessa scadenza assoluta', cookie_expiry($session[0]) === $remember_expiry);
check('un solo file di sessione', count(session_files()) === 1);
check('il vecchio id non vale più', request('/whoami', array("Cookie: PHPSESSID=$id"))[0]['user_id'] === null);
$id = cookie_id($session[0]);
check('il nuovo vale', request('/whoami', array("Cookie: PHPSESSID=$id"))[0]['user_id'] === 7);

echo "Chiusura\n";
[$body, $session, $cookies] = request('/logout', array("Cookie: PHPSESSID=$id"));
check('un solo Set-Cookie, e cancella il cookie', count($cookies) === 1 && is_deleted($session[0] ?? ''));
check('attributi uguali a quelli di creazione', stripos($session[0], 'path=/') !== false && stripos($session[0], 'httponly') !== false && stripos($session[0], 'samesite=Lax') !== false);
check('il file di sessione sparisce', count(session_files()) === 0);
check('chiusura senza cookie: nessun Set-Cookie', count(request('/logout')[2]) === 0);

echo "Accesso senza Resta collegato\n";
[$body, $session, $cookies] = request('/login?remember=0');
check('un solo Set-Cookie', count($cookies) === 1 && count($session) === 1);
check('nessun Expires né Max-Age', stripos($session[0], 'expires') === false && stripos($session[0], 'max-age') === false);
check('HttpOnly, SameSite=Lax, path=/', stripos($session[0], 'httponly') !== false && stripos($session[0], 'samesite=Lax') !== false && stripos($session[0], 'path=/') !== false);
$id = cookie_id($session[0]);
[$body, $session, $cookies] = request('/regenerate', array("Cookie: PHPSESSID=$id"));
check('id rigenerato: un solo Set-Cookie, ancora senza scadenza', count($cookies) === 1 && stripos($session[0], 'expires') === false && stripos($session[0], 'max-age') === false);
check('id rigenerato: nuovo id', cookie_id($session[0]) !== $id);
$id = cookie_id($session[0]);

echo "Nuovo accesso con una sessione già aperta\n";
[$body, $session, $cookies] = request('/login?remember=1', array("Cookie: PHPSESSID=$id"));
check('un solo Set-Cookie, con scadenza', count($cookies) === 1 && cookie_expiry($session[0]) !== null);
check('id diverso dal precedente', cookie_id($session[0]) !== $id);
check('un solo file di sessione', count(session_files()) === 1);
request('/logout', array('Cookie: PHPSESSID=' . cookie_id($session[0])));

echo "Cookie di una sessione senza utente\n";
file_put_contents("$dir/sessions/sess_00000000000000000000000000000001", 'prova|s:1:"x";');
[$body, $session, $cookies] = request('/whoami', array('Cookie: PHPSESSID=00000000000000000000000000000001'));
check('un solo Set-Cookie, e cancella il cookie', count($cookies) === 1 && is_deleted($session[0] ?? ''));
check('il file sparisce', count(session_files()) === 0);
file_put_contents("$dir/sessions/sess_00000000000000000000000000000002", 'user_id|i:5;');
[$body, $session, $cookies] = request('/whoami', array('Cookie: PHPSESSID=00000000000000000000000000000002'));
check('utente senza nome: sessione chiusa, cookie cancellato', count($cookies) === 1 && is_deleted($session[0] ?? '') && $body['user_id'] === null);
check('il file sparisce', count(session_files()) === 0);

echo "Header Bearer\n";
[$body, $session, $cookies] = request('/whoami', array('Authorization: Bearer ' . str_repeat('a', 64)));
check('nessuna sessione, nessun Set-Cookie', $body['session_active'] === false && count($cookies) === 0);
[$body, $session, $cookies] = request('/whoami', array('Authorization: Bearer ' . str_repeat('a', 64), 'Cookie: PHPSESSID=abcdefabcdefabcdefabcdefabcdefab'));
check('anche con un cookie: nessuna sessione, nessun Set-Cookie', $body['session_active'] === false && count($cookies) === 0);
check('nessun file di sessione', count(session_files()) === 0);

echo "Origine della richiesta di accesso\n";
[, , , $status] = request('/login?remember=0', array('Origin: https://origine-estranea.example'));
check('origine estranea: 403', $status === 403);
[$body, $session, $cookies] = request('/login?remember=0', array('Origin: https://origine-estranea.example'));
check('origine estranea: nessun cookie, nessun file di sessione', count($cookies) === 0 && count(session_files()) === 0);
[, $session, $cookies, $status] = request('/login?remember=0', array('Origin: https://liftindex.app'));
check('origine consentita: 200 e cookie', $status === 200 && count($session) === 1);
request('/logout', array('Cookie: PHPSESSID=' . cookie_id($session[0])));
[, $session, $cookies, $status] = request('/login?remember=0');
check('senza Origin: 200 e cookie', $status === 200 && count($session) === 1);

echo "Avvisi del server\n";
$log = (string)@file_get_contents("$dir/server.log");
preg_match_all('/^.*(Warning|Notice|Deprecated|Fatal).*$/mi', $log, $problems);
check('nessun Warning, Notice, Deprecated o Fatal in nessun passo', count($problems[0]) === 0);
foreach (array_slice(array_unique($problems[0]), 0, 3) as $line) {
    echo "      $line\n";
}

echo "\n" . ($checks - $fails) . "/$checks controlli riusciti\n";
exit($fails > 0 ? 1 : 0);
