<?php
// Eseguito da tests/weight_unit.sh (serve un database con lo schema del repo).
// Argomenti: cartella backend da provare, fase.
//
// Unità di peso dell'account, lato server: avvia il server integrato di PHP sul backend e chiama gli endpoint veri.
$backend = $argv[1];
require $backend . '/config/database.php';
require __DIR__ . '/lib/http_test.php';
require __DIR__ . '/lib/server_test.php';

const PASSWORD = 'Prova!Unita2026';
const PORT_A = 8095;  // limiti per IP alti
const PORT_B = 8094;  // al massimo 2 richieste di proposta per IP

foreach (['RL_REGISTER_MAX', 'RL_LOGIN_IP_MAX', 'RL_LOGIN_USER_MAX', 'RL_LOGIN_ACCOUNT_MAX', 'RL_CHECK_IP_MAX'] as $v) {
    putenv("$v=1000");
}
putenv('MAIL_DRIVER=log');

startServer($backend, PORT_A, '/tmp/wu-a.log', []);
startServer($backend, PORT_B, '/tmp/wu-b.log', ['RL_CHECK_IP_MAX' => '2']);

$conn = (new Database())->getConnection();

function scalar($query, $params = [])
{
    global $conn;
    return dbScalar($conn, $query, $params);
}
function api($method, $path, $auth = null, $body = null, $port = PORT_A, $extra = [])
{
    return httpApi($port, $method, $path, $auth, $body, $extra);
}
function regBody($name, $extra = [])
{
    return [
        'username' => $name, 'email' => "$name@example.test", 'password' => PASSWORD,
        'birth_date' => '1990-01-01', 'gender' => 'M', 'accept_terms' => true, 'locale' => 'it',
    ] + $extra;
}
function bearer($name)
{
    $r = api('POST', '/api/user/mobile_login.php', null, ['username' => $name, 'password' => PASSWORD]);
    return ['bearer' => $r[1]['token'] ?? ''];
}
function unitOf($name)
{
    return scalar("SELECT weight_unit FROM gym_users WHERE username = ?", [$name]);
}
function userCount($name)
{
    return (int)scalar("SELECT COUNT(*) FROM gym_users WHERE username = ?", [$name]);
}

echo "Registrazione\n";
$r = api('POST', '/api/user/register.php', null, regBody('wuplain'));
check('senza il campo: 201 e kg', $r[0] === 201 && unitOf('wuplain') === 'kg', $r[2]);
$r = api('POST', '/api/user/register.php', null, regBody('wulb', ['weight_unit' => 'lb']));
check('con lb: 201 e lb', $r[0] === 201 && unitOf('wulb') === 'lb', $r[2]);
$r = api('POST', '/api/user/register.php', null, regBody('wukg', ['weight_unit' => 'kg']));
check('con kg: 201 e kg', $r[0] === 201 && unitOf('wukg') === 'kg', $r[2]);
foreach ([['st'], ['LB'], [''], [5], [null], [['lb']], [true]] as [$bad]) {
    $name = 'wubad' . substr(md5(json_encode($bad)), 0, 6);
    $r = api('POST', '/api/user/register.php', null, regBody($name, ['weight_unit' => $bad]));
    check('valore non valido ' . json_encode($bad) . ': 400, nessun account', $r[0] === 400 && ($r[1]['success'] ?? null) === false && userCount($name) === 0, $r[2]);
}
$r = api('POST', '/api/user/register.php', null, regBody('wubaden', ['weight_unit' => 'st']), PORT_A, ['X-Locale: en']);
check('messaggio in inglese', $r[0] === 400 && $r[1]['message'] === 'Weight unit not supported.', $r[2]);
$r = api('POST', '/api/user/register.php', null, regBody('wubadit', ['weight_unit' => 'st']));
check('messaggio in italiano', $r[0] === 400 && $r[1]['message'] === 'Unità di peso non supportata.', $r[2]);

echo "Lettura\n";
$kg = bearer('wuplain');
$lb = bearer('wulb');
$r = api('GET', '/api/user/read.php', $kg);
check('read.php: kg per chi non ha scelto', $r[0] === 200 && ($r[1]['weight_unit'] ?? null) === 'kg', $r[2]);
$r = api('GET', '/api/user/read.php', $lb);
check('read.php: lb per chi l\'ha scelta', $r[0] === 200 && ($r[1]['weight_unit'] ?? null) === 'lb', $r[2]);

echo "Impostazioni\n";
$r = api('POST', '/api/user/update_settings.php', $kg, ['weight_unit' => 'lb']);
check('update_settings: lb → 200, risposta e database', $r[0] === 200 && ($r[1]['weight_unit'] ?? null) === 'lb' && unitOf('wuplain') === 'lb', $r[2]);
check('read.php la rilegge', (api('GET', '/api/user/read.php', $kg)[1]['weight_unit'] ?? null) === 'lb');
$r = api('POST', '/api/user/update_settings.php', $kg, ['weight_unit' => 'kg']);
check('update_settings: di nuovo kg', $r[0] === 200 && ($r[1]['weight_unit'] ?? null) === 'kg' && unitOf('wuplain') === 'kg', $r[2]);
$r = api('POST', '/api/user/update_settings.php', $kg, ['rest_timer_enabled' => false]);
check('un\'altra impostazione non cambia l\'unità e la risposta la riporta', $r[0] === 200 && ($r[1]['weight_unit'] ?? null) === 'kg', $r[2]);
$r = api('POST', '/api/user/update_settings.php', $lb, ['gender' => 'F']);
check('l\'unità lb resta con un\'altra impostazione', $r[0] === 200 && ($r[1]['weight_unit'] ?? null) === 'lb' && unitOf('wulb') === 'lb', $r[2]);
foreach ([['st'], ['LB'], [''], [5], [null], [['lb']]] as [$bad]) {
    $r = api('POST', '/api/user/update_settings.php', $lb, ['weight_unit' => $bad]);
    check('valore non valido ' . json_encode($bad) . ': 400, unità invariata', $r[0] === 400 && ($r[1]['success'] ?? null) === false && unitOf('wulb') === 'lb', $r[2]);
}
$r = api('POST', '/api/user/update_settings.php', $lb, ['weight_unit' => 'st'], PORT_A, ['X-Locale: en']);
check('update_settings: messaggio tradotto (account italiano → italiano)', $r[0] === 400 && $r[1]['message'] === 'Unità di peso non supportata.', $r[2]);

echo "Proposta dell'unità da Accept-Language\n";
$cases = [
    ['en-US,en;q=0.9', 'lb'], ['en-us', 'lb'], ['EN-US', 'lb'], ['es-US,es;q=0.9', 'lb'], ['en-Latn-US', 'lb'], ['en-US;q=0.8', 'lb'],
    ['  en-US , it', 'lb'], ['it-IT,it;q=0.9,en-US;q=0.8', 'kg'], ['it-IT', 'kg'], ['en-GB', 'kg'], ['en', 'kg'], ['en-GB,en-US;q=0.9', 'kg'],
    ['en-USA', 'kg'], ['en,en-US', 'kg'], ['en-AUS', 'kg'], ['*', 'kg'], [',en-US', 'kg'], ['-US', 'kg'], ['en-', 'kg'], ['garbage;;;', 'kg'], ['US', 'kg'], ['', 'kg'],
];
foreach ($cases as [$header, $expected]) {
    $r = api('GET', '/api/user/suggested_unit.php', null, null, PORT_A, ["Accept-Language: $header"]);
    check("Accept-Language «{$header}» → $expected", $r[0] === 200 && ($r[1]['suggested_weight_unit'] ?? null) === $expected && ($r[1]['success'] ?? null) === true, $r[2]);
}
// Senza intestazione: la chiamata di file_get_contents non ne manda
$r = api('GET', '/api/user/suggested_unit.php');
check('intestazione assente → kg', $r[0] === 200 && ($r[1]['suggested_weight_unit'] ?? null) === 'kg', $r[2]);
// La proposta non lascia tracce: nessun cookie e nessuna tabella cambia, tranne il conteggio del limite di frequenza
function tableChecksums()
{
    global $conn;
    $out = [];
    foreach ($conn->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN) as $t) {
        if ($t === 'gym_rate_limits') continue;
        $out[$t] = $conn->query("CHECKSUM TABLE `$t`")->fetch(PDO::FETCH_NUM)[1];
    }
    return $out;
}
$before = tableChecksums();
$r = api('GET', '/api/user/suggested_unit.php', null, null, PORT_A, ['Accept-Language: en-US']);
check('nessun Set-Cookie nella risposta', $r[0] === 200 && count(preg_grep('/^Set-Cookie:/i', $r[3])) === 0, implode("\n", $r[3]));
check('nessuna tabella cambia, oltre a gym_rate_limits', $before === tableChecksums() && count($before) > 10);
$r = api('POST', '/api/user/suggested_unit.php', null, [], PORT_A, ['Accept-Language: en-US']);
check('solo GET: POST → 405', $r[0] === 405, $r[2]);
$headers = implode("\n", api('GET', '/api/user/suggested_unit.php', null, null, PORT_A, ['Accept-Language: en-US'])[3]);
check('risposta JSON', stripos($headers, 'Content-Type: application/json') !== false, $headers);
$conn->exec('DELETE FROM gym_rate_limits'); // le richieste di prima hanno già contato
foreach ([1, 2] as $i) {
    $r = api('GET', '/api/user/suggested_unit.php', null, null, PORT_B, ['Accept-Language: en-US']);
    check("limite per IP: richiesta $i → 200", $r[0] === 200, $r[2]);
}
$r = api('GET', '/api/user/suggested_unit.php', null, null, PORT_B, ['Accept-Language: en-US']);
check('limite per IP: la terza → 429', $r[0] === 429, $r[2]);

finishTest();
