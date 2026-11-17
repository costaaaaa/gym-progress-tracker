<?php
// Eseguito da tests/signup_codes.sh (serve un database con lo schema del repo).
// Argomenti: cartella backend da provare, fase.
//
// Codici di registrazione, lato server: avvia il server integrato di PHP sul backend (con più processi, per le
// registrazioni in parallelo) e chiama gli endpoint veri. I codici a 6 cifre si leggono dal log delle email
// (MAIL_DRIVER=log). Le date si spostano con SQL diretto.
$backend = $argv[1];
require $backend . '/config/database.php';
require __DIR__ . '/lib/http_test.php';
require __DIR__ . '/lib/server_test.php';

const PASSWORD = 'Prova!Codici2026';
const PORT_A = 8097;  // limiti per IP alti, 4 processi
const PORT_B = 8096;  // al massimo 3 codici non utilizzabili all'ora per IP
const API_DEFAULT_PORT = PORT_A;
const LOG_A = '/tmp/sc-a.log';
const LOG_B = '/tmp/sc-b.log';

foreach (['RL_REGISTER_MAX', 'RL_LOGIN_IP_MAX', 'RL_LOGIN_USER_MAX', 'RL_LOGIN_ACCOUNT_MAX', 'RL_FORGOT_IP_MAX', 'RL_RESET_IP_MAX', 'RL_CHECK_IP_MAX', 'RL_EMAIL_CODE_IP_MAX', 'RL_SIGNUP_CODE_IP_MAX', 'RL_PASSWORD_CHECK_MAX'] as $v) {
    putenv("$v=1000");
}
putenv('MAIL_DRIVER=log');
putenv('APP_PUBLIC_URL=https://liftindex.test');

startServer($backend, PORT_A, LOG_A, ['PHP_CLI_SERVER_WORKERS' => '4']);
startServer($backend, PORT_B, LOG_B, ['RL_SIGNUP_CODE_IP_MAX' => '3']);

$conn = (new Database())->getConnection();

function regBody($name, $signupCode = null, $email = null, $locale = 'it')
{
    $b = [
        'username' => $name, 'email' => $email ?? "$name@example.test", 'password' => PASSWORD,
        'birth_date' => '1990-01-01', 'gender' => 'M', 'accept_terms' => true, 'locale' => $locale,
    ];
    if ($signupCode !== null) $b['signup_code'] = $signupCode;
    return $b;
}
function register($name, $signupCode = null, $port = PORT_A, $extra = [], $locale = 'it')
{
    return api('POST', '/api/user/register.php', null, regBody($name, $signupCode, null, $locale), $port, $extra);
}
function bearer($name)
{
    $r = api('POST', '/api/user/mobile_login.php', null, ['username' => $name, 'password' => PASSWORD]);
    return ['bearer' => $r[1]['token'] ?? ''];
}
function userId($name)
{
    return (int)scalar("SELECT id FROM gym_users WHERE username = ?", [$name]);
}
function userCount($name)
{
    return (int)scalar("SELECT COUNT(*) FROM gym_users WHERE username = ?", [$name]);
}
// Registra con il codice e ritorna [id, token Bearer]
function newAccount($name, $signupCode = null)
{
    $r = register($name, $signupCode);
    if ($r[0] !== 201) echo "      registrazione di $name: {$r[0]} {$r[2]}\n";
    return [userId($name), bearer($name)];
}

function mails($to, $log = LOG_A)
{
    $text = (string)@file_get_contents($log);
    $out = [];
    $parts = preg_split('/^(?:\[\d+\] )?\[[A-Z][a-z]{2} [A-Z][a-z]{2} +\d+ [\d:]+ \d{4}\] /m', $text);
    foreach ($parts as $p) {
        if (preg_match('/^\[mail:log\] a=(\S+) oggetto="([^"]*)"\n(.*)$/s', $p, $m) && $m[1] === $to) {
            $out[] = ['to' => $m[1], 'subject' => $m[2], 'body' => $m[3]];
        }
    }
    return $out;
}
function lastCode($to, $n = 1)
{
    for ($i = 0; $i < 30; $i++) {
        if (count(mails($to)) >= $n) break;
        usleep(100000);
    }
    $all = mails($to);
    return ($all && preg_match('/\n(\d{6})\n/', end($all)['body'], $m)) ? $m[1] : null;
}
// Conferma l'email con il codice arrivato per email: ritorna la risposta di confirm_email.php
function confirm($name, $auth)
{
    return api('POST', '/api/user/confirm_email.php', $auth, ['code' => lastCode("$name@example.test")]);
}
function age($id, $days)
{
    sql("UPDATE gym_users SET created_at = DATE_SUB(NOW(), INTERVAL $days DAY) WHERE id = ?", [$id]);
}
function useRow($userId)
{
    $r = rows("SELECT status, applied_at, code_id FROM gym_signup_code_uses WHERE user_id = ?", [$userId]);
    return $r ? $r[0] : null;
}
function tierRow($id)
{
    return rows("SELECT tier, tier_until FROM gym_users WHERE id = ?", [$id])[0];
}
function romeLastDay($days)
{
    return (new DateTimeImmutable('now', new DateTimeZone('Europe/Rome')))->modify("+$days days")->format('Y-m-d');
}
// tier_until atteso (UTC) di un ultimo giorno italiano: il giorno dopo alle 00:00 italiane
function untilOfLastDay($lastDay)
{
    return (new DateTimeImmutable("$lastDay 00:00:00", new DateTimeZone('Europe/Rome')))->modify('+1 day')
        ->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
}

// Admin
sql("INSERT INTO gym_users (username, email, password, email_verified_at, is_admin) VALUES ('scadmin', 'scadmin@example.test', ?, NOW(), 1)",
    [password_hash(PASSWORD, PASSWORD_BCRYPT)]);
$adm = bearer('scadmin');
function admGet($query = '')
{
    global $adm;
    return api('GET', '/api/admin/signup_codes.php' . $query, $adm);
}
function admPost($body)
{
    global $adm;
    return api('POST', '/api/admin/signup_codes.php', $adm, $body);
}
// Crea un codice dall'admin e ritorna la riga del codice
function mk($code, $tier, $days, $max, array $more = [])
{
    $body = ['action' => 'create', 'code' => $code, 'tier' => $tier, 'duration_days' => $days, 'max_uses' => $max] + $more;
    if ($days === null) $body['confirm_forever'] = true;
    $r = admPost($body);
    if ($r[0] !== 201) echo "      creazione di $code: {$r[0]} {$r[2]}\n";
    return $r[1]['code'] ?? [];
}
function codeId($code)
{
    return (int)scalar("SELECT id FROM gym_signup_codes WHERE code = ?", [strtoupper($code)]);
}
function seats($code)
{
    $r = admGet('?id=' . codeId($code));
    return $r[1]['code']['seats_taken'] ?? -1;
}
function orphans()
{
    global $conn;
    $total = 0;
    $rows = $conn->query("SELECT TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL")->fetchAll(PDO::FETCH_ASSOC);
    foreach ($rows as $r) {
        $total += (int)$conn->query("SELECT COUNT(*) FROM `{$r['TABLE_NAME']}` c LEFT JOIN `{$r['REFERENCED_TABLE_NAME']}` p ON c.`{$r['COLUMN_NAME']}` = p.`{$r['REFERENCED_COLUMN_NAME']}`
            WHERE c.`{$r['COLUMN_NAME']}` IS NOT NULL AND p.`{$r['REFERENCED_COLUMN_NAME']}` IS NULL")->fetchColumn();
    }
    return $total;
}
// Registrazioni contemporanee in processi veri: ogni corpo parte da un processo PHP a sé, tutti allo stesso istante.
// Ritorna [[codice HTTP, JSON], ...]
function parallelRegister(array $bodies, $port = PORT_A)
{
    $script = '/tmp/sc-par.php';
    file_put_contents($script, '<?php $t = (float)$argv[1]; while (microtime(true) < $t) usleep(200);
        $c = stream_context_create(["http" => ["method" => "POST", "header" => "Content-Type: application/json\r\n", "content" => $argv[3], "ignore_errors" => true, "timeout" => 30]]);
        $r = file_get_contents("http://127.0.0.1:" . $argv[2] . "/api/user/register.php", false, $c);
        $h = function_exists("http_get_last_response_headers") ? http_get_last_response_headers() : ($http_response_header ?? []);
        preg_match("/ (\d{3})/", $h[0] ?? "", $m); echo ($m[1] ?? 0), " ", $r;');
    $start = microtime(true) + 1.0;
    $procs = [];
    foreach ($bodies as $i => $b) {
        $procs[$i] = proc_open(['php', $script, (string)$start, (string)$port, json_encode($b)], [1 => ['pipe', 'w'], 2 => ['file', '/dev/null', 'w']], $pipes[$i]);
    }
    $out = [];
    foreach ($procs as $i => $p) {
        $raw = stream_get_contents($pipes[$i][1]);
        proc_close($p);
        $out[] = [(int)substr($raw, 0, 3), json_decode(substr($raw, 4), true)];
    }
    return $out;
}

// ═══ Registrazione senza codice ══════════════════════════════════════════════════════════════════
echo "Registrazione senza codice (invariata)\n";
$r = register('scplain');
check('201', $r[0] === 201, $r[2]);
check('la risposta non ha signup_code', !array_key_exists('signup_code', $r[1]), $r[2]);
check('nessun uso registrato, account Gratis', rows("SELECT COUNT(*) AS n FROM gym_signup_code_uses")[0]['n'] == 0 && tierRow(userId('scplain'))['tier'] === 'free');
$plainAuth = bearer('scplain');
$read = api('GET', '/api/user/read.php', $plainAuth);
check('read.php: tier_until e tier_last_day null, signup_code null', $read[0] === 200 && $read[1]['tier'] === 'free'
    && $read[1]['tier_until'] === null && $read[1]['tier_last_day'] === null && $read[1]['signup_code'] === null, $read[2]);
$r = register('scplain2', '');
check('signup_code vuoto = assente: 201 senza codice', $r[0] === 201 && !array_key_exists('signup_code', $r[1]), $r[2]);
$r = register('scplain3', '   ');
check('signup_code di soli spazi = assente: 201', $r[0] === 201, $r[2]);
$exp = api('GET', '/api/user/export.php', $plainAuth);
check('esportazione: signup_code null senza codice', $exp[0] === 200 && array_key_exists('signup_code', $exp[1]) && $exp[1]['signup_code'] === null, substr($exp[2], 0, 200));

// ═══ Admin: accesso e creazione ══════════════════════════════════════════════════════════════════
echo "Admin: accesso\n";
check('non admin: GET 404', api('GET', '/api/admin/signup_codes.php', $plainAuth)[0] === 404);
check('non admin: POST 404', api('POST', '/api/admin/signup_codes.php', $plainAuth, ['action' => 'create', 'tier' => 'plus', 'duration_days' => 30, 'max_uses' => 1])[0] === 404);
check('senza accesso: 404', api('GET', '/api/admin/signup_codes.php')[0] === 404);
check('non admin: nessun codice creato', (int)scalar("SELECT COUNT(*) FROM gym_signup_codes") === 0);

echo "Admin: crea\n";
$c = mk('mario-plus', 'plus', 90, 2, ['assignee' => 'Mario']);
check('crea Plus 90 giorni: codice normalizzato, livello, durata, posti, assegnatario', ($c['code'] ?? '') === 'MARIO-PLUS' && $c['tier'] === 'plus'
    && $c['duration_days'] === 90 && $c['forever'] === false && $c['max_uses'] === 2 && $c['assignee'] === 'Mario' && $c['enabled'] === true
    && $c['last_day'] === null && $c['expired'] === false && $c['seats_taken'] === 0 && $c['registered'] === 0, json_encode($c));
$r = admPost(['action' => 'create', 'code' => '', 'tier' => 'pro', 'duration_days' => 30, 'max_uses' => 5]);
check('codice vuoto: lo genera il server (10 caratteri, senza 0/O/1/I)', $r[0] === 201 && preg_match('/^[A-Z2-9]{10}$/', $r[1]['code']['code']) === 1 && !preg_match('/[01OI]/', $r[1]['code']['code']), $r[2]);
$r = admPost(['action' => 'create', 'tier' => 'pro', 'duration_days' => 30, 'max_uses' => 5]);
check('codice assente: generato', $r[0] === 201 && strlen($r[1]['code']['code']) === 10, $r[2]);
$r = admPost(['action' => 'create', 'code' => 'forever-no-confirm', 'tier' => 'pro', 'max_uses' => 1]);
check('per sempre senza conferma: 400 confirm_forever_required', $r[0] === 400 && $r[1]['code'] === 'confirm_forever_required' && codeId('forever-no-confirm') === 0, $r[2]);
$r = admPost(['action' => 'create', 'code' => 'forever-false', 'tier' => 'pro', 'duration_days' => '', 'confirm_forever' => false, 'max_uses' => 1]);
check('per sempre con confirm_forever false: 400', $r[0] === 400 && codeId('forever-false') === 0, $r[2]);
$c = mk('pro-forever', 'pro', null, 3);
check('per sempre con conferma: creato, duration_days null, forever true', $c['duration_days'] === null && $c['forever'] === true && $c['tier'] === 'pro', json_encode($c));
foreach ([['tier' => 'free'], ['tier' => 'gold'], ['tier' => null]] as $i => $bad) {
    $r = admPost(['action' => 'create', 'code' => "badtier$i", 'duration_days' => 30, 'max_uses' => 1] + $bad);
    check("livello non valido (" . json_encode($bad['tier']) . "): 400 invalid_tier", $r[0] === 400 && $r[1]['code'] === 'invalid_tier', $r[2]);
}
foreach ([0, -1, 'x', 1.5, null] as $bad) {
    $r = admPost(['action' => 'create', 'code' => 'badmax', 'tier' => 'plus', 'duration_days' => 30, 'max_uses' => $bad]);
    check("posti non validi (" . json_encode($bad) . "): 400 invalid_max_uses", $r[0] === 400 && $r[1]['code'] === 'invalid_max_uses', $r[2]);
}
foreach ([0, -5, 'x', 3651] as $bad) {
    $r = admPost(['action' => 'create', 'code' => 'baddur', 'tier' => 'plus', 'duration_days' => $bad, 'max_uses' => 1]);
    check("durata non valida (" . json_encode($bad) . "): 400 invalid_duration", $r[0] === 400 && $r[1]['code'] === 'invalid_duration', $r[2]);
}
foreach (['abc', 'ha spazi', 'sotto_linea', str_repeat('a', 41)] as $bad) {
    $r = admPost(['action' => 'create', 'code' => $bad, 'tier' => 'plus', 'duration_days' => 30, 'max_uses' => 1]);
    check("testo del codice non valido (" . substr($bad, 0, 12) . "): 400 invalid_code", $r[0] === 400 && $r[1]['code'] === 'invalid_code', $r[2]);
}
$r = admPost(['action' => 'create', 'code' => ' MARIO-plus ', 'tier' => 'plus', 'duration_days' => 30, 'max_uses' => 1]);
check('testo già esistente (altra grafia): 409 code_taken', $r[0] === 409 && $r[1]['code'] === 'code_taken', $r[2]);
$r = admPost(['action' => 'create', 'code' => 'past-day', 'tier' => 'plus', 'duration_days' => 30, 'max_uses' => 1, 'last_day' => '2020-01-01']);
check('ultimo giorno già passato: 400 invalid_date', $r[0] === 400 && $r[1]['code'] === 'invalid_date', $r[2]);
$r = admPost(['action' => 'create', 'code' => 'bad-day', 'tier' => 'plus', 'duration_days' => 30, 'max_uses' => 1, 'last_day' => '2030-13-45']);
check('data malformata: 400 invalid_date', $r[0] === 400 && $r[1]['code'] === 'invalid_date', $r[2]);
$r = admPost(['action' => 'create', 'code' => 'long-assignee', 'tier' => 'plus', 'duration_days' => 30, 'max_uses' => 1, 'assignee' => str_repeat('x', 101)]);
check('assegnatario troppo lungo: 400 invalid_assignee', $r[0] === 400 && $r[1]['code'] === 'invalid_assignee', $r[2]);
$c = mk('with-last-day', 'plus', 30, 1, ['last_day' => romeLastDay(10)]);
check('last_day: salvato in ora italiana, expires_at = giorno dopo 00:00 italiane (UTC), non scaduto',
    $c['last_day'] === romeLastDay(10) && $c['expired'] === false
    && scalar("SELECT expires_at FROM gym_signup_codes WHERE code = 'WITH-LAST-DAY'") === untilOfLastDay(romeLastDay(10)), json_encode($c));
check('azione sconosciuta: 400', admPost(['action' => 'boh'])[0] === 400);

// ═══ Registrazione con codice ════════════════════════════════════════════════════════════════════
echo "Registrazione con codice: tre grafie, stesso codice\n";
$r1 = register('scmario1', 'mario-plus');
check('minuscolo: 201 con signup_code {tier, duration_days}', $r1[0] === 201 && $r1[1]['signup_code'] === ['tier' => 'plus', 'duration_days' => 90], $r1[2]);
$r2 = register('scmario2', ' Mario-Plus ');
check('con spazi e maiuscole miste: 201, secondo posto', $r2[0] === 201 && $r2[1]['signup_code']['tier'] === 'plus', $r2[2]);
$r3 = register('scmario3', 'MARIO-PLUS');
check('maiuscolo: è lo stesso codice, posti finiti (409 signup_code_exhausted)', $r3[0] === 409 && $r3[1]['code'] === 'signup_code_exhausted', $r3[2]);
check('l\'account respinto non esiste', userCount('scmario3') === 0);
$m1 = userId('scmario1');
check('account Gratis fino alla conferma', tierRow($m1)['tier'] === 'free' && tierRow($m1)['tier_until'] === null);
$u = useRow($m1);
check('uso pending sul codice giusto', $u && $u['status'] === 'pending' && (int)$u['code_id'] === codeId('mario-plus') && $u['applied_at'] === null);
check('l\'account nasce non confermato', scalar("SELECT email_verified_at FROM gym_users WHERE id = ?", [$m1]) === null);
check('parte l\'email con il codice a 6 cifre', lastCode('scmario1@example.test') !== null);
$m1Auth = bearer('scmario1');
$read = api('GET', '/api/user/read.php', $m1Auth);
check('read.php: signup_code pending {status, tier, duration_days}, livello Gratis', $read[0] === 200 && $read[1]['signup_code'] === ['status' => 'pending', 'tier' => 'plus', 'duration_days' => 90]
    && $read[1]['tier'] === 'free' && $read[1]['tier_until'] === null && $read[1]['tier_last_day'] === null, $read[2]);
check('admin: posti occupati 2, registrati 2, confermati 0', seats('mario-plus') === 2
    && admGet('?id=' . codeId('mario-plus'))[1]['code']['registered'] === 2 && admGet('?id=' . codeId('mario-plus'))[1]['code']['confirmed'] === 0);

echo "Registrazione con codice: errori (nessun account creato)\n";
$unknown = register('scbad1', 'non-esiste');
check('inesistente: 400 signup_code_invalid, field signup_code', $unknown[0] === 400 && $unknown[1]['code'] === 'signup_code_invalid' && $unknown[1]['field'] === 'signup_code', $unknown[2]);
$mal = register('scbad2', 'a b');
check('malformato: lo stesso errore e lo stesso messaggio dell\'inesistente', $mal[0] === 400 && $mal[1]['code'] === 'signup_code_invalid' && $mal[1]['message'] === $unknown[1]['message'], $mal[2]);
$notStr = api('POST', '/api/user/register.php', null, regBody('scbad3') + ['signup_code' => 12345]);
check('non stringa: invalid', $notStr[0] === 400 && $notStr[1]['code'] === 'signup_code_invalid', $notStr[2]);
mk('spento', 'plus', 30, 5);
admPost(['action' => 'update', 'id' => codeId('spento'), 'enabled' => false]);
$off = register('scbad4', 'spento');
check('spento: lo stesso errore e lo stesso messaggio dell\'inesistente (non rivela che esiste)', $off[0] === 400 && $off[1]['code'] === 'signup_code_invalid' && $off[1]['message'] === $unknown[1]['message'], $off[2]);
mk('scaduto', 'plus', 30, 5);
sql("UPDATE gym_signup_codes SET expires_at = DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 HOUR) WHERE code = 'SCADUTO'");
$exp = register('scbad5', 'scaduto');
check('scaduto: 400 signup_code_expired', $exp[0] === 400 && $exp[1]['code'] === 'signup_code_expired' && $exp[1]['field'] === 'signup_code', $exp[2]);
$exh = register('scbad6', 'mario-plus');
check('esaurito: 409 signup_code_exhausted, field signup_code', $exh[0] === 409 && $exh[1]['code'] === 'signup_code_exhausted' && $exh[1]['field'] === 'signup_code', $exh[2]);
check('tre messaggi diversi tra loro', count(array_unique([$unknown[1]['message'], $exp[1]['message'], $exh[1]['message']])) === 3);
$en = register('scbad7', 'mario-plus', PORT_A, ['X-Locale: en']);
check('in inglese: "sign-up code"', $en[0] === 409 && stripos($en[1]['message'], 'sign-up code') !== false, $en[2]);
check('nessun account creato per nessun errore', array_sum(array_map('userCount', ['scbad1', 'scbad2', 'scbad3', 'scbad4', 'scbad5', 'scbad6', 'scbad7'])) === 0);
$r = register('scplain', 'mario-plus');
check('username già preso con codice: 409 sul campo username, nessun uso in più', $r[0] === 409 && $r[1]['field'] === 'username'
    && (int)scalar("SELECT COUNT(*) FROM gym_signup_code_uses WHERE code_id = ?", [codeId('mario-plus')]) === 2, $r[2]);
check('e il blocco del codice è stato rilasciato (un\'altra richiesta passa)', register('scplain4', 'pro-forever')[0] === 201);
$noTerms = api('POST', '/api/user/register.php', null, ['accept_terms' => false] + regBody('scbad8', 'pro-forever'));
check('dati non validi con codice buono: 400 e il codice non è consumato', $noTerms[0] === 400 && userCount('scbad8') === 0
    && (int)scalar("SELECT COUNT(*) FROM gym_signup_code_uses WHERE code_id = ?", [codeId('pro-forever')]) === 1);

echo "Il codice sbagliato non consuma posti, il buono sì solo alla registrazione\n";
$c = mk('un-posto', 'plus', 7, 1);
api('POST', '/api/user/check_availability.php', null, ['signup_code' => 'un-posto']);
api('POST', '/api/user/check_availability.php', null, ['signup_code' => 'un-posto']);
check('il controllo anticipato non occupa posti', seats('un-posto') === 0);

// ═══ Controllo anticipato ════════════════════════════════════════════════════════════════════════
echo "Controllo anticipato (check_availability.php)\n";
$r = api('POST', '/api/user/check_availability.php', null, ['signup_code' => ' Pro-Forever ']);
check('codice buono: 200 signup_code {usable, tier, duration_days}', $r[0] === 200 && $r[1]['signup_code'] === ['usable' => true, 'tier' => 'pro', 'duration_days' => null], $r[2]);
$r = api('POST', '/api/user/check_availability.php', null, ['username' => 'scplain', 'email' => 'libera@example.test', 'signup_code' => 'mario-plus']);
check('esaurito: 409 signup_code_exhausted', $r[0] === 409 && $r[1]['code'] === 'signup_code_exhausted', $r[2]);
$r = api('POST', '/api/user/check_availability.php', null, ['signup_code' => 'scaduto']);
check('scaduto: 400 signup_code_expired', $r[0] === 400 && $r[1]['code'] === 'signup_code_expired', $r[2]);
$r = api('POST', '/api/user/check_availability.php', null, ['signup_code' => 'spento']);
check('spento: 400 signup_code_invalid con lo stesso messaggio', $r[0] === 400 && $r[1]['code'] === 'signup_code_invalid' && $r[1]['message'] === $unknown[1]['message'], $r[2]);
$r = api('POST', '/api/user/check_availability.php', null, ['signup_code' => 'no']);
check('malformato: 400 signup_code_invalid', $r[0] === 400 && $r[1]['code'] === 'signup_code_invalid', $r[2]);
$r = api('POST', '/api/user/check_availability.php', null, ['username' => 'scplain', 'email' => 'libera@example.test', 'signup_code' => 'pro-forever']);
check('insieme a username ed email: la risposta ha tutto', $r[0] === 200 && $r[1]['username_taken'] === true && $r[1]['email_taken'] === false && $r[1]['signup_code']['usable'] === true, $r[2]);
$r = api('POST', '/api/user/check_availability.php', null, ['username' => 'scplain']);
check('senza codice: la risposta non ha signup_code (invariato)', $r[0] === 200 && $r[1]['username_taken'] === true && !array_key_exists('signup_code', $r[1]), $r[2]);
$r = api('POST', '/api/user/check_availability.php', null, ['signup_code' => '']);
check('codice vuoto e nient\'altro: 200 senza controlli', $r[0] === 200 && $r[1]['username_taken'] === null, $r[2]);

// ═══ Limite dei codici non utilizzabili ══════════════════════════════════════════════════════════
echo "Limite: 3 codici non utilizzabili all'ora per IP (server B, limite basso)\n";
// I contatori stanno nel database e sono per IP: quelli dei fallimenti delle prove precedenti (tutte da 127.0.0.1) si azzerano
sql("DELETE FROM gym_rate_limits");
mk('buono-b', 'plus', 30, 50);
$allOk = true;
for ($i = 0; $i < 6; $i++) {
    $allOk = $allOk && api('POST', '/api/user/check_availability.php', null, ['signup_code' => 'buono-b'], PORT_B)[0] === 200;
}
check('i codici buoni non contano nel limite (6 controlli riusciti)', $allOk);
for ($i = 1; $i <= 3; $i++) {
    $r = api('POST', '/api/user/check_availability.php', null, ['signup_code' => "nope-$i"], PORT_B);
    check("codice sbagliato $i: 400", $r[0] === 400 && $r[1]['code'] === 'signup_code_invalid', $r[2]);
}
$r = api('POST', '/api/user/check_availability.php', null, ['signup_code' => 'nope-4'], PORT_B);
check('oltre il limite: 429 rate_limited con retry_after e Retry-After', $r[0] === 429 && $r[1]['code'] === 'rate_limited' && $r[1]['retry_after'] > 0
    && preg_grep('/^Retry-After:/i', $r[3]), $r[2]);
$r = api('POST', '/api/user/check_availability.php', null, ['signup_code' => 'buono-b'], PORT_B);
check('oltre il limite anche il codice buono è fermato (429)', $r[0] === 429, $r[2]);
$r = register('scrate1', 'buono-b', PORT_B);
check('la registrazione con codice divide lo stesso limite: 429, nessun account', $r[0] === 429 && $r[1]['code'] === 'rate_limited' && userCount('scrate1') === 0, $r[2]);
$r = register('scrate2', null, PORT_B);
check('la registrazione senza codice non è toccata dal limite: 201', $r[0] === 201, $r[2]);
$r = api('POST', '/api/user/check_availability.php', null, ['username' => 'scrate2'], PORT_B);
check('anche username/email senza codice non sono toccati: 200', $r[0] === 200 && $r[1]['username_taken'] === true, $r[2]);
check('sul server A (limite alto) lo stesso IP non è limitato', api('POST', '/api/user/check_availability.php', null, ['signup_code' => 'buono-b'])[0] === 200);

// ═══ Ultimo posto conteso ════════════════════════════════════════════════════════════════════════
echo "Ultimo posto conteso da registrazioni parallele (processi veri)\n";
$allOneWinner = true;
$detail = '';
for ($round = 1; $round <= 4; $round++) {
    mk("gara-$round", 'plus', 30, 1);
    $res = parallelRegister([regBody("scgara{$round}a", "gara-$round"), regBody("scgara{$round}b", "gara-$round"), regBody("scgara{$round}c", "GARA-$round")]);
    $codes = array_map(function ($x) { return $x[0]; }, $res);
    sort($codes);
    $users = userCount("scgara{$round}a") + userCount("scgara{$round}b") + userCount("scgara{$round}c");
    $uses = (int)scalar("SELECT COUNT(*) FROM gym_signup_code_uses WHERE code_id = ?", [codeId("gara-$round")]);
    $losers = array_filter($res, function ($x) { return $x[0] === 409 && ($x[1]['code'] ?? '') === 'signup_code_exhausted'; });
    if ($codes !== [201, 409, 409] || $users !== 1 || $uses !== 1 || count($losers) !== 2) {
        $allOneWinner = false;
        $detail .= " round $round: " . json_encode($res);
    }
}
check('4 giri con 3 registrazioni sull\'ultimo posto: una sola passa (201), le altre 409 esaurito, un solo account e un solo uso', $allOneWinner, $detail);

// ═══ Conferma dell'email ═════════════════════════════════════════════════════════════════════════
echo "Conferma entro i 7 giorni\n";
$r = confirm('scmario1', $m1Auth);
check('200 con signup_code {status applied, tier plus, tier_last_day = oggi italiano + 90}', $r[0] === 200 && $r[1]['signup_code'] === ['status' => 'applied', 'tier' => 'plus', 'tier_last_day' => romeLastDay(90)], $r[2]);
check('il messaggio dice che il codice è attivo', strpos($r[1]['message'], 'codice di registrazione è attivo') !== false, $r[2]);
$t = tierRow($m1);
check('livello Plus con tier_until = giorno dopo l\'ultimo, 00:00 italiane (UTC)', $t['tier'] === 'plus' && $t['tier_until'] === untilOfLastDay(romeLastDay(90)), json_encode($t));
$u = useRow($m1);
check('uso applied con applied_at', $u['status'] === 'applied' && $u['applied_at'] !== null);
$read = api('GET', '/api/user/read.php', $m1Auth);
check('read.php: Plus, tier_until ISO UTC, tier_last_day, signup_code applied', $read[1]['tier'] === 'plus' && $read[1]['tier_last_day'] === romeLastDay(90)
    && $read[1]['tier_until'] === str_replace(' ', 'T', untilOfLastDay(romeLastDay(90))) . 'Z' && $read[1]['signup_code']['status'] === 'applied', $read[2]);
check('admin: confermati 1', admGet('?id=' . codeId('mario-plus'))[1]['code']['confirmed'] === 1);
$exp = api('GET', '/api/user/export.php', $m1Auth);
check('esportazione: codice, livello, durata, stato e date (ISO con offset)', $exp[0] === 200 && ($exp[1]['signup_code']['code'] ?? '') === 'MARIO-PLUS'
    && $exp[1]['signup_code']['tier'] === 'plus' && (int)$exp[1]['signup_code']['duration_days'] === 90 && $exp[1]['signup_code']['status'] === 'applied'
    && preg_match('/^\d{4}-\d\d-\d\dT[\d:]+[+-]\d\d:\d\d$/', (string)$exp[1]['signup_code']['applied_at']) && !empty($exp[1]['signup_code']['created_at']), substr($exp[2], 0, 300));

[$pf, $pfAuth] = newAccount('scpro1', 'pro-forever');
$r = confirm('scpro1', $pfAuth);
check('Pro per sempre: applied, tier_last_day null', $r[0] === 200 && $r[1]['signup_code'] === ['status' => 'applied', 'tier' => 'pro', 'tier_last_day' => null], $r[2]);
check('livello Pro senza scadenza', tierRow($pf) === ['tier' => 'pro', 'tier_until' => null]);
$read = api('GET', '/api/user/read.php', $pfAuth);
check('read.php: Pro, tier_until null, tier_last_day null', $read[1]['tier'] === 'pro' && $read[1]['tier_until'] === null && $read[1]['tier_last_day'] === null, $read[2]);

echo "Conferma con il codice spento o scaduto nel frattempo\n";
mk('si-spegne', 'plus', 30, 3);
[$off1, $off1Auth] = newAccount('scoff1', 'si-spegne');
admPost(['action' => 'update', 'id' => codeId('si-spegne'), 'enabled' => false]);
$r = confirm('scoff1', $off1Auth);
check('spento nel frattempo: missed, l\'email risulta confermata, tier_last_day null', $r[0] === 200 && $r[1]['email_verified'] === true && $r[1]['signup_code']['status'] === 'missed'
    && $r[1]['signup_code']['tier_last_day'] === null, $r[2]);
check('il messaggio dice che il codice non si può più usare', strpos($r[1]['message'], 'resta Gratis') !== false, $r[2]);
check('resta Gratis, uso missed senza applied_at', tierRow($off1)['tier'] === 'free' && useRow($off1)['status'] === 'missed' && useRow($off1)['applied_at'] === null);
$read = api('GET', '/api/user/read.php', $off1Auth);
check('read.php: signup_code missed', $read[1]['signup_code']['status'] === 'missed' && $read[1]['tier'] === 'free', $read[2]);
check('il posto di un missed è libero', seats('si-spegne') === 0);
check('admin: missed 1', admGet('?id=' . codeId('si-spegne'))[1]['code']['missed'] === 1);
admPost(['action' => 'update', 'id' => codeId('si-spegne'), 'enabled' => true]);

mk('scade-presto', 'plus', 30, 3);
[$ex1, $ex1Auth] = newAccount('scex1', 'scade-presto');
sql("UPDATE gym_signup_codes SET expires_at = DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 HOUR) WHERE code = 'SCADE-PRESTO'");
$r = confirm('scex1', $ex1Auth);
check('scaduto nel frattempo ma entro i 7 giorni: applied (il posto era garantito)', $r[0] === 200 && $r[1]['signup_code']['status'] === 'applied' && tierRow($ex1)['tier'] === 'plus', $r[2]);

echo "Conferma dopo i 7 giorni\n";
mk('dopo-sette', 'plus', 30, 1);
[$a1, $a1Auth] = newAccount('scdopo1', 'dopo-sette');
check('un posto, occupato dal pending recente', seats('dopo-sette') === 1 && register('scdopo0', 'dopo-sette')[0] === 409);
age($a1, 8);
check('dopo 7 giorni senza conferma il posto si libera', seats('dopo-sette') === 0);
[$a2, $a2Auth] = newAccount('scdopo2', 'dopo-sette');
check('un altro si registra sul posto liberato', userId('scdopo2') > 0 && seats('dopo-sette') === 1);
$r = confirm('scdopo1', $a1Auth);
check('chi conferma dopo i 7 giorni senza posto libero: missed (resta Gratis)', $r[0] === 200 && $r[1]['signup_code']['status'] === 'missed' && tierRow($a1)['tier'] === 'free', $r[2]);
$r = confirm('scdopo2', $a2Auth);
check('chi ha il posto prenotato conferma entro i 7 giorni: applied', $r[1]['signup_code']['status'] === 'applied' && tierRow($a2)['tier'] === 'plus', $r[2]);

mk('dopo-sette-libero', 'plus', 5, 5);
[$b1, $b1Auth] = newAccount('scdopob1', 'dopo-sette-libero');
age($b1, 8);
$r = confirm('scdopob1', $b1Auth);
check('dopo 7 giorni con un posto libero e il codice acceso: applied', $r[0] === 200 && $r[1]['signup_code']['status'] === 'applied' && tierRow($b1)['tier'] === 'plus'
    && $r[1]['signup_code']['tier_last_day'] === romeLastDay(5), $r[2]);

mk('dopo-sette-scaduto', 'plus', 5, 5);
[$c1, $c1Auth] = newAccount('scdopoc1', 'dopo-sette-scaduto');
age($c1, 8);
sql("UPDATE gym_signup_codes SET expires_at = DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 HOUR) WHERE code = 'DOPO-SETTE-SCADUTO'");
$r = confirm('scdopoc1', $c1Auth);
check('dopo 7 giorni con il codice scaduto: missed', $r[1]['signup_code']['status'] === 'missed' && tierRow($c1)['tier'] === 'free', $r[2]);

mk('dopo-sette-spento', 'plus', 5, 5);
[$d1, $d1Auth] = newAccount('scdopod1', 'dopo-sette-spento');
age($d1, 8);
admPost(['action' => 'update', 'id' => codeId('dopo-sette-spento'), 'enabled' => false]);
$r = confirm('scdopod1', $d1Auth);
check('dopo 7 giorni con il codice spento: missed', $r[1]['signup_code']['status'] === 'missed', $r[2]);

echo "Posti e account eliminati\n";
mk('elimina-pending', 'plus', 30, 1);
[$e1, $e1Auth] = newAccount('scdel1', 'elimina-pending');
check('pending recente occupa il posto', seats('elimina-pending') === 1);
$r = api('POST', '/api/user/delete.php', $e1Auth, ['password' => PASSWORD]);
check('eliminazione dell\'account: 200', $r[0] === 200, $r[2]);
check('l\'uso resta con user_id NULL (lo fa la chiave esterna)', (int)scalar("SELECT COUNT(*) FROM gym_signup_code_uses WHERE code_id = ? AND user_id IS NULL", [codeId('elimina-pending')]) === 1);
check('il posto del pending eliminato si libera', seats('elimina-pending') === 0);
check('un altro può registrarsi', register('scdel1b', 'elimina-pending')[0] === 201);

mk('elimina-applied', 'plus', 30, 1);
[$f1, $f1Auth] = newAccount('scdel2', 'elimina-applied');
confirm('scdel2', $f1Auth);
check('uso applied: posto occupato', seats('elimina-applied') === 1 && useRow($f1)['status'] === 'applied');
$r = api('POST', '/api/user/delete.php', $f1Auth, ['password' => PASSWORD]);
check('eliminazione dell\'account con uso applied: 200', $r[0] === 200, $r[2]);
check('l\'uso applied resta (user_id NULL) e occupa ancora il posto', (int)scalar("SELECT COUNT(*) FROM gym_signup_code_uses WHERE code_id = ? AND user_id IS NULL AND status = 'applied'", [codeId('elimina-applied')]) === 1
    && seats('elimina-applied') === 1);
$r = register('scdel2b', 'elimina-applied');
check('e nessuno può prendere quel posto: esaurito', $r[0] === 409 && $r[1]['code'] === 'signup_code_exhausted', $r[2]);
check('nessuna riga orfana nel database dopo le eliminazioni', orphans() === 0);

echo "Pulizia notturna degli account mai confermati\n";
mk('purge-code', 'plus', 30, 1);
[$g1] = newAccount('scpurge1', 'purge-code');
sql("UPDATE gym_users SET created_at = DATE_SUB(NOW(), INTERVAL 40 DAY), unverified_notice_stage = 2, unverified_notice_at = DATE_SUB(NOW(), INTERVAL 5 DAY) WHERE id = ?", [$g1]);
exec('php ' . escapeshellarg($backend . '/tools/purge.php') . ' 2>&1', $out, $rc);
check('la pulizia elimina l\'account (esito 0)', $rc === 0 && userCount('scpurge1') === 0, implode("\n", $out));
check('l\'uso pending resta con user_id NULL, il posto è libero, nessun orfano', (int)scalar("SELECT COUNT(*) FROM gym_signup_code_uses WHERE code_id = ? AND user_id IS NULL", [codeId('purge-code')]) === 1
    && seats('purge-code') === 0 && orphans() === 0);

echo "Recupero password\n";
mk('recupero', 'pro', 20, 3);
[$h1, $h1Auth] = newAccount('screc1', 'recupero');
$token = bin2hex(random_bytes(32));
sql("INSERT INTO gym_password_resets (user_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR))", [$h1, hash('sha256', $token)]);
$r = api('POST', '/api/user/reset_password.php', null, ['token' => $token, 'new_password' => 'Nuova!Password2026']);
check('recupero password completato: 200', $r[0] === 200, $r[2]);
$t = tierRow($h1);
check('applica il codice: Pro per 20 giorni, uso applied', $t['tier'] === 'pro' && $t['tier_until'] === untilOfLastDay(romeLastDay(20)) && useRow($h1)['status'] === 'applied', json_encode($t));
// Un account già confermato che fa il recupero non riapplica nulla
$token2 = bin2hex(random_bytes(32));
sql("UPDATE gym_users SET tier = 'free', tier_until = NULL WHERE id = ?", [$h1]);
sql("INSERT INTO gym_password_resets (user_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR))", [$h1, hash('sha256', $token2)]);
api('POST', '/api/user/reset_password.php', null, ['token' => $token2, 'new_password' => 'Nuova!Password2027']);
check('secondo recupero su un account già confermato: il livello non torna', tierRow($h1)['tier'] === 'free');

echo "Cambio di indirizzo su un account già confermato\n";
mk('cambio', 'plus', 30, 3);
[$i1, $i1Auth] = newAccount('sccamb1', 'cambio');
confirm('sccamb1', $i1Auth);
sql("UPDATE gym_users SET tier = 'free', tier_until = NULL WHERE id = ?", [$i1]);
sql("UPDATE gym_email_codes SET created_at = DATE_SUB(created_at, INTERVAL 3 MINUTE) WHERE user_id = ?", [$i1]);
$r = api('POST', '/api/user/change_email.php', $i1Auth, ['email' => 'sccamb1-nuova@example.test', 'password' => PASSWORD]);
check('cambio di indirizzo: 200', $r[0] === 200, $r[2]);
$r = api('POST', '/api/user/confirm_email.php', $i1Auth, ['code' => lastCode('sccamb1-nuova@example.test')]);
check('conferma del nuovo indirizzo: 200 senza signup_code', $r[0] === 200 && !array_key_exists('signup_code', $r[1]), $r[2]);
check('nulla riapplicato: livello com\'era (Gratis), uso ancora applied', tierRow($i1)['tier'] === 'free' && useRow($i1)['status'] === 'applied');

echo "Il livello del codice non peggiora quello che l'account ha già\n";
mk('migliore', 'plus', 30, 3);
[$j1, $j1Auth] = newAccount('scbest1', 'migliore');
sql("UPDATE gym_users SET tier = 'pro', tier_until = NULL WHERE id = ?", [$j1]);
$r = confirm('scbest1', $j1Auth);
check('già Pro per sempre: resta Pro per sempre, l\'uso risulta applied', $r[0] === 200 && $r[1]['signup_code']['status'] === 'applied' && tierRow($j1) === ['tier' => 'pro', 'tier_until' => null] && useRow($j1)['status'] === 'applied', $r[2]);
check('e tier_last_day riflette l\'account (null: senza scadenza)', $r[1]['signup_code']['tier_last_day'] === null, $r[2]);

// ═══ Admin: elenco, dettaglio, modifica, eliminazione ════════════════════════════════════════════
echo "Admin: elenco a pagine\n";
$before = (int)scalar("SELECT COUNT(*) FROM gym_signup_codes");
for ($i = 1; $i <= 25; $i++) {
    sql("INSERT INTO gym_signup_codes (code, tier, max_uses) VALUES (?, 'plus', 1)", [sprintf('BULK-%02d', $i)]);
}
$total = $before + 25;
$p1 = admGet();
check('pagina 1: 20 codici, totale, pagine', $p1[0] === 200 && count($p1[1]['codes']) === 20 && $p1[1]['total'] === $total && $p1[1]['per_page'] === 20
    && $p1[1]['page'] === 1 && $p1[1]['pages'] === (int)ceil($total / 20), $p1[2]);
check('più recenti prima', $p1[1]['codes'][0]['code'] === 'BULK-25' && $p1[1]['codes'][19]['code'] === 'BULK-06');
$p2 = admGet('?page=2');
check('pagina 2: i successivi', count($p2[1]['codes']) === min(20, $total - 20) && $p2[1]['page'] === 2 && $p2[1]['codes'][0]['id'] < $p1[1]['codes'][19]['id']);
$ids = array_merge(array_column($p1[1]['codes'], 'id'), array_column($p2[1]['codes'], 'id'));
check('nessun codice ripetuto tra le pagine', count($ids) === count(array_unique($ids)));
$pLast = admGet('?page=' . ($p1[1]['pages'] + 5));
check('pagina oltre la fine: elenco vuoto', $pLast[0] === 200 && $pLast[1]['codes'] === [] && $pLast[1]['total'] === $total);
check('page non valida: pagina 1', admGet('?page=abc')[1]['page'] === 1 && admGet('?page=0')[1]['page'] === 1);
$all = [];
for ($p = 1; $p <= $p1[1]['pages']; $p++) {
    $all = array_merge($all, admGet("?page=$p")[1]['codes']);
}
$byCode = [];
foreach ($all as $row) $byCode[$row['code']] = $row;
$mp = $byCode['MARIO-PLUS'];
check('MARIO-PLUS: tutti i campi (livello, durata, posti, registrati 2, confermati 1, missed 0, assegnatario)', $mp['tier'] === 'plus' && $mp['duration_days'] === 90 && $mp['max_uses'] === 2
    && $mp['registered'] === 2 && $mp['confirmed'] === 1 && $mp['missed'] === 0 && $mp['seats_taken'] === 2 && $mp['assignee'] === 'Mario' && $mp['enabled'] === true && $mp['expired'] === false, json_encode($mp));
check('PRO-FOREVER: forever true, durata null', $byCode['PRO-FOREVER']['forever'] === true && $byCode['PRO-FOREVER']['duration_days'] === null);
check('SCADUTO: expired true', $byCode['SCADUTO']['expired'] === true);
check('SPENTO: enabled false', $byCode['SPENTO']['enabled'] === false);
check('SI-SPEGNE: missed 1 e confermati 0 (acceso di nuovo)', $byCode['SI-SPEGNE']['missed'] === 1 && $byCode['SI-SPEGNE']['confirmed'] === 0 && $byCode['SI-SPEGNE']['enabled'] === true);
check('ELIMINA-APPLIED: account eliminato ma applied conta ancora (registrati 1, confermati 1, posti 1)', $byCode['ELIMINA-APPLIED']['registered'] === 1 && $byCode['ELIMINA-APPLIED']['confirmed'] === 1 && $byCode['ELIMINA-APPLIED']['seats_taken'] === 1);
check('WITH-LAST-DAY: last_day nell\'elenco', $byCode['WITH-LAST-DAY']['last_day'] === romeLastDay(10));

echo "Admin: dettaglio\n";
$d = admGet('?id=' . codeId('mario-plus'));
check('dettaglio: codice e iscritti con nome utente, stato e date, più recenti prima', $d[0] === 200 && $d[1]['code']['code'] === 'MARIO-PLUS' && count($d[1]['uses']) === 2
    && $d[1]['uses'][0]['username'] === 'scmario2' && $d[1]['uses'][0]['status'] === 'pending' && $d[1]['uses'][1]['username'] === 'scmario1'
    && $d[1]['uses'][1]['status'] === 'applied' && !empty($d[1]['uses'][1]['applied_at']) && !empty($d[1]['uses'][1]['created_at'])
    && $d[1]['total'] === 2 && $d[1]['pages'] === 1, $d[2]);
check('il dettaglio non espone email né altri dati dell\'utente', strpos($d[2], '@example.test') === false && strpos($d[2], 'password') === false);
$d = admGet('?id=' . codeId('elimina-applied'));
check('dettaglio con account eliminato: username null e account_deleted true', $d[1]['uses'][0]['username'] === null && $d[1]['uses'][0]['account_deleted'] === true && $d[1]['uses'][0]['status'] === 'applied', $d[2]);
mk('tanti-iscritti', 'plus', 30, 30);
for ($i = 1; $i <= 22; $i++) {
    sql("INSERT INTO gym_users (username, email, password) VALUES (?, ?, 'x')", ["scmany$i", "scmany$i@example.test"]);
    sql("INSERT INTO gym_signup_code_uses (code_id, user_id, status) VALUES (?, ?, 'pending')", [codeId('tanti-iscritti'), userId("scmany$i")]);
}
$d1 = admGet('?id=' . codeId('tanti-iscritti'));
$d2 = admGet('?id=' . codeId('tanti-iscritti') . '&page=2');
check('iscritti a pagine: 20 + 2, totale 22, 2 pagine', count($d1[1]['uses']) === 20 && count($d2[1]['uses']) === 2 && $d1[1]['total'] === 22 && $d1[1]['pages'] === 2);
check('codice che non esiste: 404 code_not_found', admGet('?id=999999')[0] === 404 && admGet('?id=999999')[1]['code'] === 'code_not_found');

echo "Admin: modifica\n";
mk('modifica', 'plus', 30, 3, ['assignee' => 'Anna']);
$id = codeId('modifica');
$r = admPost(['action' => 'update', 'id' => $id, 'tier' => 'pro', 'duration_days' => 60, 'code' => 'modifica-2', 'max_uses' => 4]);
check('senza usi: livello, durata, testo e posti si cambiano', $r[0] === 200 && $r[1]['code']['tier'] === 'pro' && $r[1]['code']['duration_days'] === 60 && $r[1]['code']['code'] === 'MODIFICA-2' && $r[1]['code']['max_uses'] === 4, $r[2]);
$r = admPost(['action' => 'update', 'id' => $id, 'duration_days' => null]);
check('durata vuota senza conferma: 400 confirm_forever_required, durata invariata', $r[0] === 400 && $r[1]['code'] === 'confirm_forever_required'
    && (int)scalar("SELECT duration_days FROM gym_signup_codes WHERE id = ?", [$id]) === 60, $r[2]);
$r = admPost(['action' => 'update', 'id' => $id, 'duration_days' => '', 'confirm_forever' => true]);
check('durata vuota con conferma: per sempre', $r[0] === 200 && $r[1]['code']['forever'] === true, $r[2]);
$r = admPost(['action' => 'update', 'id' => $id, 'enabled' => false, 'assignee' => '  Luca ', 'last_day' => romeLastDay(3)]);
check('enabled, assegnatario e last_day', $r[0] === 200 && $r[1]['code']['enabled'] === false && $r[1]['code']['assignee'] === 'Luca' && $r[1]['code']['last_day'] === romeLastDay(3), $r[2]);
$r = admPost(['action' => 'update', 'id' => $id, 'last_day' => '', 'assignee' => null]);
check('last_day vuoto: non scade più; assegnatario null: tolto', $r[0] === 200 && $r[1]['code']['last_day'] === null && $r[1]['code']['assignee'] === null, $r[2]);
$r = admPost(['action' => 'update', 'id' => $id, 'last_day' => '2020-01-01']);
check('last_day passato: 400 invalid_date', $r[0] === 400 && $r[1]['code'] === 'invalid_date', $r[2]);
$r = admPost(['action' => 'update', 'id' => $id, 'enabled' => 'si']);
check('enabled non booleano: 400', $r[0] === 400 && $r[1]['code'] === 'invalid_enabled', $r[2]);
$r = admPost(['action' => 'update', 'id' => $id, 'code' => 'mario-plus']);
check('testo già usato da un altro: 409 code_taken', $r[0] === 409 && $r[1]['code'] === 'code_taken', $r[2]);
check('update senza campi: 200 invariato', admPost(['action' => 'update', 'id' => $id])[0] === 200);
check('id inesistente: 404', admPost(['action' => 'update', 'id' => 999999, 'enabled' => true])[0] === 404);
check('id non intero: 404', admPost(['action' => 'update', 'id' => 'x', 'enabled' => true])[0] === 404);

// con usi: mario-plus ha 2 posti occupati (1 applied + 1 pending recente)
$mid = codeId('mario-plus');
$r = admPost(['action' => 'update', 'id' => $mid, 'max_uses' => 1]);
check('posti sotto quelli occupati: 400 max_uses_below_taken, invariato', $r[0] === 400 && $r[1]['code'] === 'max_uses_below_taken' && (int)scalar("SELECT max_uses FROM gym_signup_codes WHERE id = ?", [$mid]) === 2, $r[2]);
$r = admPost(['action' => 'update', 'id' => $mid, 'max_uses' => 2]);
check('posti pari a quelli occupati: ammesso', $r[0] === 200 && $r[1]['code']['max_uses'] === 2, $r[2]);
$r = admPost(['action' => 'update', 'id' => $mid, 'max_uses' => 10]);
check('posti aumentati: ammesso anche con usi', $r[0] === 200 && $r[1]['code']['max_uses'] === 10, $r[2]);
$r = admPost(['action' => 'update', 'id' => $mid, 'max_uses' => 2]);
check('posti riportati al numero degli occupati: ammesso', $r[0] === 200, $r[2]);
check('dopo l\'aumento i posti nuovi sono usabili', (admPost(['action' => 'update', 'id' => $mid, 'max_uses' => 3])[0] === 200) && register('scmario4', 'mario-plus')[0] === 201);
foreach ([['tier' => 'pro'], ['duration_days' => 10], ['code' => 'mario-nuovo']] as $change) {
    $r = admPost(['action' => 'update', 'id' => $mid] + $change);
    check('con usi: ' . key($change) . ' non si cambia (409 code_has_uses)', $r[0] === 409 && $r[1]['code'] === 'code_has_uses', $r[2]);
}
check('con usi: i valori invariati sono ammessi (modulo con tutti i campi)', admPost(['action' => 'update', 'id' => $mid, 'tier' => 'plus', 'duration_days' => 90, 'code' => ' mario-plus ', 'max_uses' => 3, 'enabled' => true, 'assignee' => 'Mario'])[0] === 200);
$kept = rows("SELECT tier, duration_days, code FROM gym_signup_codes WHERE id = ?", [$mid])[0];
check('con usi: tier, durata e testo sono rimasti', $kept['tier'] === 'plus' && (int)$kept['duration_days'] === 90 && $kept['code'] === 'MARIO-PLUS', json_encode($kept));
check('con usi: enabled, assegnatario e last_day sempre', admPost(['action' => 'update', 'id' => $mid, 'enabled' => false, 'assignee' => 'Marco', 'last_day' => romeLastDay(5)])[0] === 200);
admPost(['action' => 'update', 'id' => $mid, 'enabled' => true, 'last_day' => '']);
check('un codice con usi ma tutti missed: livello e durata restano bloccati (ha usi)', admPost(['action' => 'update', 'id' => codeId('si-spegne'), 'tier' => 'pro'])[0] === 409);

echo "Admin: elimina\n";
mk('da-eliminare', 'plus', 5, 1);
$r = admPost(['action' => 'delete', 'id' => codeId('da-eliminare')]);
check('senza usi: eliminato', $r[0] === 200 && codeId('da-eliminare') === 0, $r[2]);
$r = admPost(['action' => 'delete', 'id' => $mid]);
check('con usi: 409 code_has_uses, il codice resta', $r[0] === 409 && $r[1]['code'] === 'code_has_uses' && codeId('mario-plus') === $mid, $r[2]);
$r = admPost(['action' => 'delete', 'id' => codeId('elimina-applied')]);
check('con un uso il cui account è stato eliminato: non si elimina', $r[0] === 409 && codeId('elimina-applied') > 0, $r[2]);
check('delete di un id inesistente: 404', admPost(['action' => 'delete', 'id' => 999999])[0] === 404);

echo "Nessuna riga orfana alla fine\n";
check('nessuna chiave esterna senza genitore', orphans() === 0);

finishTest();
