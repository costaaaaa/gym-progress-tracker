<?php
// Eseguito da tests/group_visibility.sh (serve un database con lo schema del repo).
// Argomenti: cartella backend da provare, fase.
//
// Visibilità nei gruppi, lato server: le quattro opzioni dell'account (group_show_*), user/read.php e
// user/update_settings.php, e la classifica di groups/read.php con la reciprocità dato per dato.
$backend = $argv[1];
require $backend . '/config/database.php';
require __DIR__ . '/lib/http_test.php';
require __DIR__ . '/lib/server_test.php';

const PASSWORD = 'Prova!Gruppi2026';
const PORT_A = 8094;
const KEYS = ['workouts', 'volume', 'streak', 'level'];

foreach (['RL_REGISTER_MAX', 'RL_LOGIN_IP_MAX', 'RL_LOGIN_USER_MAX', 'RL_LOGIN_ACCOUNT_MAX', 'RL_CHECK_IP_MAX'] as $v) {
    putenv("$v=1000");
}
putenv('MAIL_DRIVER=log');
putenv('GYM_API_SECRET=prova-gruppi-visibilita-segreto');

startServer($backend, PORT_A, '/tmp/gv-a.log', []);

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
// Le quattro colonne come stringa di 0 e 1, nell'ordine di KEYS
function stored($name)
{
    return scalar("SELECT CONCAT(group_show_workouts, group_show_volume, group_show_streak, group_show_level) FROM gym_users WHERE username = ?", [$name]);
}
function setStored($name, $bits)
{
    global $conn;
    $conn->prepare("UPDATE gym_users SET group_show_workouts = ?, group_show_volume = ?, group_show_streak = ?, group_show_level = ? WHERE username = ?")
        ->execute([(int)$bits[0], (int)$bits[1], (int)$bits[2], (int)$bits[3], $name]);
}
function setLevels($name, $on)
{
    global $conn;
    $conn->prepare("UPDATE gym_users SET module_levels = ? WHERE username = ?")->execute([$on ? 1 : 0, $name]);
}
function allOn()
{
    return array_fill_keys(KEYS, true);
}
function allOff()
{
    return array_fill_keys(KEYS, false);
}

echo "Registrazione e lettura\n";
$r = api('POST', '/api/user/register.php', null, regBody('gvnew'));
check('registrazione: 201', $r[0] === 201, $r[2]);
check('un account nuovo ha le quattro colonne a 1', stored('gvnew') === '1111');
$n = bearer('gvnew');
$r = api('GET', '/api/user/read.php', $n);
check('read.php: group_visibility con le quattro chiavi booleane, tutte true', $r[0] === 200 && ($r[1]['group_visibility'] ?? null) === allOn(), $r[2]);
setStored('gvnew', '1010');
$r = api('GET', '/api/user/read.php', $n);
check('read.php riporta i valori salvati',
    ($r[1]['group_visibility'] ?? null) === ['workouts' => true, 'volume' => false, 'streak' => true, 'level' => false], $r[2]);
setStored('gvnew', '0111');
setLevels('gvnew', false);
$r = api('GET', '/api/user/read.php', $n);
check('read.php riporta i valori salvati, non quelli effettivi (modulo Livelli non attivo, allenamenti spenti)',
    ($r[1]['group_visibility'] ?? null) === ['workouts' => false, 'volume' => true, 'streak' => true, 'level' => true], $r[2]);
$r = api('POST', '/api/user/login.php', null, ['username' => 'gvnew', 'password' => PASSWORD]);
check('il login web non cambia: niente group_visibility', $r[0] === 200 && !array_key_exists('group_visibility', $r[1]['user'] ?? []), $r[2]);
$r = api('POST', '/api/user/mobile_login.php', null, ['username' => 'gvnew', 'password' => PASSWORD]);
check('il login con token non cambia: niente group_visibility', $r[0] === 200 && !array_key_exists('group_visibility', $r[1]['user'] ?? []), $r[2]);
setStored('gvnew', '1111');

echo "Impostazioni\n";
$r = api('POST', '/api/user/update_settings.php', $n, ['group_visibility' => ['volume' => false]]);
check('update_settings: una sola chiave → 200 e group_visibility aggiornato (le altre restano)',
    $r[0] === 200 && ($r[1]['group_visibility'] ?? null) === ['workouts' => true, 'volume' => false, 'streak' => true, 'level' => true] && stored('gvnew') === '1011', $r[2]);
check('read.php la rilegge', (api('GET', '/api/user/read.php', $n)[1]['group_visibility']['volume'] ?? null) === false);
$r = api('POST', '/api/user/update_settings.php', $n, ['group_visibility' => ['streak' => false, 'level' => false]]);
check('update_settings: due chiavi insieme, la precedente resta',
    $r[0] === 200 && ($r[1]['group_visibility'] ?? null) === ['workouts' => true, 'volume' => false, 'streak' => false, 'level' => false] && stored('gvnew') === '1000', $r[2]);
$r = api('POST', '/api/user/update_settings.php', $n, ['group_visibility' => ['workouts' => false]]);
check('spegnere gli allenamenti non tocca il volume salvato', $r[0] === 200 && stored('gvnew') === '0000', $r[2]);
setStored('gvnew', '1011');
$r = api('POST', '/api/user/update_settings.php', $n, ['group_visibility' => ['workouts' => false]]);
check('il volume salvato resta com\'era (1) quando gli allenamenti si spengono', stored('gvnew') === '0011', $r[2]);
$r = api('POST', '/api/user/update_settings.php', $n, ['group_visibility' => ['workouts' => true, 'volume' => true, 'streak' => true, 'level' => true]]);
check('si riaccende tutto', $r[0] === 200 && ($r[1]['group_visibility'] ?? null) === allOn() && stored('gvnew') === '1111', $r[2]);
$r = api('POST', '/api/user/update_settings.php', $n, ['gender' => 'F']);
check('un\'altra impostazione non cambia le opzioni e la risposta le riporta',
    $r[0] === 200 && stored('gvnew') === '1111' && ($r[1]['group_visibility'] ?? null) === allOn(), $r[2]);
$r = api('POST', '/api/user/update_settings.php', $n, ['group_visibility' => ['level' => false], 'gender' => 'M', 'modules' => ['groups' => true]]);
check('opzioni e altre impostazioni nella stessa richiesta',
    $r[0] === 200 && stored('gvnew') === '1110' && ($r[1]['gender'] ?? null) === 'M' && ($r[1]['modules']['groups'] ?? null) === true, $r[2]);
setStored('gvnew', '1111');
$r = api('POST', '/api/user/update_settings.php', $n, ['group_visibility' => new stdClass(), 'gender' => 'F']);
check('group_visibility vuoto con un\'altra impostazione valida: 200, l\'altra salvata, le opzioni invariate',
    $r[0] === 200 && ($r[1]['gender'] ?? null) === 'F' && stored('gvnew') === '1111' && ($r[1]['group_visibility'] ?? null) === allOn(), $r[2]);
setStored('gvnew', '1010');
$r = api('GET', '/api/user/export.php', $n);
$profile = $r[1]['profile'] ?? [];
check('export: il profilo ha le quattro colonne group_show_* con i valori salvati',
    $r[0] === 200 && ($profile['group_show_workouts'] ?? null) == 1 && ($profile['group_show_volume'] ?? null) == 0
    && ($profile['group_show_streak'] ?? null) == 1 && ($profile['group_show_level'] ?? null) == 0, $r[2]);
setStored('gvnew', '1111');

$bads = [
    'chiave sconosciuta' => ['cardio' => false],
    'una buona e una sconosciuta' => ['volume' => false, 'cardio' => false],
    'valore 0' => ['volume' => 0],
    'valore "false"' => ['volume' => 'false'],
    'valore null' => ['volume' => null],
    'valore array' => ['volume' => [false]],
    'una buona e un valore non booleano' => ['workouts' => false, 'volume' => 1],
];
foreach ($bads as $label => $vis) {
    $r = api('POST', '/api/user/update_settings.php', $n, ['group_visibility' => $vis]);
    check("$label: 400, nessuna modifica", $r[0] === 400 && ($r[1]['success'] ?? null) === false && stored('gvnew') === '1111', $r[2]);
}
foreach (['null' => null, 'una lista' => [true], 'una lista vuota' => [], 'una stringa' => 'tutti', 'un booleano' => true] as $label => $vis) {
    $r = api('POST', '/api/user/update_settings.php', $n, ['group_visibility' => $vis]);
    check("group_visibility come $label: 400, nessuna modifica", $r[0] === 400 && stored('gvnew') === '1111', $r[2]);
}
$r = api('POST', '/api/user/update_settings.php', $n, ['group_visibility' => new stdClass()]);
check('group_visibility oggetto vuoto: 400, nessuna modifica', $r[0] === 400 && stored('gvnew') === '1111', $r[2]);
$r = api('POST', '/api/user/update_settings.php', $n, ['group_visibility' => ['workouts' => false], 'weight_unit' => 'st']);
check('un campo non valido accanto alle opzioni: 400 e anche le opzioni restano com\'erano', $r[0] === 400 && stored('gvnew') === '1111', $r[2]);
$r = api('POST', '/api/user/update_settings.php', $n, ['group_visibility' => ['workouts' => false], 'modules' => ['cardio' => false]]);
check('un modulo non valido accanto alle opzioni: 400 e anche le opzioni restano com\'erano', $r[0] === 400 && stored('gvnew') === '1111', $r[2]);

echo "Gruppo di tre membri\n";
$hash = $conn->quote(password_hash(PASSWORD, PASSWORD_BCRYPT));
foreach (['gva', 'gvb', 'gvc', 'gvout'] as $name) {
    $conn->exec("INSERT INTO gym_users (username, email, password, modules_chosen_at, module_levels) VALUES ('$name', '$name@example.test', $hash, NOW(), 1)");
}
$ids = [];
foreach (['gva', 'gvb', 'gvc', 'gvout'] as $name) $ids[$name] = (int)scalar("SELECT id FROM gym_users WHERE username = ?", [$name]);
$conn->exec("INSERT INTO gym_groups (name, type, owner_user_id, invite_code) VALUES ('Prova', 'friends', {$ids['gva']}, 'GVTEST0001')");
$gid = (int)$conn->lastInsertId();
foreach (['gva' => 'owner', 'gvb' => 'member', 'gvc' => 'member'] as $name => $role) {
    $conn->exec("INSERT INTO gym_group_members (group_id, user_id, role, share_consent_at) VALUES ($gid, {$ids[$name]}, '$role', NOW())");
}
// Dati della settimana: mercoledì a mezzogiorno della settimana corrente (ora italiana)
$wed = (new DateTime('now', new DateTimeZone('Europe/Rome')))->modify('monday this week')->modify('+2 days')->setTime(12, 0)->format('Y-m-d H:i:s');
$yearweek = (int)(new DateTime('now', new DateTimeZone('Europe/Rome')))->format('oW');
$conn->exec("INSERT INTO gym_exercises (name, muscle_group, status) VALUES ('Prova gruppi', 'petto', 'approved')");
$ex = (int)$conn->lastInsertId();
// A: 3 allenamenti (1500 kg), B: 2 (1000 kg), C: 1 (500 kg); streak 5/3/1; livello 5/3/2
foreach (['gva' => [3, 5, 5, 500], 'gvb' => [2, 3, 3, 300], 'gvc' => [1, 1, 2, 100]] as $name => [$count, $streak, $level, $xp]) {
    for ($i = 0; $i < $count; $i++) {
        $conn->exec("INSERT INTO gym_workout_history (user_id, date) VALUES ({$ids[$name]}, '$wed')");
        $hid = (int)$conn->lastInsertId();
        $conn->exec("INSERT INTO gym_workout_sets (workout_history_id, exercise_id, set_number, weight, reps) VALUES ($hid, $ex, 1, 50, '10')");
    }
    $conn->exec("INSERT INTO gym_user_gamification (user_id, current_streak_weeks, last_completed_week, total_xp, level) VALUES ({$ids[$name]}, $streak, $yearweek, $xp, $level)");
}
$tok = ['gva' => bearer('gva'), 'gvb' => bearer('gvb'), 'gvc' => bearer('gvc'), 'gvout' => bearer('gvout')];
function read($who, $board = 'week')
{
    global $tok, $gid;
    $r = api('GET', "/api/groups/read.php?group_id=$gid&board=$board", $tok[$who]);
    return $r[0] === 200 ? $r[1] : ['status' => $r[0], 'raw' => $r[2]];
}
function names($res)
{
    return array_map(function ($row) { return $row['username']; }, $res['board'] ?? []);
}
function ranks($res)
{
    return array_map(function ($row) { return $row['rank']; }, $res['board'] ?? []);
}
function rowOf($res, $name)
{
    foreach ($res['board'] ?? [] as $row) if ($row['username'] === $name) return $row;
    return null;
}
function memberNames($res)
{
    return array_map(function ($m) { return $m['username']; }, $res['members'] ?? []);
}

$res = read('gva');
check('tutti e tre con tutto attivo: visibility tutta true', ($res['visibility'] ?? null) === allOn(), json_encode($res));
check('settimana: A, B, C in ordine, posizioni 1, 2, 3', names($res) === ['gva', 'gvb', 'gvc'] && ranks($res) === [1, 2, 3], json_encode($res['board'] ?? null));
$row = rowOf($res, 'gva');
check('riga di A: gli stessi campi di sempre, tutti pieni',
    $row !== null && array_keys($row) === ['username', 'is_me', 'workouts', 'goal', 'adherence', 'volume_kg', 'streak_weeks', 'level', 'total_xp', 'rank']
    && $row['workouts'] === 3 && $row['volume_kg'] === 1500 && $row['streak_weeks'] === 5 && $row['level'] === 5 && $row['total_xp'] === 500, json_encode($row));
$res2 = read('gva', 'streak');
check('streak: A, B, C', names($res2) === ['gva', 'gvb', 'gvc'] && ranks($res2) === [1, 2, 3] && ($res2['board_type'] ?? null) === 'streak', json_encode($res2['board'] ?? null));
$res3 = read('gva', 'level');
check('livello: A, B, C', names($res3) === ['gva', 'gvb', 'gvc'] && ranks($res3) === [1, 2, 3] && ($res3['board_type'] ?? null) === 'level', json_encode($res3['board'] ?? null));
check('members_count e members come sempre', ($res['group']['members_count'] ?? null) === 3 && memberNames($res) === ['gva', 'gvb', 'gvc'], json_encode($res['members'] ?? null));
$membersAll = $res['members'];
$res = read('gvout');
check('chi non è membro riceve 404', ($res['status'] ?? null) === 404, json_encode($res));

echo "B nasconde gli allenamenti\n";
setStored('gvb', '0111');
$res = read('gva');
check('A: la settimana è senza B, posizioni ricalcolate', names($res) === ['gva', 'gvc'] && ranks($res) === [1, 2], json_encode($res['board'] ?? null));
check('A: visibility ancora tutta true', ($res['visibility'] ?? null) === allOn());
check('A: B compare ancora in members, come prima (nessun segno)', $res['members'] === $membersAll && ($res['group']['members_count'] ?? null) === 3, json_encode($res['members'] ?? null));
$res = read('gva', 'streak');
check('A: nella classifica streak B c\'è ancora (nasconde solo gli allenamenti)', names($res) === ['gva', 'gvb', 'gvc'], json_encode($res['board'] ?? null));
$res = read('gva', 'week');
$rowC = rowOf($res, 'gvc');
check('A: la riga di C è piena', $rowC !== null && $rowC['workouts'] === 1 && $rowC['volume_kg'] === 500 && $rowC['streak_weeks'] === 1 && $rowC['level'] === 2);
$res = read('gvb');
check('B: board vuota nella settimana', ($res['board'] ?? null) === [], json_encode($res['board'] ?? null));
check('B: visibility.workouts e volume false (anche con group_show_volume a 1), streak e level true',
    ($res['visibility'] ?? null) === ['workouts' => false, 'volume' => false, 'streak' => true, 'level' => true], json_encode($res['visibility'] ?? null));
check('B: members completo, con le stesse chiavi', memberNames($res) === ['gva', 'gvb', 'gvc'] && array_keys($res['members'][1]) === ['username', 'role', 'joined_at', 'is_me'], json_encode($res['members'] ?? null));
$res = read('gvb', 'streak');
$rowA = rowOf($res, 'gva');
check('B: la classifica streak c\'è, con i campi della settimana a null per tutti',
    names($res) === ['gva', 'gvb', 'gvc'] && $rowA['workouts'] === null && $rowA['goal'] === null && $rowA['adherence'] === null && $rowA['volume_kg'] === null && $rowA['streak_weeks'] === 5, json_encode($res['board'] ?? null));
check('B: nessun altro campo a null in streak', $rowA['level'] === 5 && $rowA['total_xp'] === 500);
setStored('gvb', '1111');

echo "B nasconde solo il volume\n";
setStored('gvb', '1011');
$res = read('gva');
$rowB = rowOf($res, 'gvb');
check('A: B è nella settimana con volume_kg null', names($res) === ['gva', 'gvb', 'gvc'] && $rowB !== null && $rowB['volume_kg'] === null && $rowB['workouts'] === 2, json_encode($res['board'] ?? null));
check('A: il suo volume c\'è', rowOf($res, 'gva')['volume_kg'] === 1500 && rowOf($res, 'gvc')['volume_kg'] === 500);
check('A: visibility tutta true', ($res['visibility'] ?? null) === allOn());
$res = read('gvb');
check('B: volume_kg null in tutte le righe, la sua compresa',
    count($res['board']) === 3 && array_reduce($res['board'], function ($c, $row) { return $c && $row['volume_kg'] === null; }, true), json_encode($res['board'] ?? null));
check('B: il resto delle righe è pieno', rowOf($res, 'gva')['workouts'] === 3 && rowOf($res, 'gva')['streak_weeks'] === 5);
check('B: visibility.volume false, il resto true', ($res['visibility'] ?? null) === ['workouts' => true, 'volume' => false, 'streak' => true, 'level' => true]);
setStored('gvb', '1111');

echo "B nasconde lo streak\n";
setStored('gvb', '1101');
$res = read('gva', 'streak');
check('A: B è fuori dalla classifica streak, posizioni ricalcolate', names($res) === ['gva', 'gvc'] && ranks($res) === [1, 2], json_encode($res['board'] ?? null));
$res = read('gva');
check('A: nella settimana la riga di B ha streak_weeks null, il resto pieno',
    names($res) === ['gva', 'gvb', 'gvc'] && rowOf($res, 'gvb')['streak_weeks'] === null && rowOf($res, 'gvb')['level'] === 3 && rowOf($res, 'gvb')['volume_kg'] === 1000, json_encode($res['board'] ?? null));
$res = read('gvb', 'streak');
check('B: chiede board=streak → []', ($res['board'] ?? null) === [] && ($res['board_type'] ?? null) === 'streak', json_encode($res));
check('B: visibility.streak false', ($res['visibility'] ?? null) === ['workouts' => true, 'volume' => true, 'streak' => false, 'level' => true]);
$res = read('gvb');
check('B: nella settimana vede lo streak degli altri? no: streak_weeks null in tutte le righe, la sua compresa',
    array_reduce($res['board'], function ($c, $row) { return $c && $row['streak_weeks'] === null; }, true) && count($res['board']) === 3, json_encode($res['board'] ?? null));
setStored('gvb', '1111');

echo "B nasconde il livello\n";
setStored('gvb', '1110');
$res = read('gva', 'level');
check('A: B è fuori dalla classifica livello', names($res) === ['gva', 'gvc'] && ranks($res) === [1, 2], json_encode($res['board'] ?? null));
$res = read('gva');
$rowB = rowOf($res, 'gvb');
check('A: nella settimana la riga di B ha level e total_xp null', $rowB['level'] === null && $rowB['total_xp'] === null && $rowB['streak_weeks'] === 3, json_encode($rowB));
$res = read('gvb', 'level');
check('B: chiede board=level → [] e visibility.level false', ($res['board'] ?? null) === [] && ($res['visibility']['level'] ?? null) === false);
$res = read('gvb', 'streak');
check('B: la classifica streak è piena, ma level e total_xp sono null per tutti',
    count($res['board']) === 3 && array_reduce($res['board'], function ($c, $row) { return $c && $row['level'] === null && $row['total_xp'] === null; }, true), json_encode($res['board'] ?? null));
setStored('gvb', '1111');

echo "C senza il modulo Livelli\n";
setLevels('gvc', false);
$res = read('gva', 'streak');
check('A: C è fuori dalla classifica streak (colonne a 1 ma modulo non attivo)', names($res) === ['gva', 'gvb'], json_encode($res['board'] ?? null));
check('A: C è fuori dalla classifica livello', names(read('gva', 'level')) === ['gva', 'gvb']);
$res = read('gva');
$rowC = rowOf($res, 'gvc');
check('A: nella settimana la riga di C ha streak, livello e xp null, il resto pieno',
    $rowC['streak_weeks'] === null && $rowC['level'] === null && $rowC['total_xp'] === null && $rowC['workouts'] === 1 && $rowC['volume_kg'] === 500, json_encode($rowC));
check('A: visibility tutta true', ($res['visibility'] ?? null) === allOn());
$res = read('gvc');
check('C: visibility streak e level false, il resto true', ($res['visibility'] ?? null) === ['workouts' => true, 'volume' => true, 'streak' => false, 'level' => false], json_encode($res['visibility'] ?? null));
check('C: board=streak e board=level → []', read('gvc', 'streak')['board'] === [] && read('gvc', 'level')['board'] === []);
$res = read('gvc');
check('C: nella settimana vede streak e livello null per tutti',
    array_reduce($res['board'], function ($c, $row) { return $c && $row['streak_weeks'] === null && $row['level'] === null && $row['total_xp'] === null; }, true) && count($res['board']) === 3, json_encode($res['board'] ?? null));
check('C: members completo', memberNames($res) === ['gva', 'gvb', 'gvc']);
setLevels('gvc', true);
$res = read('gva', 'streak');
check('riattivando il modulo C torna in classifica com\'era', names($res) === ['gva', 'gvb', 'gvc'] && ranks($res) === [1, 2, 3] && rowOf(read('gva'), 'gvc')['level'] === 2);

echo "Altre risposte con i membri\n";
$r = api('GET', '/api/groups/list.php', $tok['gva']);
check('list.php: solo conteggio dei membri, nessun dato di altri', $r[0] === 200 && !str_contains($r[2], 'volume_kg') && !str_contains($r[2], 'streak_weeks'), $r[2]);

finishTest();
