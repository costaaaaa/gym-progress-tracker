<?php
// Eseguito da tests/home.sh (serve un database con lo schema del repo).
// Argomenti: cartella backend da provare, fase.
//
// Server della Home: il giorno salvato con l'allenamento (record_workout.php) e letto da workout_history/read.php,
// i quattro campi in più di workout_stats/dashboard.php (today, trained_today, week_days, next_day), le preferenze
// della Home di user/read.php e user/update_settings.php (home_layout, module_offer, module_offer_answer) e l'export.
$backend = $argv[1];
require $backend . '/config/database.php';
require __DIR__ . '/lib/http_test.php';
require __DIR__ . '/lib/server_test.php';

const PORT_A = 8094;
const ZONES = ['UTC', 'Europe/Rome', 'America/Los_Angeles', 'Asia/Tokyo'];

foreach (['RL_WORKOUT_SAVE_USER_MAX', 'RL_REGISTER_MAX'] as $v) {
    putenv("$v=1000");
}
putenv('MAIL_DRIVER=log');

startServer($backend, PORT_A, '/tmp/ho-a.log', []);

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
function sql($query, $params = [])
{
    global $conn;
    dbSql($conn, $query, $params);
}
// Account di prova (livello Pro: salvare senza giorno di scheda non dà 403). Ritorna ['id' =>, 'bearer' =>]
function newUser($name)
{
    global $conn;
    sql("INSERT INTO gym_users (username, email, password, tier) VALUES (?, ?, ?, 'pro')",
        [$name, "$name@example.test", password_hash('Prova!Home2026', PASSWORD_DEFAULT)]);
    $id = (int) $conn->lastInsertId();
    $token = bin2hex(random_bytes(16));
    sql("INSERT INTO gym_api_tokens (user_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 DAY))", [$id, hash('sha256', $token)]);
    return ['id' => $id, 'bearer' => $token];
}
// Scheda con un giorno per nome ($names, in ordine); il giorno i ha i+1 esercizi. Ritorna gli id dei giorni.
function newPlan($userId, array $names, $active = 1)
{
    global $conn;
    sql("INSERT INTO gym_workout_plans (user_id, name, is_active) VALUES (?, 'Scheda', ?)", [$userId, $active]);
    $plan = (int) $conn->lastInsertId();
    $exercises = $conn->query("SELECT id FROM gym_exercises ORDER BY id LIMIT 6")->fetchAll(PDO::FETCH_COLUMN);
    $days = [];
    foreach ($names as $i => $name) {
        sql("INSERT INTO gym_workout_days (plan_id, name, day_order) VALUES (?, ?, ?)", [$plan, $name, $i + 1]);
        $day = (int) $conn->lastInsertId();
        for ($e = 0; $e <= $i; $e++) {
            sql("INSERT INTO gym_workout_exercises (day_id, exercise_id, position, rest) VALUES (?, ?, ?, 60)", [$day, $exercises[$e], $e]);
        }
        $days[] = $day;
    }
    return $days;
}
function exerciseId($n)
{
    return (int) scalar("SELECT id FROM gym_exercises ORDER BY id LIMIT 1 OFFSET " . (int) $n);
}
// Un allenamento inserito a mano con la data (ora locale) e, se c'è, il giorno
function addWorkout($userId, $date, $dayId = null)
{
    global $conn;
    sql("INSERT INTO gym_workout_history (user_id, date, day_id) VALUES (?, ?, ?)", [$userId, $date, $dayId]);
    return (int) $conn->lastInsertId();
}
function record($user, array $records, array $extra = [])
{
    return api('POST', '/api/workout/record_workout.php', $user, ['workout_records' => $records], $extra);
}
function set($exerciseId, $dayId = null, $setNumber = 1)
{
    $r = ['exercise_id' => $exerciseId, 'set_number' => $setNumber, 'weight' => 50, 'reps' => '8'];
    if ($dayId !== null) $r['day_id'] = $dayId;
    return $r;
}
function dashboard($user, $zone = null)
{
    $r = api('GET', '/api/workout_stats/dashboard.php', $user, null, $zone ? ["X-Timezone: $zone"] : []);
    return $r[0] === 200 ? $r[1] : null;
}
function profile($user)
{
    return api('GET', '/api/user/read.php', $user);
}
function settings($user, $body)
{
    return api('POST', '/api/user/update_settings.php', $user, $body);
}
// Il valore di $key in $array, 'assente' se la chiave manca (con ?? un null varrebbe come assente)
function valueOf($array, $key)
{
    return is_array($array) && array_key_exists($key, $array) ? $array[$key] : 'assente';
}
function layout(...$keys)
{
    return array_map(fn($k) => ['key' => $k, 'hidden' => false, 'large' => false], $keys);
}

echo "Giorno salvato con l'allenamento\n";
$a = newUser('hoa');
$b = newUser('hob');
[$a1, $a2, $a3] = newPlan($a['id'], ['Push', 'Pull', 'Legs']);
[$b1] = newPlan($b['id'], ['Altro']);
$e0 = exerciseId(0);
$e1 = exerciseId(1);
$r = record($a, [set($e0, $a1), set($e0, $a1, 2)]);
check('record_workout con lo stesso giorno: 201', $r[0] === 201, $r[2]);
check('day_id salvato sull\'allenamento', (int) scalar("SELECT day_id FROM gym_workout_history WHERE id = ?", [$r[1]['id'] ?? 0]) === $a1);
$r = record($a, [set($e0, $a1), set($e1, $a2)]);
check('giorni diversi fra gli elementi: 201 e day_id NULL', $r[0] === 201 && scalar("SELECT day_id IS NULL FROM gym_workout_history WHERE id = ?", [$r[1]['id'] ?? 0]) == 1, $r[2]);
$r = record($a, [set($e0, $a1), set($e1)]);
check('un elemento senza giorno: 201 e day_id NULL', $r[0] === 201 && scalar("SELECT day_id IS NULL FROM gym_workout_history WHERE id = ?", [$r[1]['id'] ?? 0]) == 1, $r[2]);
$r = record($a, [set($e0)]);
check('nessun giorno (app vecchie): 201 e day_id NULL', $r[0] === 201 && scalar("SELECT day_id IS NULL FROM gym_workout_history WHERE id = ?", [$r[1]['id'] ?? 0]) == 1, $r[2]);
$r = record($a, [set($e0, (string) $a2)]);
check('giorno come stringa di cifre: salvato', $r[0] === 201 && (int) scalar("SELECT day_id FROM gym_workout_history WHERE id = ?", [$r[1]['id'] ?? 0]) === $a2, $r[2]);
$r = record($a, [set($e0, $b1)]);
check('giorno di un altro utente: 201 (Pro) ma day_id NULL', $r[0] === 201 && scalar("SELECT day_id IS NULL FROM gym_workout_history WHERE id = ?", [$r[1]['id'] ?? 0]) == 1, $r[2]);
$r = record($a, [set($e0, 999999)]);
check('giorno inesistente: 201 e day_id NULL', $r[0] === 201 && scalar("SELECT day_id IS NULL FROM gym_workout_history WHERE id = ?", [$r[1]['id'] ?? 0]) == 1, $r[2]);
$r = record($a, [set($e0, 'abc')]);
check('giorno non valido: 201 e day_id NULL', $r[0] === 201 && scalar("SELECT day_id IS NULL FROM gym_workout_history WHERE id = ?", [$r[1]['id'] ?? 0]) == 1, $r[2]);
$r = record($a, [set($e0, $a3)], ['X-Timezone: Asia/Tokyo']);
$lastSaved = (int) ($r[1]['id'] ?? 0);
check('con un fuso diverso il giorno si salva lo stesso', $r[0] === 201 && (int) scalar("SELECT day_id FROM gym_workout_history WHERE id = ?", [$lastSaved]) === $a3, $r[2]);

echo "Storico: day_id e day_name\n";
$r = api('GET', '/api/workout_history/read.php', $a);
$byId = [];
foreach ($r[1]['records'] ?? [] as $rec) $byId[(int) $rec['id']] = $rec;
check('read.php: 200 e ogni record ha day_id e day_name', $r[0] === 200 && count($byId) === 9 && !array_filter($byId, fn($x) => !array_key_exists('day_id', $x) || !array_key_exists('day_name', $x)), $r[2]);
check('record con giorno: day_id e day_name', ($byId[$lastSaved]['day_id'] ?? null) === $a3 && ($byId[$lastSaved]['day_name'] ?? null) === 'Legs', json_encode($byId[$lastSaved] ?? null));
$noDay = array_filter($byId, fn($x) => $x['day_id'] === null);
check('record senza giorno: day_id e day_name null', count($noDay) === 6 && !array_filter($noDay, fn($x) => $x['day_name'] !== null));
sql("DELETE FROM gym_workout_days WHERE id = ?", [$a3]);
check('l\'allenamento resta dopo l\'eliminazione del giorno (nessun vincolo)', (int) scalar("SELECT COUNT(*) FROM gym_workout_history WHERE id = ?", [$lastSaved]) === 1);
check('l\'allenamento ha ancora il numero del giorno nel database', (int) scalar("SELECT day_id FROM gym_workout_history WHERE id = ?", [$lastSaved]) === $a3);
$r = api('GET', '/api/workout_history/read.php', $a);
$gone = null;
foreach ($r[1]['records'] ?? [] as $rec) if ((int) $rec['id'] === $lastSaved) $gone = $rec;
check('dopo l\'eliminazione del giorno: day_id e day_name null', $r[0] === 200 && $gone !== null && $gone['day_id'] === null && $gone['day_name'] === null, $r[0] . ' ' . substr($r[2], 0, 300));
// Un giorno di un altro utente messo a mano nel database non rivela il nome
$foreign = addWorkout($a['id'], '2026-01-05 10:00:00', $b1);
$r = api('GET', '/api/workout_history/read.php', $a);
$f = null;
foreach ($r[1]['records'] ?? [] as $rec) if ((int) $rec['id'] === $foreign) $f = $rec;
check('un giorno di un altro utente non compare (né id né nome)', $f !== null && $f['day_id'] === null && $f['day_name'] === null, json_encode($f));
$rb = api('GET', '/api/workout_history/read.php', $b);
check('l\'altro utente non vede gli allenamenti di hoa', $rb[0] === 200 && count($rb[1]['records'] ?? []) === 0, $rb[2]);

echo "Dashboard: next_day\n";
$n = newUser('honext');
$d = dashboard($n);
check('dashboard: i quattro campi ci sono', $d !== null && array_key_exists('today', $d) && array_key_exists('trained_today', $d) && array_key_exists('week_days', $d) && array_key_exists('next_day', $d), json_encode($d));
check('senza scheda: next_day null', $d !== null && $d['next_day'] === null);
$inactive = newPlan($n['id'], ['Spenta'], 0);
check('con una scheda non attiva: next_day null', dashboard($n)['next_day'] === null);
sql("INSERT INTO gym_workout_plans (user_id, name, is_active) VALUES (?, 'Vuota', 1)", [$n['id']]);
$emptyPlan = (int) $conn->lastInsertId();
sql("UPDATE gym_workout_plans SET is_active = 0 WHERE user_id = ? AND id <> ?", [$n['id'], $emptyPlan]);
check('scheda attiva senza giorni: next_day null', dashboard($n)['next_day'] === null);
sql("DELETE FROM gym_workout_plans WHERE id = ?", [$emptyPlan]);
sql("DELETE FROM gym_workout_plans WHERE user_id = ?", [$n['id']]);
[$n1, $n2, $n3] = newPlan($n['id'], ['Push', 'Pull', 'Legs']);
check('nessun allenamento: il primo giorno, con il numero di esercizi', dashboard($n)['next_day'] === ['id' => $n1, 'name' => 'Push', 'exercises' => 1], json_encode(dashboard($n)['next_day']));
addWorkout($n['id'], '2026-03-01 10:00:00', null);
check('ultimo allenamento senza giorno: il primo', dashboard($n)['next_day']['id'] === $n1);
addWorkout($n['id'], '2026-03-02 10:00:00', $n1);
check('dopo il primo: il secondo (2 esercizi)', dashboard($n)['next_day'] === ['id' => $n2, 'name' => 'Pull', 'exercises' => 2]);
addWorkout($n['id'], '2026-03-03 10:00:00', $n2);
check('dopo il secondo: il terzo (3 esercizi)', dashboard($n)['next_day'] === ['id' => $n3, 'name' => 'Legs', 'exercises' => 3]);
addWorkout($n['id'], '2026-03-04 10:00:00', $n3);
check('giro completo: si ricomincia dal primo', dashboard($n)['next_day']['id'] === $n1);
addWorkout($n['id'], '2026-03-05 10:00:00', $n1);
check('conta l\'ultimo allenamento, non i precedenti', dashboard($n)['next_day']['id'] === $n2);
addWorkout($n['id'], '2026-03-06 10:00:00', $b1);
check('ultimo allenamento con un giorno di un\'altra scheda (o utente): il primo', dashboard($n)['next_day']['id'] === $n1);
$m = newUser('homnext2');
check('un altro utente non vede la scheda di honext', dashboard($m)['next_day'] === null);
[$m1] = newPlan($m['id'], ['Solo']);
check('un solo giorno: sempre quello', dashboard($m)['next_day']['id'] === $m1);
addWorkout($m['id'], '2026-03-01 10:00:00', $m1);
check('un solo giorno, già fatto: ancora quello', dashboard($m)['next_day']['id'] === $m1);
check('ultimo allenamento in un\'altra scheda dello stesso utente: il primo della scheda attiva', (function () use ($m) {
    $x = newPlan($m['id'], ['Z1', 'Z2'], 0);
    sql("UPDATE gym_workout_plans SET is_active = 0 WHERE user_id = ?", [$m['id']]);
    sql("UPDATE gym_workout_plans SET is_active = 1 WHERE id = (SELECT plan_id FROM gym_workout_days WHERE id = ?)", [$x[0]]);
    return dashboard($m)['next_day']['id'] === $x[0];
})());

// Ultimo allenamento = il più recente per data, non l'ultimo inserito
$k = newUser('honextdate');
[$k1, $k2, $k3] = newPlan($k['id'], ['A', 'B', 'C']);
addWorkout($k['id'], '2026-03-02 10:00:00', $k1);
addWorkout($k['id'], '2026-03-03 10:00:00', $k2);
addWorkout($k['id'], '2026-03-01 10:00:00', $k3);
check('inserito dopo ma con data precedente: next_day segue la data più recente (B, quindi C)', dashboard($k)['next_day']['id'] === $k3, json_encode(dashboard($k)['next_day']));
// Stessa data e ora: vale l'ultimo inserito
$t1 = newUser('honexttie1');
[$t11, $t12, $t13] = newPlan($t1['id'], ['A', 'B', 'C']);
addWorkout($t1['id'], '2026-03-03 10:00:00', $t11);
addWorkout($t1['id'], '2026-03-03 10:00:00', $t12);
check('stessa data e ora: vale l\'ultimo inserito (B, quindi C)', dashboard($t1)['next_day']['id'] === $t13);
$t2 = newUser('honexttie2');
[$t21, $t22, $t23] = newPlan($t2['id'], ['A', 'B', 'C']);
addWorkout($t2['id'], '2026-03-03 10:00:00', $t22);
addWorkout($t2['id'], '2026-03-03 10:00:00', $t21);
check('stessa data e ora, ordine inverso: vale l\'ultimo inserito (A, quindi B)', dashboard($t2)['next_day']['id'] === $t22);

// Giorno eliminato dopo l'allenamento (a livello di endpoint)
$g = newUser('honextgone');
[$g1, $g2, $g3] = newPlan($g['id'], ['Z1', 'Z2', 'Z3']);
addWorkout($g['id'], '2026-03-03 10:00:00', $g2);
check('prima dell\'eliminazione: dopo Z2 viene Z3', dashboard($g)['next_day']['id'] === $g3);
sql("DELETE FROM gym_workout_days WHERE id = ?", [$g2]);
check('giorno dell\'ultimo allenamento eliminato: next_day torna al primo giorno', dashboard($g)['next_day']['id'] === $g1);

echo "Dashboard: today, trained_today, week_days nei quattro fusi\n";
foreach (ZONES as $zone) {
    $tz = new DateTimeZone($zone);
    $now = new DateTime('now', $tz);
    $today = $now->format('Y-m-d');
    $idx = (int) $now->format('N') - 1;
    $monday = (clone $now)->modify('-' . $idx . ' days')->setTime(0, 0, 0);
    $tag = strtolower(preg_replace('/[^A-Za-z]/', '', $zone));

    $u = newUser("hot$tag");
    $d = dashboard($u, $zone);
    check("$zone: today è la data dell'utente", ($d['today'] ?? null) === $today, json_encode($d['today'] ?? null));
    check("$zone: senza allenamenti trained_today false e sette giorni falsi", ($d['trained_today'] ?? null) === false && ($d['week_days'] ?? null) === array_fill(0, 7, false));

    addWorkout($u['id'], $now->format('Y-m-d H:i:s'));
    $d = dashboard($u, $zone);
    $expected = array_fill(0, 7, false);
    $expected[$idx] = true;
    check("$zone: un allenamento adesso: trained_today true, solo oggi nella settimana", ($d['trained_today'] ?? null) === true && ($d['week_days'] ?? null) === $expected, json_encode($d));
    check("$zone: week_days non contraddice weekly_workouts", count(array_filter($d['week_days'])) <= $d['weekly_workouts'] && $d['weekly_workouts'] === 1);

    // Vicino a mezzanotte: 00:00:00 di oggi è oggi, 23:59:59 di ieri no
    $v = newUser("hom$tag");
    addWorkout($v['id'], $today . ' 00:00:00');
    check("$zone: oggi alle 00:00:00 è oggi", dashboard($v, $zone)['trained_today'] === true);
    $w = newUser("hoy$tag");
    $yesterday = (clone $now)->modify('-1 day')->format('Y-m-d');
    addWorkout($w['id'], $yesterday . ' 23:59:59');
    $d = dashboard($w, $zone);
    check("$zone: ieri alle 23:59:59 non è oggi", $d['trained_today'] === false);
    $expected = array_fill(0, 7, false);
    if ($idx > 0) $expected[$idx - 1] = true;
    check("$zone: ieri compare nella settimana solo se non è domenica scorsa", $d['week_days'] === $expected, json_encode($d['week_days']));
    // Di lunedì ieri è domenica scorsa: fuori dalla settimana, per entrambi i numeri
    check("$zone: week_days e weekly_workouts concordano su ieri", count(array_filter($d['week_days'])) === $d['weekly_workouts'] && $d['weekly_workouts'] === ($idx > 0 ? 1 : 0), json_encode($d));

    // Lo stesso allenamento (data scritta in UTC) visto da fusi diversi: conta il giorno del fuso della richiesta
    $x = newUser("hos$tag");
    $utc = new DateTime('now', new DateTimeZone('UTC'));
    addWorkout($x['id'], $utc->format('Y-m-d H:i:s'));
    check("$zone: la data dell'allenamento si confronta con il giorno del fuso della richiesta",
        dashboard($x, $zone)['trained_today'] === ($utc->format('Y-m-d') === $today));

    // Lunedì e domenica della settimana: gli estremi
    $y = newUser("hoe$tag");
    addWorkout($y['id'], $monday->format('Y-m-d') . ' 00:00:00');
    addWorkout($y['id'], (clone $monday)->modify('+6 days')->format('Y-m-d') . ' 23:59:59');
    $d = dashboard($y, $zone);
    $expected = [true, false, false, false, false, false, true];
    check("$zone: lunedì 00:00:00 e domenica 23:59:59 sono il primo e l'ultimo giorno", $d['week_days'] === $expected, json_encode($d['week_days']));
    check("$zone: weekly_workouts conta entrambi", $d['weekly_workouts'] === 2);
    $z = newUser("hon$tag");
    addWorkout($z['id'], (clone $monday)->modify('-1 second')->format('Y-m-d H:i:s'));
    addWorkout($z['id'], (clone $monday)->modify('+7 days')->format('Y-m-d H:i:s'));
    $d = dashboard($z, $zone);
    check("$zone: domenica scorsa 23:59:59 e lunedì prossimo 00:00:00 non sono nella settimana", $d['week_days'] === array_fill(0, 7, false), json_encode($d['week_days']));
    check("$zone: weekly_workouts non ha limite alla domenica (conta lunedì prossimo, non domenica scorsa)", $d['weekly_workouts'] === 1);
}
$d = dashboard(newUser('hodefault'));
check('senza header X-Timezone e senza fuso salvato: today è la data in Europe/Rome', ($d['today'] ?? null) === (new DateTime('now', new DateTimeZone('Europe/Rome')))->format('Y-m-d'));

echo "Preferenze della Home: lettura\n";
$p = newUser('hopref');
$r = profile($p);
check('read.php: home_layout null e module_offer null per un account nuovo', $r[0] === 200 && array_key_exists('home_layout', $r[1]) && $r[1]['home_layout'] === null && array_key_exists('module_offer', $r[1]) && $r[1]['module_offer'] === null, $r[2]);

echo "Preferenze della Home: home_layout\n";
$ok = [['key' => 'recovery', 'hidden' => true, 'large' => false], ['key' => 'last', 'hidden' => false, 'large' => true], ['key' => 'body', 'hidden' => false, 'large' => false]];
$r = settings($p, ['home_layout' => $ok]);
check('home_layout valido: 200 e la risposta lo riporta', $r[0] === 200 && ($r[1]['home_layout'] ?? null) === $ok, $r[2]);
check('la risposta porta anche modules e module_offer', is_array($r[1]['modules'] ?? null) && array_key_exists('module_offer', $r[1]));
check('read.php lo restituisce nello stesso ordine', (profile($p)[1]['home_layout'] ?? null) === $ok);
$r = settings($p, ['home_layout' => array_map(fn($i) => $i + ['extra' => 1], $ok)]);
check('campi in più non si salvano', $r[0] === 200 && ($r[1]['home_layout'] ?? null) === $ok && strpos((string) scalar("SELECT home_layout FROM gym_users WHERE id = ?", [$p['id']]), 'extra') === false, $r[2]);
$bad = [
    'chiave ignota' => [['key' => 'ai', 'hidden' => false, 'large' => false]],
    'chiave non stringa' => [['key' => 3, 'hidden' => false, 'large' => false]],
    'doppione' => [layout('last')[0], layout('last')[0]],
    'hidden stringa' => [['key' => 'last', 'hidden' => 'true', 'large' => false]],
    'large numero' => [['key' => 'last', 'hidden' => false, 'large' => 0]],
    'manca large' => [['key' => 'last', 'hidden' => false]],
    'troppi elementi' => array_merge(layout('last', 'levels', 'groups', 'recovery', 'body'), layout('last')),
    'è un oggetto' => ['last' => layout('last')[0]],
    'è una stringa' => 'last',
    'elemento non oggetto' => ['last'],
];
foreach ($bad as $name => $value) {
    $r = settings($p, ['home_layout' => $value]);
    check("home_layout non valido ($name): 400 e nessuna modifica", $r[0] === 400 && ($r[1]['success'] ?? null) === false && (profile($p)[1]['home_layout'] ?? null) === $ok, $r[2]);
}
$r = settings($p, ['home_layout' => layout('last', 'levels', 'groups', 'recovery', 'body')]);
check('tutti e cinque i blocchi: 200', $r[0] === 200 && count($r[1]['home_layout'] ?? []) === 5, $r[2]);
$r = settings($p, ['home_layout' => []]);
check('elenco vuoto: 200 e salvato vuoto', $r[0] === 200 && ($r[1]['home_layout'] ?? null) === [], $r[2]);
settings($p, ['home_layout' => $ok]);
$r = settings($p, ['rest_timer_enabled' => false]);
check('un altro campo non tocca il layout', $r[0] === 200 && ($r[1]['home_layout'] ?? null) === $ok, $r[2]);
$r = settings($p, ['home_layout' => null]);
check('null: torna al predefinito (colonna NULL)', $r[0] === 200 && valueOf($r[1], 'home_layout') === null && scalar("SELECT home_layout IS NULL FROM gym_users WHERE id = ?", [$p['id']]) == 1, $r[2]);
sql("UPDATE gym_users SET home_layout = '[{\"key\":\"zzz\",\"hidden\":false,\"large\":false}]' WHERE id = ?", [$p['id']]);
check('un valore salvato non valido si legge come null', array_key_exists('home_layout', profile($p)[1]) && profile($p)[1]['home_layout'] === null);
sql("UPDATE gym_users SET home_layout = '[]' WHERE id = ?", [$p['id']]);
settings($p, ['home_layout' => $ok]);
$q = newUser('hopref2');
check('un altro utente non vede il layout', profile($q)[1]['home_layout'] === null);
settings($q, ['home_layout' => layout('body')]);
check('né cambia quello di hopref', (profile($p)[1]['home_layout'] ?? null) === $ok);

echo "Preferenze della Home: module_offer\n";
function offerOf($user)
{
    return valueOf(profile($user)[1], 'module_offer');
}
function modulesOf($user)
{
    return scalar("SELECT CONCAT(module_body, module_levels, module_groups, module_recovery, module_ai) FROM gym_users WHERE id = ?", [$user['id']]);
}
function setState($user, $chosenDaysAgo, $offerDaysAgo, $flags = '00000', $declined = null)
{
    $k = ['module_body', 'module_levels', 'module_groups', 'module_recovery', 'module_ai'];
    $sets = [];
    foreach ($k as $i => $col) $sets[] = "$col = " . (int) $flags[$i];
    $sets[] = 'modules_chosen_at = ' . ($chosenDaysAgo === null ? 'NULL' : "NOW() - INTERVAL $chosenDaysAgo DAY");
    $sets[] = 'module_offer_at = ' . ($offerDaysAgo === null ? 'NULL' : "NOW() - INTERVAL $offerDaysAgo DAY");
    sql("UPDATE gym_users SET " . implode(', ', $sets) . ", module_offers_declined = ? WHERE id = ?", [$declined, $user['id']]);
}
$o = newUser('hooffer');
setState($o, null, null);
check('scelta dei moduli mai fatta: null', offerOf($o) === null);
setState($o, 6, null);
check('scelta di 6 giorni fa: null', offerOf($o) === null);
setState($o, 8, null);
check('scelta di 8 giorni fa: Peso e misure (body)', offerOf($o) === 'body');
setState($o, 8, 3);
check('ultima risposta 3 giorni fa: null', offerOf($o) === null);
setState($o, 8, 8, '00000', '["body"]');
check('body rifiutato, risposta di 8 giorni fa: levels', offerOf($o) === 'levels');
setState($o, 30, null, '10000');
check('body attivo: levels', offerOf($o) === 'levels');
setState($o, 30, null, '11000');
check('body e levels attivi: groups', offerOf($o) === 'groups');
setState($o, 30, null, '11100');
check('i primi tre attivi: recovery', offerOf($o) === 'recovery');
setState($o, 30, null, '11110');
check('tutti attivi tranne gli Assistenti AI (mai proposti): null', offerOf($o) === null);
setState($o, 30, null, '11111');
check('tutti attivi: null', offerOf($o) === null);
setState($o, 30, null, '00000', '["body","levels","groups","recovery"]');
check('tutti rifiutati: null', offerOf($o) === null);
setState($o, 30, 30, '00000', '"body"');
check('rifiutati che non sono un elenco: si ignorano (body)', offerOf($o) === 'body');

echo "Risposta a una proposta\n";
$o = newUser('hoanswer');
setState($o, 10, null);
$r = settings($o, ['module_offer_answer' => ['key' => 'body', 'accepted' => false]]);
check('rifiuto: 200, nessuna proposta subito dopo (pausa)', $r[0] === 200 && valueOf($r[1], 'module_offer') === null, $r[2]);
check('rifiuto: module_offer_at scritto, body in elenco, modulo ancora non attivo',
    scalar("SELECT module_offer_at > NOW() - INTERVAL 1 MINUTE FROM gym_users WHERE id = ?", [$o['id']]) == 1
    && scalar("SELECT module_offers_declined FROM gym_users WHERE id = ?", [$o['id']]) === '["body"]' && modulesOf($o) === '00000');
check('la risposta riporta modules invariati', ($r[1]['modules'] ?? null) === ['body' => false, 'recovery' => false, 'levels' => false, 'groups' => false, 'ai' => false]);
sql("UPDATE gym_users SET module_offer_at = NOW() - INTERVAL 8 DAY WHERE id = ?", [$o['id']]);
check('dopo sette giorni: il successivo (levels)', offerOf($o) === 'levels');
$r = settings($o, ['module_offer_answer' => ['key' => 'body', 'accepted' => false]]);
check('rispondere a un modulo già rifiutato (non è quello proposto): 400, elenco invariato', $r[0] === 400 && scalar("SELECT module_offers_declined FROM gym_users WHERE id = ?", [$o['id']]) === '["body"]', $r[2]);
$offerAt = scalar("SELECT module_offer_at FROM gym_users WHERE id = ?", [$o['id']]);
$r = settings($o, ['module_offer_answer' => ['key' => 'groups', 'accepted' => true]]);
check('rispondere a un modulo diverso da quello proposto (levels): 400, nessuna scrittura', $r[0] === 400 && ($r[1]['success'] ?? null) === false
    && modulesOf($o) === '00000' && scalar("SELECT module_offer_at FROM gym_users WHERE id = ?", [$o['id']]) === $offerAt, $r[2]);
sql("UPDATE gym_users SET module_offer_at = NOW() - INTERVAL 8 DAY WHERE id = ?", [$o['id']]);
$r = settings($o, ['module_offer_answer' => ['key' => 'levels', 'accepted' => false]]);
check('un altro rifiuto si aggiunge in coda', $r[0] === 200 && scalar("SELECT module_offers_declined FROM gym_users WHERE id = ?", [$o['id']]) === '["body", "levels"]');
sql("UPDATE gym_users SET module_offer_at = NOW() - INTERVAL 8 DAY WHERE id = ?", [$o['id']]);
check('body e levels rifiutati: groups', offerOf($o) === 'groups');
$r = settings($o, ['module_offer_answer' => ['key' => 'groups', 'accepted' => true]]);
check('accettato: 200, modulo attivo nella risposta e nel database', $r[0] === 200 && ($r[1]['modules']['groups'] ?? null) === true && modulesOf($o) === '00100', $r[2]);
check('accettato: pausa di sette giorni (module_offer null)', valueOf($r[1], 'module_offer') === null && offerOf($o) === null);
sql("UPDATE gym_users SET module_offer_at = NOW() - INTERVAL 8 DAY WHERE id = ?", [$o['id']]);
check('dopo sette giorni: recovery', offerOf($o) === 'recovery');
settings($o, ['module_offer_answer' => ['key' => 'recovery', 'accepted' => true]]);
sql("UPDATE gym_users SET module_offer_at = NOW() - INTERVAL 8 DAY WHERE id = ?", [$o['id']]);
check('tutti attivi o rifiutati: null', offerOf($o) === null);
$before = scalar("SELECT module_offer_at FROM gym_users WHERE id = ?", [$o['id']]);
$r = settings($o, ['module_offer_answer' => ['key' => 'body', 'accepted' => true]]);
check('nessuna proposta in corso (chiave valida): 400, nessuna scrittura', $r[0] === 400 && modulesOf($o) === '00110'
    && scalar("SELECT module_offer_at FROM gym_users WHERE id = ?", [$o['id']]) === $before, $r[2]);
$badAnswers = [
    'chiave sconosciuta' => ['key' => 'zzz', 'accepted' => true],
    'assistenti AI' => ['key' => 'ai', 'accepted' => true],
    'accepted stringa' => ['key' => 'body', 'accepted' => 'true'],
    'accepted mancante' => ['key' => 'body'],
    'chiave mancante' => ['accepted' => false],
    'chiave non stringa' => ['key' => 1, 'accepted' => false],
    'non è un oggetto' => 'body',
    'è un elenco' => ['body', true],
    'null' => null,
];
foreach ($badAnswers as $name => $value) {
    $r = settings($o, ['module_offer_answer' => $value]);
    check("risposta non valida ($name): 400 e nessuna modifica", $r[0] === 400 && ($r[1]['success'] ?? null) === false
        && scalar("SELECT module_offer_at FROM gym_users WHERE id = ?", [$o['id']]) === $before && modulesOf($o) === '00110', $r[2]);
}
$s = newUser('hoanswer2');
setState($s, 10, null);
check('un altro utente non è toccato dalle risposte di hoanswer', modulesOf($s) === '00000' && offerOf($s) === 'body'
    && scalar("SELECT module_offers_declined IS NULL AND module_offer_at IS NULL FROM gym_users WHERE id = ?", [$s['id']]) == 1);
$r = settings($s, ['modules' => ['body' => true], 'module_offer_answer' => ['key' => 'body', 'accepted' => false]]);
check('risposta e modules sulla stessa chiave nella stessa richiesta: 400 e nessuna modifica', $r[0] === 400 && ($r[1]['success'] ?? null) === false
    && modulesOf($s) === '00000' && scalar("SELECT module_offer_at IS NULL AND module_offers_declined IS NULL FROM gym_users WHERE id = ?", [$s['id']]) == 1, $r[2]);
$r = settings($s, ['modules' => ['body' => false], 'module_offer_answer' => ['key' => 'body', 'accepted' => true]]);
check('anche con un valore opposto (modules false, risposta sì): 400 e nessuna modifica', $r[0] === 400 && modulesOf($s) === '00000', $r[2]);
$r = settings($s, ['modules' => ['recovery' => true], 'module_offer_answer' => ['key' => 'body', 'accepted' => true]]);
check('modules su un\'altra chiave nella stessa richiesta: 200, entrambi applicati', $r[0] === 200 && modulesOf($s) === '10010', $r[2]);
$r = settings($s, ['module_offer_answer' => ['key' => 'levels', 'accepted' => false]]);
check('seconda risposta subito dopo la prima: 400 (pausa di sette giorni)', $r[0] === 400 && scalar("SELECT module_offers_declined IS NULL FROM gym_users WHERE id = ?", [$s['id']]) == 1, $r[2]);
sql("UPDATE gym_users SET module_offer_at = NULL, module_body = 1, module_recovery = 0 WHERE id = ?", [$s['id']]);
$r = settings($s, ['home_layout' => layout('last')]);
check('layout e moduli nella stessa richiesta: 200', $r[0] === 200 && ($r[1]['home_layout'] ?? null) === layout('last') && ($r[1]['modules']['body'] ?? null) === true, $r[2]);

echo "Modello: chiave non valida in module_offer_answer\n";
require $backend . '/models/User.php';
$inj = newUser('hoinject');
sql("UPDATE gym_users SET tier = 'free' WHERE id = ?", [$inj['id']]);
$model = new User($conn);
$model->id = $inj['id'];
$model->updateProfile(['module_offer_answer' => ['key' => "ai = 1, tier = 'plus' -- ", 'accepted' => true]]);
check('una chiave fuori da MODULE_OFFERS non arriva al testo SQL (il livello non cambia)', scalar("SELECT tier FROM gym_users WHERE id = ?", [$inj['id']]) === 'free');
check('e non si scrive nulla (module_offer_at resta NULL)', scalar("SELECT module_offer_at IS NULL FROM gym_users WHERE id = ?", [$inj['id']]) == 1);

echo "Esportazione\n";
settings($s, ['module_offer_answer' => ['key' => 'levels', 'accepted' => false]]);
$r = api('GET', '/api/user/export.php', $s);
$profile = $r[1]['profile'] ?? [];
check('export: home_layout come elenco, non come testo', $r[0] === 200 && ($profile['home_layout'] ?? null) === layout('last'), $r[2]);
check('export: module_offers_declined come elenco e module_offer_at presente', ($profile['module_offers_declined'] ?? null) === ['levels'] && !empty($profile['module_offer_at']), json_encode($profile));
$r = api('GET', '/api/user/export.php', newUser('hoexport'));
check('export di un account nuovo: i tre campi null', valueOf($r[1]['profile'], 'home_layout') === null && valueOf($r[1]['profile'], 'module_offers_declined') === null && valueOf($r[1]['profile'], 'module_offer_at') === null, $r[2]);

finishTest();
