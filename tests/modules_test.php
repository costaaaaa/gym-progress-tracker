<?php
// Eseguito da tests/modules.sh (serve un database con lo schema del repo).
// Argomenti: cartella backend da provare, fase.
//
// Moduli facoltativi dell'account, lato server: avvia il server integrato di PHP sul backend e chiama gli endpoint veri.
$backend = $argv[1];
require $backend . '/config/database.php';
require __DIR__ . '/lib/http_test.php';
require __DIR__ . '/lib/server_test.php';

const PASSWORD = 'Prova!Moduli2026';
const PORT_A = 8093;
const KEYS = ['body', 'recovery', 'levels', 'groups', 'ai'];

foreach (['RL_REGISTER_MAX', 'RL_LOGIN_IP_MAX', 'RL_LOGIN_USER_MAX', 'RL_LOGIN_ACCOUNT_MAX', 'RL_CHECK_IP_MAX'] as $v) {
    putenv("$v=1000");
}
putenv('MAIL_DRIVER=log');

startServer($backend, PORT_A, '/tmp/mo-a.log', []);

$conn = (new Database())->getConnection();

function scalar($query, $params = [])
{
    global $conn;
    return dbScalar($conn, $query, $params);
}
function api($method, $path, $auth = null, $body = null, $extra = [])
{
    return httpApi(PORT_A, $method, $path, $auth, $body, $extra);
}
function regBody($name)
{
    return [
        'username' => $name, 'email' => "$name@example.test", 'password' => PASSWORD,
        'birth_date' => '1990-01-01', 'gender' => 'M', 'accept_terms' => true, 'locale' => 'it',
    ];
}
function bearer($name)
{
    $r = api('POST', '/api/user/mobile_login.php', null, ['username' => $name, 'password' => PASSWORD]);
    return ['bearer' => $r[1]['token'] ?? ''];
}
// I cinque flag del database come stringa di 0 e 1, nell'ordine di KEYS
function stored($name)
{
    return scalar("SELECT CONCAT(module_body, module_recovery, module_levels, module_groups, module_ai) FROM gym_users WHERE username = ?", [$name]);
}
function allOn()
{
    return array_fill_keys(KEYS, true);
}

echo "Registrazione\n";
$r = api('POST', '/api/user/register.php', null, regBody('mofull'));
check('registrazione: 201', $r[0] === 201, $r[2]);
check('un account nuovo ha tutti i moduli attivi e modules_chosen_at NULL (la scelta arriva con un\'altra funzione)',
    stored('mofull') === '11111' && scalar("SELECT modules_chosen_at IS NULL FROM gym_users WHERE username = 'mofull'") == 1);
api('POST', '/api/user/register.php', null, regBody('mopart'));

echo "Lettura\n";
$a = bearer('mofull');
$r = api('GET', '/api/user/read.php', $a);
check('read.php: modules con le cinque chiavi booleane, tutte true', $r[0] === 200 && ($r[1]['modules'] ?? null) === allOn(), $r[2]);
check('read.php: modules_chosen false per chi non ha scelto', ($r[1]['modules_chosen'] ?? null) === false, $r[2]);
$conn->exec("UPDATE gym_users SET module_levels = 0, modules_chosen_at = NOW() WHERE username = 'mofull'");
$r = api('GET', '/api/user/read.php', $a);
check('read.php riflette il database: levels false, il resto true',
    ($r[1]['modules'] ?? null) === ['body' => true, 'recovery' => true, 'levels' => false, 'groups' => true, 'ai' => true], $r[2]);
check('read.php: modules_chosen true con modules_chosen_at pieno', ($r[1]['modules_chosen'] ?? null) === true, $r[2]);
$conn->exec("UPDATE gym_users SET module_levels = 1, modules_chosen_at = NULL WHERE username = 'mofull'");

echo "Impostazioni\n";
$p = bearer('mopart');
$r = api('POST', '/api/user/update_settings.php', $p, ['modules' => ['groups' => false]]);
check('update_settings: una sola chiave → 200 e modules aggiornato (le altre restano)',
    $r[0] === 200 && ($r[1]['modules'] ?? null) === ['body' => true, 'recovery' => true, 'levels' => true, 'groups' => false, 'ai' => true] && stored('mopart') === '11101', $r[2]);
check('read.php la rilegge', (api('GET', '/api/user/read.php', $p)[1]['modules']['groups'] ?? null) === false);
$r = api('POST', '/api/user/update_settings.php', $p, ['modules' => ['body' => false, 'ai' => false]]);
check('update_settings: due chiavi insieme, la precedente resta',
    $r[0] === 200 && ($r[1]['modules'] ?? null) === ['body' => false, 'recovery' => true, 'levels' => true, 'groups' => false, 'ai' => false] && stored('mopart') === '01100', $r[2]);
$r = api('POST', '/api/user/update_settings.php', $p, ['modules' => ['groups' => true]]);
check('update_settings: si riattiva', $r[0] === 200 && ($r[1]['modules']['groups'] ?? null) === true && stored('mopart') === '01110', $r[2]);
$r = api('POST', '/api/user/update_settings.php', $p, ['gender' => 'F']);
check('un\'altra impostazione non cambia i moduli e la risposta li riporta', $r[0] === 200 && stored('mopart') === '01110' && ($r[1]['modules']['recovery'] ?? null) === true, $r[2]);
$r = api('POST', '/api/user/update_settings.php', $p, ['modules' => ['body' => true], 'gender' => 'M']);
check('moduli e un\'altra impostazione nella stessa richiesta', $r[0] === 200 && stored('mopart') === '11110' && ($r[1]['gender'] ?? null) === 'M', $r[2]);
check('modules_chosen_at non lo cambia questa PR', scalar("SELECT modules_chosen_at IS NULL FROM gym_users WHERE username = 'mopart'") == 1);

$bads = [
    'chiave sconosciuta' => ['cardio' => false],
    'una buona e una sconosciuta' => ['body' => false, 'cardio' => false],
    'valore 0' => ['body' => 0],
    'valore "false"' => ['body' => 'false'],
    'valore null' => ['body' => null],
    'valore array' => ['body' => [false]],
    'valore stringa vuota' => ['body' => ''],
    'una buona e un valore non booleano' => ['groups' => false, 'body' => 1],
];
foreach ($bads as $label => $modules) {
    $r = api('POST', '/api/user/update_settings.php', $p, ['modules' => $modules]);
    check("$label: 400, nessuna modifica", $r[0] === 400 && ($r[1]['success'] ?? null) === false && stored('mopart') === '11110', $r[2]);
}
foreach (['null' => null, 'una lista' => [true], 'una lista vuota' => [], 'una stringa' => 'tutti', 'un booleano' => true] as $label => $modules) {
    $r = api('POST', '/api/user/update_settings.php', $p, ['modules' => $modules]);
    check("modules come $label: 400, nessuna modifica", $r[0] === 400 && stored('mopart') === '11110', $r[2]);
}
$r = api('POST', '/api/user/update_settings.php', $p, ['modules' => new stdClass()]);
check('modules oggetto vuoto: 400 (niente da aggiornare), nessuna modifica', $r[0] === 400 && stored('mopart') === '11110', $r[2]);
$r = api('POST', '/api/user/update_settings.php', $p, ['modules' => ['cardio' => false]], ['X-Locale: en']);
check('messaggio tradotto (account italiano → italiano)', $r[0] === 400 && $r[1]['message'] === 'Modulo non supportato.', $r[2]);
api('POST', '/api/user/update_settings.php', $p, ['locale' => 'en']);
$r = api('POST', '/api/user/update_settings.php', $p, ['modules' => ['body' => 1]]);
check('messaggio in inglese per un account inglese', $r[0] === 400 && $r[1]['message'] === 'Module not supported.', $r[2]);
$r = api('POST', '/api/user/update_settings.php', $p, ['modules' => ['groups' => false], 'weight_unit' => 'st']);
check('un campo non valido accanto ai moduli: 400 e anche i moduli restano com\'erano', $r[0] === 400 && stored('mopart') === '11110', $r[2]);

echo "Nessun blocco lato server\n";
api('POST', '/api/user/update_settings.php', $p, ['modules' => ['groups' => false, 'levels' => false, 'body' => false, 'recovery' => false, 'ai' => false]]);
check('tutti i moduli non attivi', stored('mopart') === '00000');
$r = api('GET', '/api/groups/list.php', $p);
check('i gruppi si leggono lo stesso (200)', $r[0] === 200, $r[2]);
$r = api('GET', '/api/gamification/profile.php', $p);
check('il profilo dei livelli si legge lo stesso (200)', $r[0] === 200, $r[2]);

echo "Esportazione\n";
$r = api('GET', '/api/user/export.php', $p);
$profile = $r[1]['profile'][0] ?? [];
check('export: la sezione profile elenca i moduli e modules_chosen_at',
    $r[0] === 200 && array_key_exists('module_body', $profile) && array_key_exists('module_ai', $profile) && array_key_exists('modules_chosen_at', $profile), $r[2]);
check('export: valori dei moduli come nel database (non attivi = 0)', ($profile['module_groups'] ?? null) == 0 && ($profile['module_body'] ?? null) == 0);

finishTest();
