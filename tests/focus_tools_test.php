<?php
// Eseguito da tests/focus_tools.sh (serve un database con lo schema del repo).
// Argomenti: cartella backend da provare, fase.
//
// Strumenti della serie del Focus, lato server: le due opzioni dell'account (focus_tool_technique,
// focus_tool_suggested_weight), user/read.php, user/update_settings.php e user/export.php.
$backend = $argv[1];
require $backend . '/config/database.php';
require __DIR__ . '/lib/http_test.php';
require __DIR__ . '/lib/server_test.php';

const PASSWORD = 'Prova!Strumenti2026';
const PORT_A = 8110;

foreach (['RL_REGISTER_MAX', 'RL_LOGIN_IP_MAX', 'RL_LOGIN_USER_MAX', 'RL_LOGIN_ACCOUNT_MAX', 'RL_CHECK_IP_MAX'] as $v) {
    putenv("$v=1000");
}
putenv('MAIL_DRIVER=log');
putenv('GYM_API_SECRET=prova-focus-strumenti-segreto');

startServer($backend, PORT_A, '/tmp/ft-a.log', []);

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
// Le due colonne come stringa di 0 e 1: tecnica, peso suggerito
function stored($name)
{
    return scalar("SELECT CONCAT(focus_tool_technique, focus_tool_suggested_weight) FROM gym_users WHERE username = ?", [$name]);
}
function setStored($name, $bits)
{
    global $conn;
    $conn->prepare("UPDATE gym_users SET focus_tool_technique = ?, focus_tool_suggested_weight = ? WHERE username = ?")
        ->execute([(int)$bits[0], (int)$bits[1], $name]);
}
function tools($technique, $weight)
{
    return ['technique' => $technique, 'suggested_weight' => $weight];
}

echo "Registrazione e lettura\n";
$r = api('POST', '/api/user/register.php', null, regBody('ftnew'));
check('registrazione: 201', $r[0] === 201, $r[2]);
check('un account nuovo ha le due colonne a 1', stored('ftnew') === '11');
$n = bearer('ftnew');
$r = api('GET', '/api/user/read.php', $n);
check('read.php: focus_tools con le due chiavi booleane, entrambe true', $r[0] === 200 && ($r[1]['focus_tools'] ?? null) === tools(true, true), $r[2]);
setStored('ftnew', '10');
$r = api('GET', '/api/user/read.php', $n);
check('read.php riporta i valori salvati', ($r[1]['focus_tools'] ?? null) === tools(true, false), $r[2]);
setStored('ftnew', '01');
check('read.php riporta anche l\'altra combinazione', (api('GET', '/api/user/read.php', $n)[1]['focus_tools'] ?? null) === tools(false, true));
$r = api('POST', '/api/user/login.php', null, ['username' => 'ftnew', 'password' => PASSWORD]);
check('il login web non cambia: niente focus_tools', $r[0] === 200 && !array_key_exists('focus_tools', $r[1]['user'] ?? []), $r[2]);
$r = api('POST', '/api/user/mobile_login.php', null, ['username' => 'ftnew', 'password' => PASSWORD]);
check('il login con token non cambia: niente focus_tools', $r[0] === 200 && !array_key_exists('focus_tools', $r[1]['user'] ?? []), $r[2]);
setStored('ftnew', '11');

echo "Impostazioni\n";
$r = api('POST', '/api/user/update_settings.php', $n, ['focus_tools' => ['technique' => false]]);
check('update_settings: una sola chiave → 200 e focus_tools aggiornato (l\'altra resta)',
    $r[0] === 200 && ($r[1]['focus_tools'] ?? null) === tools(false, true) && stored('ftnew') === '01', $r[2]);
check('read.php la rilegge', (api('GET', '/api/user/read.php', $n)[1]['focus_tools']['technique'] ?? null) === false);
$r = api('POST', '/api/user/update_settings.php', $n, ['focus_tools' => ['suggested_weight' => false]]);
check('update_settings: l\'altra chiave, la precedente resta', $r[0] === 200 && ($r[1]['focus_tools'] ?? null) === tools(false, false) && stored('ftnew') === '00', $r[2]);
$r = api('POST', '/api/user/update_settings.php', $n, ['focus_tools' => ['technique' => true, 'suggested_weight' => true]]);
check('due chiavi insieme: si riaccende tutto', $r[0] === 200 && ($r[1]['focus_tools'] ?? null) === tools(true, true) && stored('ftnew') === '11', $r[2]);
$r = api('POST', '/api/user/update_settings.php', $n, ['gender' => 'F']);
check('un\'altra impostazione non cambia gli strumenti e la risposta li riporta',
    $r[0] === 200 && stored('ftnew') === '11' && ($r[1]['focus_tools'] ?? null) === tools(true, true), $r[2]);
setStored('ftnew', '01');
$r = api('POST', '/api/user/update_settings.php', $n, ['gender' => 'M']);
check('un\'altra impostazione non riaccende uno strumento spento', $r[0] === 200 && stored('ftnew') === '01', $r[2]);
setStored('ftnew', '11');
$r = api('POST', '/api/user/update_settings.php', $n, [
    'focus_tools' => ['suggested_weight' => false], 'rest_timer_enabled' => false, 'group_visibility' => ['level' => false],
]);
check('strumenti, timer di recupero e visibilità nei gruppi nella stessa richiesta',
    $r[0] === 200 && stored('ftnew') === '10' && ($r[1]['rest_timer_enabled'] ?? null) === false
    && ($r[1]['group_visibility']['level'] ?? null) === false && ($r[1]['focus_tools'] ?? null) === tools(true, false), $r[2]);
check('il timer di recupero e la visibilità sono quelli salvati',
    scalar("SELECT rest_timer_enabled FROM gym_users WHERE username = 'ftnew'") == 0
    && scalar("SELECT group_show_level FROM gym_users WHERE username = 'ftnew'") == 0);
setStored('ftnew', '11');
$r = api('POST', '/api/user/update_settings.php', $n, ['focus_tools' => new stdClass(), 'gender' => 'F']);
check('focus_tools vuoto con un\'altra impostazione valida: 200, l\'altra salvata, gli strumenti invariati',
    $r[0] === 200 && ($r[1]['gender'] ?? null) === 'F' && stored('ftnew') === '11' && ($r[1]['focus_tools'] ?? null) === tools(true, true), $r[2]);
setStored('ftnew', '10');
$r = api('GET', '/api/user/export.php', $n);
$profile = $r[1]['profile'] ?? [];
check('export: il profilo ha le due colonne focus_tool_* con i valori salvati',
    $r[0] === 200 && (string)($profile['focus_tool_technique'] ?? '') === '1' && (string)($profile['focus_tool_suggested_weight'] ?? '') === '0', $r[2]);
setStored('ftnew', '11');

$bads = [
    'chiave sconosciuta' => ['rest_timer' => false],
    'una buona e una sconosciuta' => ['technique' => false, 'rest_timer' => false],
    'valore 0' => ['technique' => 0],
    'valore 1' => ['technique' => 1],
    'valore "true"' => ['technique' => 'true'],
    'valore "false"' => ['suggested_weight' => 'false'],
    'valore null' => ['technique' => null],
    'valore array' => ['technique' => [false]],
    'una buona e un valore non booleano' => ['suggested_weight' => false, 'technique' => 1],
];
foreach ($bads as $label => $tools) {
    $r = api('POST', '/api/user/update_settings.php', $n, ['focus_tools' => $tools]);
    check("$label: 400, nessuna modifica", $r[0] === 400 && ($r[1]['success'] ?? null) === false && stored('ftnew') === '11', $r[2]);
}
foreach (['null' => null, 'una lista' => [true], 'una lista vuota' => [], 'una stringa' => 'tutti', 'un booleano' => true] as $label => $tools) {
    $r = api('POST', '/api/user/update_settings.php', $n, ['focus_tools' => $tools]);
    check("focus_tools come $label: 400, nessuna modifica", $r[0] === 400 && stored('ftnew') === '11', $r[2]);
}
$r = api('POST', '/api/user/update_settings.php', $n, ['focus_tools' => new stdClass()]);
check('focus_tools oggetto vuoto da solo: 400, nessuna modifica', $r[0] === 400 && stored('ftnew') === '11', $r[2]);
$r = api('POST', '/api/user/update_settings.php', $n, ['focus_tools' => ['technique' => false], 'weight_unit' => 'st']);
check('un campo non valido accanto agli strumenti: 400 e gli strumenti restano com\'erano', $r[0] === 400 && stored('ftnew') === '11', $r[2]);
$r = api('POST', '/api/user/update_settings.php', $n, ['focus_tools' => ['technique' => false], 'group_visibility' => ['cardio' => false]]);
check('una visibilità non valida accanto agli strumenti: 400 e gli strumenti restano com\'erano', $r[0] === 400 && stored('ftnew') === '11', $r[2]);
$r = api('POST', '/api/user/update_settings.php', $n, ['group_visibility' => ['workouts' => false], 'focus_tools' => ['technique' => 1]]);
check('strumenti non validi accanto a una visibilità valida: 400 e anche la visibilità resta',
    $r[0] === 400 && scalar("SELECT group_show_workouts FROM gym_users WHERE username = 'ftnew'") == 1, $r[2]);

echo "Due utenti\n";
$r = api('POST', '/api/user/register.php', null, regBody('ftother'));
check('registrazione del secondo utente: 201', $r[0] === 201, $r[2]);
$o = bearer('ftother');
$r = api('POST', '/api/user/update_settings.php', $o, ['focus_tools' => ['technique' => false, 'suggested_weight' => false]]);
check('il secondo utente spegne i suoi strumenti', $r[0] === 200 && stored('ftother') === '00', $r[2]);
check('il primo utente non vede e non subisce il cambio',
    stored('ftnew') === '11' && (api('GET', '/api/user/read.php', $n)[1]['focus_tools'] ?? null) === tools(true, true));
$r = api('POST', '/api/user/update_settings.php', $n, ['focus_tools' => ['technique' => false]]);
check('il primo utente cambia i suoi senza toccare quelli del secondo', $r[0] === 200 && stored('ftnew') === '01' && stored('ftother') === '00', $r[2]);
check('il secondo utente legge i suoi', (api('GET', '/api/user/read.php', $o)[1]['focus_tools'] ?? null) === tools(false, false));

finishTest();
