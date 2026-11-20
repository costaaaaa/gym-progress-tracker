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
check('un account nuovo ha tutti i moduli non attivi e modules_chosen_at NULL',
    stored('mofull') === '00000' && scalar("SELECT modules_chosen_at IS NULL FROM gym_users WHERE username = 'mofull'") == 1);
$r = api('POST', '/api/user/register.php', null, regBody('mopart'));
check('registrazione di mopart: 201', $r[0] === 201, $r[2]);
// Un account che esisteva prima (inserito a mano: default delle colonne) resta com'è
$conn->exec("INSERT INTO gym_users (username, email, password, modules_chosen_at) VALUES ('moold', 'moold@example.test', " . $conn->quote(password_hash(PASSWORD, PASSWORD_BCRYPT)) . ", NOW())");
check('un account esistente (default delle colonne) ha tutto attivo e la scelta già fatta', stored('moold') === '11111');

echo "Login di un account appena registrato\n";
$r = api('POST', '/api/user/login.php', null, ['username' => 'mopart', 'password' => PASSWORD]);
check('login web subito dopo la registrazione: user.modules tutti false e user.modules_chosen false',
    $r[0] === 200 && ($r[1]['user']['modules'] ?? null) === array_fill_keys(KEYS, false) && ($r[1]['user']['modules_chosen'] ?? null) === false, $r[2]);

echo "Lettura\n";
$a = bearer('mofull');
$r = api('GET', '/api/user/read.php', $a);
check('read.php: modules con le cinque chiavi booleane, tutte false per un account nuovo', $r[0] === 200 && ($r[1]['modules'] ?? null) === array_fill_keys(KEYS, false), $r[2]);
check('read.php: modules_chosen false per chi non ha scelto', ($r[1]['modules_chosen'] ?? null) === false, $r[2]);
$conn->exec("UPDATE gym_users SET module_body = 1, module_recovery = 1, module_groups = 1, module_ai = 1, module_levels = 0, modules_chosen_at = NOW() WHERE username = 'mofull'");
$r = api('GET', '/api/user/read.php', $a);
check('read.php riflette il database: levels false, il resto true',
    ($r[1]['modules'] ?? null) === ['body' => true, 'recovery' => true, 'levels' => false, 'groups' => true, 'ai' => true], $r[2]);
check('read.php: modules_chosen true con modules_chosen_at pieno', ($r[1]['modules_chosen'] ?? null) === true, $r[2]);
$conn->exec("UPDATE gym_users SET module_levels = 1, modules_chosen_at = NULL WHERE username = 'mofull'");
$r = api('GET', '/api/user/read.php', bearer('moold'));
check('read.php: un account esistente ha tutto attivo e modules_chosen true', ($r[1]['modules'] ?? null) === allOn() && ($r[1]['modules_chosen'] ?? null) === true, $r[2]);

echo "Login\n";
$conn->exec("UPDATE gym_users SET module_groups = 0 WHERE username = 'mofull'");
$r = api('POST', '/api/user/login.php', null, ['username' => 'mofull', 'password' => PASSWORD]);
check('login web: user.modules come in read.php (groups non attivo, il resto attivo), subito, senza rilettura',
    $r[0] === 200 && ($r[1]['user']['modules'] ?? null) === ['body' => true, 'recovery' => true, 'levels' => true, 'groups' => false, 'ai' => true], $r[2]);
check('login web: user.modules_chosen false (nessuna scelta ancora)', ($r[1]['user']['modules_chosen'] ?? null) === false, $r[2]);
check('login web: id, username e locale come prima', ($r[1]['user']['username'] ?? null) === 'mofull' && isset($r[1]['user']['id'], $r[1]['user']['locale']), $r[2]);
$webLogin = $r;
$expected = ['body' => true, 'recovery' => true, 'levels' => true, 'groups' => false, 'ai' => true];
$r = api('POST', '/api/user/mobile_login.php', null, ['username' => 'mofull', 'password' => PASSWORD]);
$read = api('GET', '/api/user/read.php', ['bearer' => $r[1]['token'] ?? '']);
check('login con token: user.modules come in login.php e in read.php (groups non attivo, il resto attivo), subito',
    $r[0] === 200 && ($r[1]['user']['modules'] ?? null) === $expected
    && ($webLogin[1]['user']['modules'] ?? null) === $expected && ($read[1]['modules'] ?? null) === $expected, $r[2]);
check('login con token: user.modules_chosen false (nessuna scelta ancora), come in login.php',
    ($r[1]['user']['modules_chosen'] ?? null) === false && ($webLogin[1]['user']['modules_chosen'] ?? 'x') === false, $r[2]);
check('login con token: id, username e locale come prima',
    ($r[1]['user']['username'] ?? null) === 'mofull' && isset($r[1]['user']['id'], $r[1]['user']['locale']), $r[2]);
$r = api('POST', '/api/user/mobile_login.php', null, ['username' => 'mopart', 'password' => PASSWORD]);
check('login con token di un account appena registrato: modules tutti false e modules_chosen false',
    $r[0] === 200 && ($r[1]['user']['modules'] ?? null) === array_fill_keys(KEYS, false) && ($r[1]['user']['modules_chosen'] ?? null) === false, $r[2]);
$conn->exec("UPDATE gym_users SET modules_chosen_at = NOW() WHERE username = 'mofull'");
$r = api('POST', '/api/user/mobile_login.php', null, ['username' => 'mofull', 'password' => PASSWORD]);
$web = api('POST', '/api/user/login.php', null, ['username' => 'mofull', 'password' => PASSWORD]);
$read = api('GET', '/api/user/read.php', ['bearer' => $r[1]['token'] ?? '']);
check('login con token dopo la scelta: modules_chosen true, come in login.php e in read.php',
    ($r[1]['user']['modules_chosen'] ?? null) === true && ($web[1]['user']['modules_chosen'] ?? null) === true
    && ($read[1]['modules_chosen'] ?? null) === true, $r[2]);
$conn->exec("UPDATE gym_users SET modules_chosen_at = NULL WHERE username = 'mofull'");
$conn->exec("UPDATE gym_users SET module_groups = 1 WHERE username = 'mofull'");

echo "Impostazioni\n";
$p = bearer('mopart');
$conn->exec("UPDATE gym_users SET module_body = 1, module_recovery = 1, module_levels = 1, module_groups = 1, module_ai = 1 WHERE username = 'mopart'");
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
check('senza modules_chosen la data non si scrive', scalar("SELECT modules_chosen_at IS NULL FROM gym_users WHERE username = 'mopart'") == 1);
check('la risposta riporta modules_chosen false', ($r[1]['modules_chosen'] ?? null) === false, $r[2]);

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

echo "Chiusura della scelta\n";
foreach (['false' => false, 'stringa "true"' => 'true', 'numero 1' => 1, 'null' => null, 'lista' => [true]] as $label => $v) {
    $r = api('POST', '/api/user/update_settings.php', $p, ['modules_chosen' => $v]);
    check("modules_chosen $label: 400 con il messaggio dei moduli, nessuna modifica",
        $r[0] === 400 && ($r[1]['message'] ?? '') === 'Module not supported.' && stored('mopart') === '11110'
        && scalar("SELECT modules_chosen_at IS NULL FROM gym_users WHERE username = 'mopart'") == 1, $r[2]);
}
$r = api('POST', '/api/user/update_settings.php', $p, ['modules' => ['body' => false], 'modules_chosen' => 'si']);
check('modules validi con modules_chosen non valido: 400 e anche i moduli restano', $r[0] === 400 && stored('mopart') === '11110', $r[2]);
api('POST', '/api/user/update_settings.php', $p, ['locale' => 'it']);
$conn->exec("UPDATE gym_users SET module_body = 0, module_recovery = 0, module_levels = 0, module_groups = 0, module_ai = 0 WHERE username = 'mopart'");
$r = api('POST', '/api/user/update_settings.php', $p, ['modules' => ['body' => true, 'levels' => true], 'modules_chosen' => true]);
check('modules + modules_chosen insieme: 200, moduli salvati, modules_chosen true nella risposta',
    $r[0] === 200 && stored('mopart') === '10100' && ($r[1]['modules_chosen'] ?? null) === true, $r[2]);
check('modules_chosen_at scritta', scalar("SELECT modules_chosen_at IS NOT NULL FROM gym_users WHERE username = 'mopart'") == 1);
check('read.php: modules_chosen true', (api('GET', '/api/user/read.php', $p)[1]['modules_chosen'] ?? null) === true);
$conn->exec("UPDATE gym_users SET modules_chosen_at = '2026-01-02 03:04:05' WHERE username = 'mopart'");
$r = api('POST', '/api/user/update_settings.php', $p, ['modules_chosen' => true]);
check('seconda chiamata con modules_chosen da solo: 200 e la data non cambia',
    $r[0] === 200 && ($r[1]['modules_chosen'] ?? null) === true && scalar("SELECT modules_chosen_at FROM gym_users WHERE username = 'mopart'") === '2026-01-02 03:04:05', $r[2]);
$r = api('POST', '/api/user/update_settings.php', $p, ['modules' => ['body' => false], 'modules_chosen' => true]);
check('seconda chiamata con modules: i moduli cambiano, la data no', $r[0] === 200 && stored('mopart') === '00100'
    && scalar("SELECT modules_chosen_at FROM gym_users WHERE username = 'mopart'") === '2026-01-02 03:04:05', $r[2]);
$q = bearer('mofull');
$conn->exec("UPDATE gym_users SET module_body = 0, module_recovery = 0, module_levels = 0, module_groups = 0, module_ai = 0, modules_chosen_at = NULL WHERE username = 'mofull'");
$r = api('POST', '/api/user/update_settings.php', $q, ['modules_chosen' => true]);
check('modules_chosen da solo su un account nuovo: 200, moduli non attivi, data scritta',
    $r[0] === 200 && stored('mofull') === '00000' && scalar("SELECT modules_chosen_at IS NOT NULL FROM gym_users WHERE username = 'mofull'") == 1, $r[2]);
$r = api('POST', '/api/user/login.php', null, ['username' => 'mofull', 'password' => PASSWORD]);
check('login web: user.modules_chosen true dopo la scelta', ($r[1]['user']['modules_chosen'] ?? null) === true, $r[2]);

echo "Nessun blocco lato server\n";
api('POST', '/api/user/update_settings.php', $p, ['modules' => ['groups' => false, 'levels' => false, 'body' => false, 'recovery' => false, 'ai' => false]]);
check('tutti i moduli non attivi', stored('mopart') === '00000');
$r = api('GET', '/api/groups/list.php', $p);
check('i gruppi si leggono lo stesso (200)', $r[0] === 200, $r[2]);
$r = api('GET', '/api/gamification/profile.php', $p);
check('il profilo dei livelli si legge lo stesso (200)', $r[0] === 200, $r[2]);

echo "Esportazione\n";
$r = api('GET', '/api/user/export.php', $p);
$profile = $r[1]['profile'] ?? [];
check('export: la sezione profile elenca i moduli e modules_chosen_at',
    $r[0] === 200 && array_key_exists('module_body', $profile) && array_key_exists('module_ai', $profile) && array_key_exists('modules_chosen_at', $profile), $r[2]);
check('export: valori dei moduli come nel database (non attivi = 0)', ($profile['module_groups'] ?? null) == 0 && ($profile['module_body'] ?? null) == 0);

finishTest();
