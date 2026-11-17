<?php
// Eseguito da tests/email_verify.sh (serve un database con lo schema del repo).
// Argomenti: cartella backend da provare, fase.
//
// Verifica dell'email, lato server: avvia il server integrato di PHP sul backend (più una seconda copia con
// altre variabili d'ambiente) e chiama gli endpoint veri, con sessione web e con token Bearer. I codici si
// leggono dal log delle email (MAIL_DRIVER=log). Le date si spostano con SQL diretto.
$backend = $argv[1];
require $backend . '/config/database.php';
require __DIR__ . '/lib/http_test.php';
require_once $backend . '/lib/email_verification_rules.php';
require_once $backend . '/models/EmailVerification.php';

const PASSWORD = 'Prova!Verifica2026';
const PORT_A = 8099;  // MAIL_DRIVER=log
const PORT_B = 8098;  // MAIL_DRIVER=brevo senza chiave (l'email non parte) e un limite per IP basso sui codici
const LOG_A = '/tmp/ev-a.log';
const LOG_B = '/tmp/ev-b.log';

// Limiti per IP alti: tutte le richieste vengono da 127.0.0.1
foreach (['RL_REGISTER_MAX', 'RL_LOGIN_IP_MAX', 'RL_LOGIN_USER_MAX', 'RL_LOGIN_ACCOUNT_MAX', 'RL_FORGOT_IP_MAX', 'RL_RESET_IP_MAX', 'RL_CHECK_IP_MAX', 'RL_EMAIL_CODE_IP_MAX'] as $v) {
    putenv("$v=1000");
}
putenv('MAIL_DRIVER=log');
putenv('APP_PUBLIC_URL=https://liftindex.test');

function startServer($backend, $port, $log, array $env)
{
    $server = proc_open(['php', '-S', "127.0.0.1:$port", '-t', $backend],
        [0 => ['file', '/dev/null', 'r'], 1 => ['file', '/dev/null', 'w'], 2 => ['file', $log, 'w']], $pipes, null, $env + getenv());
    register_shutdown_function(function () use ($server) {
        proc_terminate($server);
    });
    for ($i = 0; $i < 50; $i++) {
        $sock = @fsockopen('127.0.0.1', $port);
        if ($sock) { fclose($sock); break; }
        usleep(100000);
    }
}
startServer($backend, PORT_A, LOG_A, []);
startServer($backend, PORT_B, LOG_B, ['MAIL_DRIVER' => 'brevo', 'MAIL_API_KEY' => '', 'RL_EMAIL_CODE_IP_MAX' => '3']);

$conn = (new Database())->getConnection();

function sql($query, $params = [])
{
    global $conn;
    $stmt = $conn->prepare($query);
    $stmt->execute($params);
    return $stmt;
}
function scalar($query, $params = [])
{
    return sql($query, $params)->fetchColumn();
}

// Chiamata HTTP. $auth: null, ['bearer' => token] o ['cookie' => 'PHPSESSID=...'].
// Ritorna [codice, JSON decodificato, corpo grezzo, header della risposta]
function api($method, $path, $auth = null, $body = null, $port = PORT_A, $extra = [])
{
    $headers = "Content-Type: application/json\r\n";
    if ($auth && isset($auth['bearer'])) $headers .= "Authorization: Bearer {$auth['bearer']}\r\n";
    if ($auth && isset($auth['cookie'])) $headers .= "Cookie: {$auth['cookie']}\r\n";
    foreach ($extra as $h) $headers .= "$h\r\n";
    $context = stream_context_create(['http' => [
        'method' => $method, 'header' => $headers, 'ignore_errors' => true, 'timeout' => 30,
        'content' => $body === null ? '' : json_encode($body),
    ]]);
    $raw = file_get_contents("http://127.0.0.1:$port$path", false, $context);
    $responseHeaders = function_exists('http_get_last_response_headers') ? http_get_last_response_headers() : ($http_response_header ?? []);
    $code = 0;
    if (isset($responseHeaders[0]) && preg_match('/ (\d{3})/', $responseHeaders[0], $m)) $code = (int)$m[1];
    return [$code, json_decode((string)$raw, true), (string)$raw, $responseHeaders ?: []];
}

function register($name, $email = null, $locale = 'it', $port = PORT_A, $extra = [])
{
    return api('POST', '/api/user/register.php', null, [
        'username' => $name, 'email' => $email ?? "$name@example.test", 'password' => PASSWORD,
        'birth_date' => '1990-01-01', 'gender' => 'M', 'accept_terms' => true, 'locale' => $locale,
    ], $port, $extra);
}
function bearer($name, $port = PORT_A)
{
    $r = api('POST', '/api/user/mobile_login.php', null, ['username' => $name, 'password' => PASSWORD], $port);
    return ['bearer' => $r[1]['token'] ?? ''];
}
function webSession($name)
{
    $r = api('POST', '/api/user/login.php', null, ['username' => $name, 'password' => PASSWORD]);
    foreach ($r[3] as $h) {
        if (stripos($h, 'Set-Cookie:') === 0 && preg_match('/(PHPSESSID=[^;]+)/', $h, $m)) return ['cookie' => $m[1]];
    }
    return ['cookie' => ''];
}
function userId($name)
{
    return (int)scalar("SELECT id FROM gym_users WHERE username = ?", [$name]);
}
// Registra un account e ritorna [id, token Bearer]
function newAccount($name, $locale = 'it', $email = null)
{
    $r = register($name, $email, $locale);
    if ($r[0] !== 201) echo "      registrazione di $name: {$r[0]} {$r[2]}\n";
    return [userId($name), bearer($name)];
}
function agedAccount($name, $days)
{
    [$id, $auth] = newAccount($name);
    sql("UPDATE gym_users SET created_at = DATE_SUB(NOW(), INTERVAL $days DAY) WHERE id = ?", [$id]);
    return [$id, $auth];
}
// Fa passare più di 2 minuti dall'ultimo invio (sposta indietro tutti i codici dell'utente)
function age($id, $minutes = 3)
{
    sql("UPDATE gym_email_codes SET created_at = DATE_SUB(created_at, INTERVAL $minutes MINUTE), expires_at = DATE_ADD(expires_at, INTERVAL 0 MINUTE) WHERE user_id = ?", [$id]);
}

// Email nel log del server: [['to', 'subject', 'body'], ...]. Il log di PHP antepone [data] a ogni riga scritta.
function mails($to, $log = LOG_A)
{
    $text = (string)@file_get_contents($log);
    $out = [];
    $parts = preg_split('/^\[[A-Z][a-z]{2} [A-Z][a-z]{2} +\d+ [\d:]+ \d{4}\] /m', $text);
    foreach ($parts as $p) {
        if (preg_match('/^\[mail:log\] a=(\S+) oggetto="([^"]*)"\n(.*)$/s', $p, $m) && $m[1] === $to) {
            $out[] = ['to' => $m[1], 'subject' => $m[2], 'body' => $m[3]];
        }
    }
    return $out;
}
// Aspetta (al massimo 3 s) che le email a $to siano almeno $n
function waitMails($to, $n, $log = LOG_A)
{
    for ($i = 0; $i < 30; $i++) {
        if (count(mails($to, $log)) >= $n) break;
        usleep(100000);
    }
    return mails($to, $log);
}
function codeOf(array $mail)
{
    return preg_match('/\n(\d{6})\n/', $mail['body'], $m) ? $m[1] : null;
}
// Ultimo codice mandato a $to (aspetta che ci siano almeno $n email)
function lastCode($to, $n = 1)
{
    $all = waitMails($to, $n);
    return $all ? codeOf(end($all)) : null;
}
function otherThan($code)
{
    return $code === '123456' ? '654321' : '123456';
}
function verifyViaDb($id)
{
    sql("UPDATE gym_users SET email_verified_at = NOW() WHERE id = ?", [$id]);
}
function rowCount($table, $where = '1=1', $params = [])
{
    return (int)scalar("SELECT COUNT(*) FROM $table WHERE $where", $params);
}

// Cartella degli endpoint e insiemi noti
function apiFiles($dir, $base = '')
{
    $out = [];
    foreach (scandir($dir) as $f) {
        if ($f === '.' || $f === '..') continue;
        if (is_dir("$dir/$f")) $out = array_merge($out, apiFiles("$dir/$f", "$base$f/"));
        elseif (substr($f, -4) === '.php' && $f[0] !== '_') $out[] = "$base$f";
    }
    sort($out);
    return $out;
}

// ═══ Registrazione ═══════════════════════════════════════════════════════════════════════════════
echo "Registrazione\n";
$r = register('evstd');
check('registrazione: 201', $r[0] === 201, $r[2]);
$evstdId = userId('evstd');
$m = waitMails('evstd@example.test', 1);
check('parte esattamente un\'email, con un codice di 6 cifre', count($m) === 1 && codeOf($m[0]) !== null, json_encode($m));
$code = codeOf($m[0]);
check('l\'email dice che vale 30 minuti e come comportarsi se non è stato lui',
    strpos($m[0]['body'], 'Vale 30 minuti') !== false && strpos($m[0]['body'], 'Non ti sei registrato tu? Ignora questa email: l\'account verrà eliminato.') !== false);
check('l\'email ha il piè di pagina e nessun link', strpos($m[0]['body'], 'Informativa privacy') !== false && strpos($m[0]['body'], 'http') !== false && !preg_match('#https?://\S*(code|token)#', $m[0]['body']));
check('oggetto in italiano', $m[0]['subject'] === 'Il tuo codice per confermare l\'email');
check('account non confermato', scalar("SELECT email_verified_at FROM gym_users WHERE id = ?", [$evstdId]) === null);
check('nel database solo l\'hash sha256("<id>:<codice>")',
    scalar("SELECT code_hash FROM gym_email_codes WHERE user_id = ?", [$evstdId]) === hash('sha256', "$evstdId:$code")
    && scalar("SELECT COUNT(*) FROM gym_email_codes WHERE code_hash = ?", [$code]) == 0);
$read = api('GET', '/api/user/read.php', $evstdAuth = bearer('evstd'));
check('read.php: non confermata, 7 giorni, non bloccata, nessun cambio in attesa',
    $read[0] === 200 && $read[1]['email_verified'] === false && $read[1]['email_verification']['days_left'] === 7
    && $read[1]['email_verification']['blocked'] === false && $read[1]['pending_email'] === null, $read[2]);
$expectedDeadline = gmdate('Y-m-d\TH:i:s\Z', (int)scalar("SELECT UNIX_TIMESTAMP(created_at) + 604800 FROM gym_users WHERE id = ?", [$evstdId]));
check('read.php: deadline = registrazione + 7 giorni, istante UTC ISO 8601', $read[1]['email_verification']['deadline'] === $expectedDeadline, $read[2]);
check('l\'account appena registrato usa l\'app (endpoint normale 200)', api('GET', '/api/workout/read_plans.php', $evstdAuth)[0] === 200);

$r = register('evdupl', 'evstd@example.test');
check('email già in uso: 409 con field=email e il suggerimento "Password dimenticata"',
    $r[0] === 409 && $r[1]['field'] === 'email' && strpos($r[1]['message'], 'Se è il tuo indirizzo, usa "Password dimenticata"') !== false, $r[2]);
$r = register('evdupl', 'evstd@example.test', 'en', PORT_A, ['X-Locale: en']);
check('email già in uso, inglese: suggerimento in inglese', $r[0] === 409 && strpos($r[1]['message'], 'use "Forgot password"') !== false, $r[2]);
check('nessuna email ai due tentativi respinti', count(mails('evstd@example.test')) === 1);

$r = register('evengl', null, 'en');
$m = waitMails('evengl@example.test', 1);
check('account inglese: email in inglese', $r[0] === 201 && count($m) === 1 && $m[0]['subject'] === 'Your code to confirm your email'
    && strpos($m[0]['body'], 'It is valid for 30 minutes') !== false && strpos($m[0]['body'], 'Privacy policy') !== false, json_encode($m));

$r = register('evnomail', null, 'it', PORT_B);
check('se l\'email non parte la registrazione riesce lo stesso (e l\'account non è confermato)',
    $r[0] === 201 && scalar("SELECT email_verified_at FROM gym_users WHERE username = 'evnomail'") === null, $r[2]);
$mailPartita = false;
for ($i = 0; $i < 20 && !$mailPartita; $i++) { usleep(100000); $mailPartita = rowCount('gym_email_codes', 'user_id = ?', [userId('evnomail')]) === 1; }
check('il codice è comunque nel database', $mailPartita);

// ═══ Conferma con il codice ═══════════════════════════════════════════════════════════════════════
echo "Conferma\n";
$r = api('POST', '/api/user/confirm_email.php', $evstdAuth, ['code' => 'abc']);
check('codice malformato: 400 email_code_format', $r[0] === 400 && $r[1]['code'] === 'email_code_format', $r[2]);
check('il codice malformato non consuma tentativi', (int)scalar("SELECT attempts FROM gym_email_codes WHERE user_id = ?", [$evstdId]) === 0);
$r = api('GET', '/api/user/confirm_email.php', $evstdAuth);
check('metodo sbagliato: 405', $r[0] === 405);
$r = api('POST', '/api/user/confirm_email.php', null, ['code' => $code]);
check('senza autenticazione: 401', $r[0] === 401);

$wrong = otherThan($code);
$left = [];
for ($i = 0; $i < 5; $i++) {
    $r = api('POST', '/api/user/confirm_email.php', $evstdAuth, ['code' => $wrong]);
    $left[] = [$r[0], $r[1]['code'] ?? null, $r[1]['attempts_left'] ?? null];
}
check('codice sbagliato: 400 email_code_wrong con i tentativi rimasti 4, 3, 2, 1, 0',
    $left === [[400, 'email_code_wrong', 4], [400, 'email_code_wrong', 3], [400, 'email_code_wrong', 2], [400, 'email_code_wrong', 1], [400, 'email_code_wrong', 0]], json_encode($left));
check('i tentativi sbagliati restano scritti', (int)scalar("SELECT attempts FROM gym_email_codes WHERE user_id = ?", [$evstdId]) === 5);
$r = api('POST', '/api/user/confirm_email.php', $evstdAuth, ['code' => $code]);
check('al quinto errore il codice muore: anche quello giusto dà 400 email_code_expired (codice diverso)',
    $r[0] === 400 && $r[1]['code'] === 'email_code_expired', $r[2]);
check('l\'account non è confermato', scalar("SELECT email_verified_at FROM gym_users WHERE id = ?", [$evstdId]) === null);

// Reinvio: limiti
$r = api('POST', '/api/user/resend_email_code.php', $evstdAuth);
check('reinvio subito dopo la registrazione: 429 con i secondi da attendere e Retry-After',
    $r[0] === 429 && $r[1]['code'] === 'email_resend_wait' && $r[1]['retry_after'] > 0 && $r[1]['retry_after'] <= 120
    && count(array_filter($r[3], fn($h) => stripos($h, 'Retry-After:') === 0)) === 1, $r[2]);
age($evstdId);
$r = api('POST', '/api/user/resend_email_code.php', $evstdAuth);
check('reinvio dopo 3 minuti: 200', $r[0] === 200 && $r[1]['success'] === true, $r[2]);
$code2 = lastCode('evstd@example.test', 2);
check('arriva un codice nuovo (seconda email)', count(mails('evstd@example.test')) === 2 && $code2 !== null);
check('un codice nuovo annulla il vecchio: una sola riga attiva, il vecchio è usato',
    rowCount('gym_email_codes', 'user_id = ? AND used_at IS NULL', [$evstdId]) === 1 && rowCount('gym_email_codes', 'user_id = ?', [$evstdId]) === 2);
if ($code2 !== $code) {
    $r = api('POST', '/api/user/confirm_email.php', $evstdAuth, ['code' => $code]);
    check('il codice vecchio non vale più (400 email_code_wrong)', $r[0] === 400 && $r[1]['code'] === 'email_code_wrong' && $r[1]['attempts_left'] === 4, $r[2]);
}
// il giusto
$r = api('POST', '/api/user/confirm_email.php', $evstdAuth, ['code' => $code2]);
check('codice giusto: 200 e email confermata', $r[0] === 200 && $r[1]['email_verified'] === true && $r[1]['email'] === 'evstd@example.test', $r[2]);
check('email_verified_at scritto, avvisi azzerati', scalar("SELECT email_verified_at FROM gym_users WHERE id = ?", [$evstdId]) !== null
    && (int)scalar("SELECT unverified_notice_stage FROM gym_users WHERE id = ?", [$evstdId]) === 0);
$r = api('POST', '/api/user/confirm_email.php', $evstdAuth, ['code' => $code2]);
check('secondo uso dello stesso codice: rifiutato (409 email_already_verified)', $r[0] === 409 && $r[1]['code'] === 'email_already_verified', $r[2]);
$read = api('GET', '/api/user/read.php', $evstdAuth);
check('read.php dopo la conferma: email_verified true, email_verification null', $read[1]['email_verified'] === true && $read[1]['email_verification'] === null && $read[1]['pending_email'] === null, $read[2]);
$r = api('POST', '/api/user/resend_email_code.php', $evstdAuth);
check('reinvio a un account confermato: 409 email_already_verified', $r[0] === 409 && $r[1]['code'] === 'email_already_verified', $r[2]);

// Codice scaduto
[$expId, $expAuth] = newAccount('evexp');
$expCode = lastCode('evexp@example.test');
sql("UPDATE gym_email_codes SET expires_at = DATE_SUB(NOW(), INTERVAL 1 MINUTE) WHERE user_id = ?", [$expId]);
$r = api('POST', '/api/user/confirm_email.php', $expAuth, ['code' => $expCode]);
check('codice scaduto: 400 email_code_expired', $r[0] === 400 && $r[1]['code'] === 'email_code_expired', $r[2]);
sql("UPDATE gym_email_codes SET expires_at = DATE_ADD(NOW(), INTERVAL 29 MINUTE) WHERE user_id = ?", [$expId]);
$r = api('POST', '/api/user/confirm_email.php', $expAuth, ['code' => $expCode]);
check('un codice che scade fra 29 minuti vale ancora (200)', $r[0] === 200, $r[2]);

// Limiti di reinvio all'ora
[$limId, $limAuth] = newAccount('evlimit');
$seq = [];
for ($i = 0; $i < 4; $i++) {
    age($limId, 3);
    $seq[] = api('POST', '/api/user/resend_email_code.php', $limAuth)[0];
}
check('quattro reinvii a distanza di 3 minuti (con quello della registrazione sono 5): 200', $seq === [200, 200, 200, 200], json_encode($seq));
age($limId, 3);
$r = api('POST', '/api/user/resend_email_code.php', $limAuth);
check('il sesto invio nell\'ora: 429 con attesa lunga (limite orario), non i 2 minuti', $r[0] === 429 && $r[1]['retry_after'] > 120, $r[2]);
check('e non ha mandato nessuna email', count(waitMails('evlimit@example.test', 5)) === 5 && count(mails('evlimit@example.test')) === 5);
age($limId, 61);
$r = api('POST', '/api/user/resend_email_code.php', $limAuth);
check('passata un\'ora dagli invii vecchi: si può di nuovo', $r[0] === 200, $r[2]);

// Limite per IP sui codici sbagliati (server B: 3)
[$ipId, $ipAuth] = newAccount('evipl');
sql("DELETE FROM gym_rate_limits WHERE rate_key LIKE 'emailcode:%'"); // il contatore per IP è nel database, in comune con il server A
$codes = [];
for ($i = 0; $i < 4; $i++) {
    $r = api('POST', '/api/user/confirm_email.php', $ipAuth, ['code' => '000000'], PORT_B);
    $codes[] = $r[0];
}
check('tre codici sbagliati dallo stesso IP, il quarto: 429 rate_limited con Retry-After',
    $codes === [400, 400, 400, 429], json_encode($codes));

// ═══ Blocco dal giorno 8 ═════════════════════════════════════════════════════════════════════════
echo "Blocco dal giorno 8\n";
[$bId, $bAuth] = agedAccount('evblock', 8);
$bCookie = webSession('evblock');
check('il login funziona anche per l\'account bloccato (sessione e token)', $bCookie['cookie'] !== '' && $bAuth['bearer'] !== '');
foreach (['Bearer' => $bAuth, 'sessione web' => $bCookie] as $label => $auth) {
    $r = api('GET', '/api/workout/read_plans.php', $auth);
    check("endpoint normale con $label: 403 email_unverified (mai 401)", $r[0] === 403 && $r[1]['code'] === 'email_unverified' && $r[1]['success'] === false && !empty($r[1]['message']), $r[2]);
    $r = api('POST', '/api/workout/create_plan.php', $auth, ['name' => 'Nope']);
    check("scrittura con $label: 403 email_unverified", $r[0] === 403 && $r[1]['code'] === 'email_unverified', $r[2]);
}
check('nessuna scheda è stata creata', rowCount('gym_workout_plans', 'user_id = ?', [$bId]) === 0);
$r = api('GET', '/api/admin/tiers.php?q=ab', $bAuth);
check('admin/* segue la regola generale: 403 email_unverified', $r[0] === 403 && $r[1]['code'] === 'email_unverified', $r[2]);
$r = api('GET', '/api/workout/read_plans.php', $bAuth, null, PORT_A, ['X-Locale: en']);
check('il messaggio del blocco è nella lingua dell\'account (italiano)', strpos($r[1]['message'], 'Conferma la tua email') === 0, $r[2]);
$timeline = api('GET', '/api/user/read.php', $bAuth);
check('read.php: 200 anche da bloccato, blocked true e 0 giorni',
    $timeline[0] === 200 && $timeline[1]['email_verification']['blocked'] === true && $timeline[1]['email_verification']['days_left'] === 0 && $timeline[1]['email_verified'] === false, $timeline[2]);
$timelineWeb = api('GET', '/api/user/read.php', $bCookie);
check('read.php: 200 anche da bloccato con sessione web', $timelineWeb[0] === 200 && $timelineWeb[1]['email_verification']['blocked'] === true, $timelineWeb[2]);
$ex = api('GET', '/api/user/export.php', $bAuth);
check('export.php: 200 da bloccato, con email_verified_at (null) e pending_email nel profilo',
    $ex[0] === 200 && array_key_exists('email_verified_at', $ex[1]['profile']) && $ex[1]['profile']['email_verified_at'] === null && array_key_exists('pending_email', $ex[1]['profile']), substr($ex[2], 0, 300));
$ml = api('POST', '/api/user/mobile_logout.php', bearer('evblock'));
check('mobile_logout.php funziona da bloccato (200)', $ml[0] === 200, $ml[2]);
$lg = api('POST', '/api/user/logout.php', $bCookie);
check('logout.php funziona da bloccato (200)', $lg[0] === 200, $lg[2]);
$bAuth = bearer('evblock');
$bCookie = webSession('evblock');

// Il test che scorre gli endpoint: ogni endpoint autenticato non ammesso risponde 403 email_unverified
$public = ['user/register.php', 'user/login.php', 'user/mobile_login.php', 'user/forgot_password.php', 'user/reset_password.php',
    'user/check_availability.php', 'user/logout.php', 'user/mobile_logout.php'];
$allowedExpected = ['user/read.php', 'user/confirm_email.php', 'user/resend_email_code.php', 'user/change_email.php',
    'user/cancel_email_change.php', 'user/export.php', 'user/delete.php'];
$files = apiFiles($backend . '/api');
// Gli ammessi sono l'elenco qui sopra (non il testo dei file): ognuno risponde da bloccato, con Bearer e con sessione web,
// con la sua risposta e mai con 403 email_unverified né 401; ogni altro endpoint autenticato dà 403 (giro qui sotto).
check('gli endpoint ammessi esistono tutti', count(array_intersect($allowedExpected, $files)) === count($allowedExpected), json_encode(array_diff($allowedExpected, $files)));
foreach (['Bearer' => $bAuth, 'sessione web' => $bCookie] as $via => $auth) {
    $notBlocked = fn($r) => $r[0] !== 401 && ($r[1]['code'] ?? '') !== 'email_unverified';
    $r = api('POST', '/api/user/change_email.php', $auth, ['email' => 'evblock-nuovo@example.test', 'password' => 'sbagliata-di-sicuro']);
    check("change_email.php da bloccato ($via): password sbagliata 400 wrong_password, non 403", $r[0] === 400 && ($r[1]['code'] ?? '') === 'wrong_password', $r[2]);
    $r = api('POST', '/api/user/cancel_email_change.php', $auth);
    check("cancel_email_change.php da bloccato ($via): 200", $r[0] === 200 && $r[1]['success'] === true, $r[2]);
    $r = api('POST', '/api/user/confirm_email.php', $auth, ['code' => '000000']);
    check("confirm_email.php da bloccato ($via): risposta propria (400/409), non 403", in_array($r[0], [400, 409], true) && $notBlocked($r), $r[2]);
    $r = api('POST', '/api/user/resend_email_code.php', $auth);
    check("resend_email_code.php da bloccato ($via): 200 o 429, non 403", in_array($r[0], [200, 429], true) && $notBlocked($r), $r[2]);
    $r = api('POST', '/api/user/delete.php', $auth, ['password' => 'sbagliata-di-sicuro']);
    check("delete.php da bloccato ($via): arriva alla verifica della password, non 403", $r[0] !== 403 && $notBlocked($r), $r[2]);
    $r = api('GET', '/api/user/read.php', $auth);
    check("read.php da bloccato ($via): 200", $r[0] === 200, $r[2]);
    $r = api('GET', '/api/user/export.php', $auth);
    check("export.php da bloccato ($via): 200", $r[0] === 200, substr($r[2], 0, 200));
}
// GET e POST, con ?name=abc (esercizi simili legge il nome prima di autenticare). Per ogni endpoint ogni risposta
// deve essere 403 email_unverified, o 405 se il metodo non è quello dell'endpoint, e almeno una deve essere 403:
// mai 2xx, mai 401, mai un endpoint che lasci passare.
$scanned = 0;
$bad = [];
foreach ($files as $f) {
    if (in_array($f, $public, true) || in_array($f, $allowedExpected, true)) continue;
    $blocked = false;
    foreach (['GET', 'POST'] as $method) {
        $r = api($method, "/api/$f?name=abc", $bAuth, $method === 'POST' ? ['x' => 1] : null);
        $scanned++;
        if ($r[0] === 403 && ($r[1]['code'] ?? null) === 'email_unverified') $blocked = true;
        elseif ($r[0] !== 405) $bad[] = "$method $f -> {$r[0]}";
    }
    if (!$blocked) $bad[] = "$f non blocca";
}
check("tutti gli endpoint autenticati non ammessi bloccano un account al giorno 8: 403 email_unverified ($scanned richieste, mai 2xx né 401)", $scanned > 60 && !$bad, json_encode($bad));
check('l\'elenco scorre anche i sottodirectory (admin, groups, workout...)', count(array_filter($files, fn($f) => strpos($f, 'admin/') === 0)) >= 3 && count(array_filter($files, fn($f) => strpos($f, 'groups/') === 0)) >= 5);

// Ammessi: con il codice dal giorno 8 tutto riparte
$r = api('POST', '/api/user/resend_email_code.php', $bAuth);
check('reinvio da bloccato: 429 (appena registrato) o 200, mai 403 né 401', in_array($r[0], [200, 429], true) && ($r[1]['code'] ?? '') !== 'email_unverified', $r[2]);
age($bId);
$r = api('POST', '/api/user/resend_email_code.php', $bAuth);
check('reinvio da bloccato dopo 3 minuti: 200', $r[0] === 200, $r[2]);
$bCode = lastCode('evblock@example.test', 2);
$r = api('POST', '/api/user/confirm_email.php', $bCookie, ['code' => $bCode]);
check('conferma da bloccato (sessione web): 200', $r[0] === 200 && $r[1]['email_verified'] === true, $r[2]);
check('dopo la conferma gli endpoint normali ripartono (Bearer e sessione)',
    api('GET', '/api/workout/read_plans.php', $bAuth)[0] === 200 && api('GET', '/api/workout/read_plans.php', $bCookie)[0] === 200);

// Eliminazione da bloccato
[$dId, $dAuth] = agedAccount('evdelete', 9);
$r = api('POST', '/api/user/delete.php', $dAuth, ['password' => 'sbagliata']);
check('delete.php da bloccato con password sbagliata: 400 (non 403, non 401)', $r[0] === 400, $r[2]);
$r = api('POST', '/api/user/delete.php', $dAuth, ['password' => PASSWORD]);
check('delete.php da bloccato: 200 e account eliminato, codici compresi', $r[0] === 200 && rowCount('gym_users', 'id = ?', [$dId]) === 0 && rowCount('gym_email_codes', 'user_id = ?', [$dId]) === 0, $r[2]);

// ═══ Cambio di indirizzo ══════════════════════════════════════════════════════════════════════════
echo "Cambio di indirizzo, account non confermato\n";
[$uId, $uAuth] = newAccount('evchg');
$oldCode = lastCode('evchg@example.test');
$before = api('GET', '/api/user/read.php', $uAuth)[1]['email_verification']['deadline'];
$r = api('POST', '/api/user/change_email.php', $uAuth, ['email' => 'nuovo1@example.test', 'password' => PASSWORD]);
check('cambio subito dopo la registrazione: 429 (conta nei limiti di invio) e non cambia nulla',
    $r[0] === 429 && scalar("SELECT email FROM gym_users WHERE id = ?", [$uId]) === 'evchg@example.test', $r[2]);
age($uId);
$r = api('POST', '/api/user/change_email.php', $uAuth, ['email' => 'nuovo1@example.test', 'password' => 'Sbagliata!2026']);
check('password sbagliata: 400 wrong_password (mai 401)', $r[0] === 400 && $r[1]['code'] === 'wrong_password', $r[2]);
$r = api('POST', '/api/user/change_email.php', $uAuth, ['email' => 'non-una-email', 'password' => PASSWORD]);
check('indirizzo non valido: 400', $r[0] === 400, $r[2]);
$r = api('POST', '/api/user/change_email.php', $uAuth, ['password' => PASSWORD]);
check('indirizzo mancante: 400', $r[0] === 400, $r[2]);
$r = api('POST', '/api/user/change_email.php', $uAuth, ['email' => 'EVCHG@example.test ', 'password' => PASSWORD]);
check('stesso indirizzo di adesso (anche con maiuscole e spazi): 400 email_same', $r[0] === 400 && $r[1]['code'] === 'email_same', $r[2]);
$r = api('POST', '/api/user/change_email.php', $uAuth, ['email' => 'evstd@example.test', 'password' => PASSWORD]);
check('indirizzo già usato da un altro: 409 con field=email', $r[0] === 409 && $r[1]['field'] === 'email' && $r[1]['code'] === 'email_taken', $r[2]);
check('nessun cambio finora', scalar("SELECT email FROM gym_users WHERE id = ?", [$uId]) === 'evchg@example.test' && count(mails('nuovo1@example.test')) === 0);
$r = api('POST', '/api/user/change_email.php', $uAuth, ['email' => 'Nuovo1@Example.test', 'password' => PASSWORD]);
check('cambio: 200 mode immediate', $r[0] === 200 && $r[1]['mode'] === 'immediate' && $r[1]['email'] === 'nuovo1@example.test' && $r[1]['pending_email'] === null, $r[2]);
check('l\'indirizzo cambia subito (in minuscolo), nessun cambio in attesa',
    scalar("SELECT email FROM gym_users WHERE id = ?", [$uId]) === 'nuovo1@example.test' && scalar("SELECT pending_email FROM gym_users WHERE id = ?", [$uId]) === null);
$m = waitMails('nuovo1@example.test', 1);
check('un codice parte al nuovo indirizzo (email di cambio indirizzo)', count($m) === 1 && codeOf($m[0]) !== null && strpos($m[0]['subject'], 'nuovo indirizzo') !== false, json_encode($m));
check('nessuna email al vecchio indirizzo (non era confermato)', count(mails('evchg@example.test')) === 1);
$after = api('GET', '/api/user/read.php', $uAuth)[1];
check('i 7 giorni non ripartono (stessa deadline) e restano non confermato', $after['email_verification']['deadline'] === $before && $after['email_verified'] === false && $after['email'] === 'nuovo1@example.test');
check('i codici vecchi sono annullati', rowCount('gym_email_codes', 'user_id = ? AND used_at IS NULL', [$uId]) === 1);
$r = api('POST', '/api/user/confirm_email.php', $uAuth, ['code' => otherThan(codeOf($m[0]))]);
check('il codice sbagliato non conferma', $r[0] === 400);
if ($oldCode !== codeOf($m[0])) {
    $r = api('POST', '/api/user/confirm_email.php', $uAuth, ['code' => $oldCode]);
    check('il codice spedito al vecchio indirizzo non vale più', $r[0] === 400, $r[2]);
}
$r = api('POST', '/api/user/confirm_email.php', $uAuth, ['code' => codeOf($m[0])]);
check('il codice del nuovo indirizzo conferma l\'account', $r[0] === 200 && $r[1]['email'] === 'nuovo1@example.test', $r[2]);

echo "Cambio di indirizzo, account confermato\n";
[$vId, $vAuth] = newAccount('evverif');
verifyViaDb($vId);
age($vId);
$r = api('POST', '/api/user/change_email.php', $vAuth, ['email' => 'evverif@example.test', 'password' => PASSWORD]);
check('account confermato, stesso indirizzo: 400 email_same', $r[0] === 400 && $r[1]['code'] === 'email_same', $r[2]);
$r = api('POST', '/api/user/change_email.php', $vAuth, ['email' => 'verif2@example.test', 'password' => PASSWORD]);
check('cambio: 200 mode pending', $r[0] === 200 && $r[1]['mode'] === 'pending' && $r[1]['pending_email'] === 'verif2@example.test' && $r[1]['email'] === null, $r[2]);
$read = api('GET', '/api/user/read.php', $vAuth)[1];
check('read.php: l\'account resta confermato con il vecchio indirizzo, pending_email indicato',
    $read['email'] === 'evverif@example.test' && $read['email_verified'] === true && $read['pending_email'] === 'verif2@example.test' && $read['email_verification'] === null);
$m = waitMails('verif2@example.test', 1);
check('un codice parte al nuovo indirizzo, niente ancora al vecchio', count($m) === 1 && codeOf($m[0]) !== null && count(mails('evverif@example.test')) === 1);
$pendCode = codeOf($m[0]);
// reinvio: va al nuovo indirizzo
age($vId);
$r = api('POST', '/api/user/resend_email_code.php', $vAuth);
$m = waitMails('verif2@example.test', 2);
check('il reinvio di un cambio in attesa va al nuovo indirizzo', $r[0] === 200 && count($m) === 2 && count(mails('evverif@example.test')) === 1);
$pendCode = codeOf($m[1]);
$r = api('POST', '/api/user/confirm_email.php', $vAuth, ['code' => $pendCode]);
check('conferma del cambio: 200, il nuovo indirizzo è quello dell\'account', $r[0] === 200 && $r[1]['email'] === 'verif2@example.test', $r[2]);
check('email = nuovo, pending_email NULL, ancora confermato', scalar("SELECT email FROM gym_users WHERE id = ?", [$vId]) === 'verif2@example.test'
    && scalar("SELECT pending_email FROM gym_users WHERE id = ?", [$vId]) === null && scalar("SELECT email_verified_at FROM gym_users WHERE id = ?", [$vId]) !== null);
$old = waitMails('evverif@example.test', 2);
check('al VECCHIO indirizzo parte l\'email che informa del cambio', count($old) === 2 && strpos($old[1]['body'], 'verif2@example.test') !== false && strpos($old[1]['body'], 'è stato cambiato') !== false && strpos($old[1]['body'], 'Informativa privacy') !== false, json_encode($old));
check('l\'email di avviso non porta codici', codeOf($old[1]) === null);

// annullamento
age($vId);
$r = api('POST', '/api/user/change_email.php', $vAuth, ['email' => 'verif3@example.test', 'password' => PASSWORD]);
check('nuova richiesta di cambio: 200 pending', $r[0] === 200 && $r[1]['mode'] === 'pending', $r[2]);
$cancelCode = lastCode('verif3@example.test');
$r = api('POST', '/api/user/cancel_email_change.php', $vAuth);
check('annullamento: 200 cancelled true, pending_email NULL', $r[0] === 200 && $r[1]['cancelled'] === true && scalar("SELECT pending_email FROM gym_users WHERE id = ?", [$vId]) === null, $r[2]);
$r = api('POST', '/api/user/confirm_email.php', $vAuth, ['code' => $cancelCode]);
check('il codice del cambio annullato non conferma nulla', $r[0] !== 200 && scalar("SELECT email FROM gym_users WHERE id = ?", [$vId]) === 'verif2@example.test', $r[2]);
check('i codici del cambio annullato sono annullati', rowCount('gym_email_codes', 'user_id = ? AND used_at IS NULL', [$vId]) === 0);
$r = api('POST', '/api/user/cancel_email_change.php', $vAuth);
check('annullare di nuovo è innocuo (200 cancelled false)', $r[0] === 200 && $r[1]['cancelled'] === false, $r[2]);

// indirizzo preso nel frattempo
age($vId);
$r = api('POST', '/api/user/change_email.php', $vAuth, ['email' => 'preso@example.test', 'password' => PASSWORD]);
$lateCode = lastCode('preso@example.test');
$reg = register('evpreso', 'preso@example.test');
check('un cambio in attesa non impedisce a un altro di registrarsi con quell\'indirizzo', $r[0] === 200 && $reg[0] === 201, $reg[2]);
$r = api('POST', '/api/user/confirm_email.php', $vAuth, ['code' => $lateCode]);
check('indirizzo preso nel frattempo: 409 email_taken con field=email', $r[0] === 409 && $r[1]['code'] === 'email_taken' && $r[1]['field'] === 'email', $r[2]);
check('il cambio in attesa si annulla e l\'account non cambia', scalar("SELECT pending_email FROM gym_users WHERE id = ?", [$vId]) === null
    && scalar("SELECT email FROM gym_users WHERE id = ?", [$vId]) === 'verif2@example.test');
$read = api('GET', '/api/user/read.php', $vAuth)[1];
check('l\'account è ancora confermato', $read['email_verified'] === true);
// la richiesta sull'indirizzo già preso è rifiutata subito
age($vId);
$r = api('POST', '/api/user/change_email.php', $vAuth, ['email' => 'preso@example.test', 'password' => PASSWORD]);
check('richiesta su un indirizzo già usato: 409 email_taken', $r[0] === 409, $r[2]);

// limite password: 5 errori e poi 429 (stesso contatore di cambio e eliminazione)
[$pwId, $pwAuth] = newAccount('evpwd');
age($pwId);
$codes = [];
for ($i = 0; $i < 6; $i++) {
    $codes[] = api('POST', '/api/user/change_email.php', $pwAuth, ['email' => 'pw@example.test', 'password' => 'Sbagliata!2026'])[0];
}
check('password sbagliata ripetuta: 400 cinque volte poi 429 (password_check_guard)', $codes === [400, 400, 400, 400, 400, 429], json_encode($codes));

// ═══ Recupero password ═══════════════════════════════════════════════════════════════════════════
echo "Recupero password\n";
function resetToken($id)
{
    $token = bin2hex(random_bytes(32));
    sql("INSERT INTO gym_password_resets (user_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR))", [$id, hash('sha256', $token)]);
    return $token;
}
[$rpId, $rpAuth] = newAccount('evreset');
sql("UPDATE gym_users SET unverified_notice_stage = 1, unverified_notice_at = NOW() WHERE id = ?", [$rpId]);
$r = api('POST', '/api/user/reset_password.php', null, ['token' => resetToken($rpId), 'new_password' => 'Nuova!Password2026']);
check('recupero password completato: 200', $r[0] === 200, $r[2]);
check('l\'email risulta confermata e gli avvisi azzerati', scalar("SELECT email_verified_at FROM gym_users WHERE id = ?", [$rpId]) !== null
    && (int)scalar("SELECT unverified_notice_stage FROM gym_users WHERE id = ?", [$rpId]) === 0 && scalar("SELECT unverified_notice_at FROM gym_users WHERE id = ?", [$rpId]) === null);
[$rp2Id] = newAccount('evreset2');
sql("UPDATE gym_users SET email_verified_at = '2026-01-01 10:00:00' WHERE id = ?", [$rp2Id]);
api('POST', '/api/user/reset_password.php', null, ['token' => resetToken($rp2Id), 'new_password' => 'Nuova!Password2026']);
check('su un account già confermato la data non cambia', scalar("SELECT email_verified_at FROM gym_users WHERE id = ?", [$rp2Id]) === '2026-01-01 10:00:00');
[$rp3Id] = newAccount('evreset3');
$r = api('POST', '/api/user/reset_password.php', null, ['token' => str_repeat('a', 64), 'new_password' => 'Nuova!Password2026']);
check('un link di reset non valido non conferma nulla', $r[0] === 400 && scalar("SELECT email_verified_at FROM gym_users WHERE id = ?", [$rp3Id]) === null);

// ═══ Esportazione ═════════════════════════════════════════════════════════════════════════════════
echo "Esportazione\n";
$ex = api('GET', '/api/user/export.php', $vAuth);
check('export.php: il profilo ha email_verified_at (ISO 8601 con offset) e pending_email',
    $ex[0] === 200 && preg_match('/^\d{4}-\d\d-\d\dT[\d:]+[+-]\d\d:\d\d$/', (string)$ex[1]['profile']['email_verified_at']) === 1 && array_key_exists('pending_email', $ex[1]['profile']), substr($ex[2], 0, 400));

// ═══ Pulizia notturna ═════════════════════════════════════════════════════════════════════════════
echo "Pulizia\n";
// Account con dati veri (scheda, allenamento, token) per provare che l'eliminazione non lascia righe orfane
function accountWithData($name)
{
    [$id, $auth] = newAccount($name);
    $plan = api('POST', '/api/workout/create_plan.php', $auth, ['name' => 'Scheda']);
    $planId = $plan[1]['id'] ?? $plan[1]['plan_id'] ?? (int)scalar("SELECT id FROM gym_workout_plans WHERE user_id = ?", [$id]);
    api('POST', '/api/workout/create_days.php', $auth, ['plan_id' => $planId, 'days' => [['name' => 'Giorno 1'], ['name' => 'Giorno 2']]]);
    $dayId = (int)scalar("SELECT MIN(id) FROM gym_workout_days WHERE plan_id = ?", [$planId]);
    api('POST', '/api/workout/add_exercise.php', $auth, ['day_id' => $dayId, 'exercise_id' => 1, 'rest' => 60,
        'planned_sets' => [['set_number' => 1, 'kind' => 'working', 'reps_min' => 10, 'reps_max' => 10]]]);
    return [$id, $auth];
}
function dataRows($id)
{
    return rowCount('gym_workout_plans', 'user_id = ?', [$id])
        + (int)scalar("SELECT COUNT(*) FROM gym_workout_days d JOIN gym_workout_plans p ON p.id = d.plan_id WHERE p.user_id = ?", [$id])
        + (int)scalar("SELECT COUNT(*) FROM gym_workout_exercises e JOIN gym_workout_days d ON d.id = e.day_id JOIN gym_workout_plans p ON p.id = d.plan_id WHERE p.user_id = ?", [$id])
        + rowCount('gym_api_tokens', 'user_id = ?', [$id]) + rowCount('gym_consents', 'user_id = ?', [$id]) + rowCount('gym_email_codes', 'user_id = ?', [$id]);
}
function orphanCount()
{
    global $conn;
    $total = 0;
    $rows = $conn->query("SELECT TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL")->fetchAll();
    foreach ($rows as $r) {
        $total += (int)$conn->query("SELECT COUNT(*) FROM `{$r['TABLE_NAME']}` c LEFT JOIN `{$r['REFERENCED_TABLE_NAME']}` p ON c.`{$r['COLUMN_NAME']}` = p.`{$r['REFERENCED_COLUMN_NAME']}`
            WHERE c.`{$r['COLUMN_NAME']}` IS NOT NULL AND p.`{$r['REFERENCED_COLUMN_NAME']}` IS NULL")->fetchColumn();
    }
    return $total;
}
function setAccount($id, $days, $stage, $noticeHoursAgo = null, $admin = 0, $verified = false)
{
    sql("UPDATE gym_users SET created_at = DATE_SUB(NOW(), INTERVAL ? DAY), unverified_notice_stage = ?, is_admin = ?,
         unverified_notice_at = " . ($noticeHoursAgo === null ? 'NULL' : "DATE_SUB(NOW(), INTERVAL " . (int)$noticeHoursAgo . " HOUR)") . ",
         email_verified_at = " . ($verified ? 'NOW()' : 'NULL') . " WHERE id = ?", [$days, $stage, $admin, $id]);
}
function stage($id)
{
    return (int)scalar("SELECT unverified_notice_stage FROM gym_users WHERE id = ?", [$id]);
}
// Esegue la pulizia (CLI). Ritorna [esito, output]; le email di MAIL_DRIVER=log finiscono nello stesso output.
function purgeRun($extraEnv = [], $args = '')
{
    global $backend;
    $env = '';
    foreach ($extraEnv as $k => $v) $env .= $k . '=' . escapeshellarg($v) . ' ';
    exec($env . 'php ' . escapeshellarg($backend . '/tools/purge.php') . " $args 2>&1", $out, $rc);
    return [$rc, implode("\n", $out)];
}
function purgeLine($out, $label)
{
    return preg_match('/^' . preg_quote($label, '/') . '\s+(\d+)$/m', $out, $m) ? (int)$m[1] : null;
}

[$p1] = accountWithData('evpurge1');   // 31 giorni, stage 0 → avviso 1
[$p2] = accountWithData('evpurge2');   // 36 giorni, stage 1 → avviso 2
[$p3] = accountWithData('evpurge3');   // 38 giorni, stage 2, avviso da 10 ore → non si elimina
[$p4] = accountWithData('evpurge4');   // 38 giorni, stage 2, avviso da 48 ore → si elimina
[$p5] = accountWithData('evpurge5');   // admin, 100 giorni, stage 2, avviso da 100 ore → mai
[$p6] = accountWithData('evpurge6');   // confermato, 100 giorni → mai
[$p7] = accountWithData('evpurge7');   // 100 giorni, stage 0 (pulizia ferma): un avviso per notte
[$p8] = accountWithData('evpurge8');   // 20 giorni: niente
[$pen] = newAccount('evpurgeen', 'en'); // 31 giorni, stage 0, account inglese → avviso 1 in inglese
setAccount($p1, 31, 0); setAccount($p2, 36, 1, 30); setAccount($p3, 38, 2, 10); setAccount($p4, 38, 2, 48);
setAccount($p5, 100, 2, 100, 1); setAccount($p6, 100, 2, 100, 0, true); setAccount($p7, 100, 0); setAccount($p8, 20, 0); setAccount($pen, 31, 0);
sql("INSERT INTO gym_email_codes (user_id, email, code_hash, expires_at) VALUES (?, 'x@example.test', ?, DATE_SUB(NOW(), INTERVAL 8 DAY))", [$p8, hash('sha256', 'a')]);
sql("INSERT INTO gym_email_codes (user_id, email, code_hash, expires_at) VALUES (?, 'x@example.test', ?, DATE_SUB(NOW(), INTERVAL 6 DAY))", [$p8, hash('sha256', 'b')]);
$orphansBefore = orphanCount();
$p4Rows = dataRows($p4);
check('l\'account da eliminare ha dati veri (scheda, giorni, esercizi, token, consensi, codici)', $p4Rows >= 6, (string)$p4Rows);

[$rc, $out] = purgeRun([], '--dry-run');
check('--dry-run: conta e non cambia nulla', $rc === 0 && purgeLine($out, 'account non confermati: avviso 1 (30 gg)') === 3
    && purgeLine($out, 'account non confermati: avviso 2 (35 gg)') === 1 && purgeLine($out, 'account non confermati eliminati (37 gg)') === 1
    && stage($p1) === 0 && stage($p2) === 1 && rowCount('gym_users', 'id = ?', [$p4]) === 1 && rowCount('gym_email_codes', 'user_id = ?', [$p8]) === 3
    && strpos($out, '[mail:log]') === false, $out);

[$rc, $out] = purgeRun(['MAIL_DRIVER' => 'log']);
check('prima pulizia: riepilogo con 3 avvisi 1 (account 1, 7 e inglese), un avviso 2 e un\'eliminazione', $rc === 0 && purgeLine($out, 'account non confermati: avviso 1 (30 gg)') === 3
    && purgeLine($out, 'account non confermati: avviso 2 (35 gg)') === 1 && purgeLine($out, 'account non confermati eliminati (37 gg)') === 1, $out);
check('avviso 1: stage 1 e unverified_notice_at = adesso', stage($p1) === 1 && (int)scalar("SELECT TIMESTAMPDIFF(MINUTE, unverified_notice_at, NOW()) FROM gym_users WHERE id = ?", [$p1]) <= 1);
check('avviso 2: stage 2 e unverified_notice_at = adesso', stage($p2) === 2 && (int)scalar("SELECT TIMESTAMPDIFF(MINUTE, unverified_notice_at, NOW()) FROM gym_users WHERE id = ?", [$p2]) <= 1);
check('avviso 1 e avviso 2 non eliminano nessuno dei due', rowCount('gym_users', 'id IN (?, ?)', [$p1, $p2]) === 2);
check('niente eliminazione con il secondo avviso da meno di 47 ore (10 ore)', rowCount('gym_users', 'id = ?', [$p3]) === 1 && stage($p3) === 2);
check('eliminato l\'account con il secondo avviso da 48 ore', rowCount('gym_users', 'id = ?', [$p4]) === 0);
check('eliminazione senza righe orfane e senza righe dell\'utente (schede, giorni, esercizi, token, consensi, codici)', dataRows($p4) === 0 && orphanCount() === $orphansBefore, orphanCount() . ' vs ' . $orphansBefore);
check('admin: mai (resta, stage invariato)', rowCount('gym_users', 'id = ?', [$p5]) === 1 && stage($p5) === 2);
check('account confermato: mai', rowCount('gym_users', 'id = ?', [$p6]) === 1);
check('pulizia ferma per giorni (100 giorni, stage 0): un solo avviso per notte, non eliminato', stage($p7) === 1 && rowCount('gym_users', 'id = ?', [$p7]) === 1);
check('account di 20 giorni: nessun avviso', stage($p8) === 0 && scalar("SELECT unverified_notice_at FROM gym_users WHERE id = ?", [$p8]) === null);
check('codici scaduti da più di 7 giorni cancellati, quello da 6 giorni e quello attivo restano', rowCount('gym_email_codes', 'user_id = ?', [$p8]) === 2 && rowCount('gym_email_codes', 'user_id = ? AND code_hash = ?', [$p8, hash('sha256', 'a')]) === 0);
// le email di avviso (stdout della pulizia CLI): lette dall'output
preg_match_all('/\[mail:log\] a=(\S+) oggetto="([^"]*)"\n(.*?)(?=\n\[mail:log\]|\z)/s', $out, $mm, PREG_SET_ORDER);
$byTo = [];
foreach ($mm as $x) $byTo[$x[1]] = $x;
check('avviso 1: email all\'account 1 con la data di eliminazione e senza codici',
    isset($byTo['evpurge1@example.test']) && preg_match('#non prima del \d\d/\d\d/\d{4}#', $byTo['evpurge1@example.test'][3]) === 1
    && strpos($byTo['evpurge1@example.test'][3], 'chiedi un codice') !== false && !preg_match('/\b\d{6}\b/', $byTo['evpurge1@example.test'][3])
    && strpos($byTo['evpurge1@example.test'][3], 'Informativa privacy') !== false, json_encode($byTo['evpurge1@example.test'] ?? null));
check('avviso 2: email all\'account 2 ("ultimo avviso") senza codici', isset($byTo['evpurge2@example.test']) && strpos($byTo['evpurge2@example.test'][2], 'Ultimo avviso') !== false
    && !preg_match('/\b\d{6}\b/', $byTo['evpurge2@example.test'][3]));
check('niente email a chi non è in soglia, né agli admin e ai confermati', !isset($byTo['evpurge3@example.test']) && !isset($byTo['evpurge5@example.test']) && !isset($byTo['evpurge6@example.test']) && !isset($byTo['evpurge8@example.test']));
check('l\'avviso va nella lingua dell\'account (inglese)', isset($byTo['evpurgeen@example.test']) && $byTo['evpurgeen@example.test'][2] === 'Confirm your email on LiftIndex'
    && preg_match('/deleted, not before [A-Z][a-z]+ \d+, \d{4}/', $byTo['evpurgeen@example.test'][3]) === 1, json_encode($byTo['evpurgeen@example.test'] ?? null));

// seconda notte: l'account 7 riceve l'avviso 2; la terza l'eliminazione (se l'avviso ha 47 ore)
[$rc, $out] = purgeRun(['MAIL_DRIVER' => 'log']);
check('due lanci nella stessa notte: il secondo avviso non parte subito dopo il primo', stage($p7) === 1 && rowCount('gym_users', 'id = ?', [$p7]) === 1 && strpos($out, 'evpurge7@example.test') === false, $out);
sql("UPDATE gym_users SET unverified_notice_at = DATE_SUB(NOW(), INTERVAL 24 HOUR) WHERE id = ?", [$p7]);
[$rc, $out] = purgeRun(['MAIL_DRIVER' => 'log']);
check('seconda notte: l\'account fermo da 100 giorni riceve il secondo avviso, ancora non eliminato', stage($p7) === 2 && rowCount('gym_users', 'id = ?', [$p7]) === 1);
preg_match('#non prima del (\d\d/\d\d/\d{4})#', $out, $dm);
// L'istante dell'invio è l'ora del database (la stessa letta dalla pulizia): si parte da unverified_notice_at, scritto
// con NOW() pochi istanti dopo, e si accettano le date di quei pochi secondi, così il confronto non dipende dall'ora del test
$noticeTs = (int)scalar("SELECT UNIX_TIMESTAMP(unverified_notice_at) FROM gym_users WHERE id = ?", [$p7]);
$expectedDates = [];
for ($k = 0; $k <= 10; $k++) $expectedDates[emailNoticeDateText($noticeTs - $k + 47 * 3600, 'it')] = true;
check('la data nell\'avviso di un account in ritardo non è già passata: adesso + 47 ore, in ora italiana', isset($expectedDates[$dm[1] ?? '']), json_encode([$dm, array_keys($expectedDates)]));
[$rc, $out] = purgeRun(['MAIL_DRIVER' => 'log']);
check('terza notte, avviso appena mandato: non eliminato', rowCount('gym_users', 'id = ?', [$p7]) === 1);
sql("UPDATE gym_users SET unverified_notice_at = DATE_SUB(NOW(), INTERVAL 47 HOUR) WHERE id = ?", [$p7]);
[$rc, $out] = purgeRun(['MAIL_DRIVER' => 'log']);
check('con l\'avviso da 47 ore viene eliminato', rowCount('gym_users', 'id = ?', [$p7]) === 0);
check('l\'account 3 ha ancora l\'avviso da meno di 47 ore e resta; quello da 48 ore sì', rowCount('gym_users', 'id = ?', [$p3]) === 1);
sql("UPDATE gym_users SET unverified_notice_at = DATE_SUB(NOW(), INTERVAL 47 HOUR) WHERE id = ?", [$p3]);
purgeRun(['MAIL_DRIVER' => 'log']);
check('account 3 con l\'avviso da 47 ore: eliminato', rowCount('gym_users', 'id = ?', [$p3]) === 0);

// Eliminazione atomica: chi conferma tra il controllo e l'eliminazione non viene eliminato. A tiene la riga utente
// bloccata e segna l'email come confermata; B (un altro processo) prova a eliminare e deve aspettare, poi non eliminare.
[$race] = newAccount('evrace');
setAccount($race, 40, 2, 100);
$conn->beginTransaction();
sql("SELECT id FROM gym_users WHERE id = ? FOR UPDATE", [$race]);
$bCode = '$b = $argv[1]; require $b . "/config/database.php"; require $b . "/models/WorkoutPlan.php"; require $b . "/models/User.php";'
    . '$u = new User((new Database())->getConnection()); $u->id = (int)$argv[2]; var_export($u->deleteRecords(true));';
$racer = proc_open(['php', '-r', $bCode, $backend, (string)$race], [0 => ['file', '/dev/null', 'r'], 1 => ['pipe', 'w'], 2 => ['file', '/dev/null', 'w']], $racePipes);
usleep(1500000);
check('eliminazione concorrente: aspetta il blocco della riga utente', proc_get_status($racer)['running'] === true);
EmailVerification::markVerified($conn, $race);
$conn->commit();
$raceOut = stream_get_contents($racePipes[1]);
proc_close($racer);
check('eliminazione concorrente: chi ha confermato nel frattempo non viene eliminato (null)', trim($raceOut) === 'NULL' && rowCount('gym_users', 'id = ?', [$race]) === 1, $raceOut);

// un account che fallisce non ferma gli altri: con le email che non partono gli avvisi falliscono, le eliminazioni no
[$f1] = newAccount('evfail1'); [$f2] = newAccount('evfail2'); [$f3] = newAccount('evfail3');
setAccount($f1, 31, 0); setAccount($f2, 40, 2, 100); setAccount($f3, 31, 0);
[$rc, $out] = purgeRun(['MAIL_DRIVER' => 'brevo', 'MAIL_API_KEY' => '']);
check('avvisi che non partono: ERRORE nel riepilogo per ciascun account, esito 1, stage non avanzato (si riprova domani)',
    $rc === 1 && substr_count($out, 'ERRORE account') === 2 && stage($f1) === 0 && stage($f3) === 0, $out);
check('gli altri account proseguono: quello da eliminare è stato eliminato', rowCount('gym_users', 'id = ?', [$f2]) === 0 && purgeLine($out, 'account non confermati eliminati (37 gg)') === 1, $out);
[$rc, $out] = purgeRun(['MAIL_DRIVER' => 'log']);
check('la notte dopo gli avvisi partono e l\'esito è 0', $rc === 0 && stage($f1) === 1 && stage($f3) === 1, $out);

echo "\nCONTROLLI $checks FALLITI $fails\n";
exit($fails > 0 ? 1 : 0);
