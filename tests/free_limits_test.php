<?php
// Eseguito da tests/free_limits.sh (serve un database con lo schema del repo).
// Argomenti: cartella backend da provare.
//
// Avvia il server integrato di PHP sul backend e chiama gli endpoint veri con un token Bearer:
// limiti del livello Gratis (2 schede, 4 giorni, 10 esercizi personali), sola lettura dopo una
// discesa da Plus, delete_day.php, tier/limits/features di user/read.php, forma del dashboard.
$backend = $argv[1];
require $backend . '/config/database.php';

$fails = 0;
$checks = 0;
function check($desc, $cond, $detail = '')
{
    global $fails, $checks;
    $checks++;
    if ($cond) {
        echo "  \033[32m✓\033[0m $desc\n";
    } else {
        $fails++;
        echo "  \033[31m✗\033[0m $desc\n";
        if ($detail !== '') {
            echo "      $detail\n";
        }
    }
}

$conn = (new Database())->getConnection();

$port = 8099;
$server = proc_open(['php', '-S', "127.0.0.1:$port", '-t', $backend], [0 => ['file', '/dev/null', 'r'], 1 => ['file', '/dev/null', 'w'], 2 => ['file', '/tmp/server.log', 'w']], $pipes);
register_shutdown_function(function () use ($server) {
    proc_terminate($server);
});
for ($i = 0; $i < 50; $i++) {
    $sock = @fsockopen('127.0.0.1', $port);
    if ($sock) { fclose($sock); break; }
    usleep(100000);
}

// Chiamata HTTP: ritorna [codice, JSON decodificato come array, corpo grezzo]
function call($method, $path, $token, $body = null)
{
    global $port;
    $headers = "Authorization: Bearer $token\r\nContent-Type: application/json\r\n";
    $context = stream_context_create(['http' => [
        'method' => $method, 'header' => $headers, 'ignore_errors' => true, 'timeout' => 30,
        'content' => $body === null ? '' : json_encode($body),
    ]]);
    $raw = file_get_contents("http://127.0.0.1:$port$path", false, $context);
    $code = 0;
    $responseHeaders = function_exists('http_get_last_response_headers') ? http_get_last_response_headers() : ($http_response_header ?? []);
    if (isset($responseHeaders[0]) && preg_match('/ (\d{3})/', $responseHeaders[0], $m)) {
        $code = (int)$m[1];
    }
    return [$code, json_decode((string)$raw, true), (string)$raw];
}

// Utente di prova con token Bearer, livello free
function newUser($name)
{
    global $conn;
    $conn->prepare("INSERT INTO gym_users (username, email, password) VALUES (?, ?, ?)")
        ->execute([$name, "$name@example.test", password_hash('Prova!Limiti2026', PASSWORD_DEFAULT)]);
    $id = (int)$conn->lastInsertId();
    $token = bin2hex(random_bytes(16));
    $conn->prepare("INSERT INTO gym_api_tokens (user_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 DAY))")
        ->execute([$id, hash('sha256', $token)]);
    return [$id, $token];
}

function setTier($userId, $tier, $until = null)
{
    global $conn;
    $conn->prepare("UPDATE gym_users SET tier = ?, tier_until = ? WHERE id = ?")->execute([$tier, $until, $userId]);
}

function newPlan($token, $name = 'Scheda')
{
    return call('POST', '/api/workout/create_plan.php', $token, ['name' => $name]);
}

function newDays($token, $planId, $n)
{
    $days = [];
    for ($i = 1; $i <= $n; $i++) {
        $days[] = ['name' => "Giorno $i"];
    }
    return call('POST', '/api/workout/create_days.php', $token, ['plan_id' => $planId, 'days' => $days]);
}

function addExercise($token, $dayId, $exerciseId)
{
    return call('POST', '/api/workout/add_exercise.php', $token, [
        'day_id' => $dayId, 'exercise_id' => $exerciseId, 'rest' => 60,
        'planned_sets' => [['set_number' => 1, 'kind' => 'working', 'reps_min' => 10, 'reps_max' => 10]],
    ]);
}

function plansOf($token)
{
    return call('GET', '/api/workout/read_plans.php', $token)[1]['records'] ?? [];
}

function planById($token, $planId)
{
    foreach (plansOf($token) as $p) {
        if ((int)$p['id'] === (int)$planId) {
            return $p;
        }
    }
    return null;
}

function scalar($sql, $params = [])
{
    global $conn;
    $stmt = $conn->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchColumn();
}

$catalog = array_map('intval', $conn->query("SELECT id FROM gym_exercises WHERE status = 'approved' AND primary_muscle IS NOT NULL ORDER BY id LIMIT 3")->fetchAll(PDO::FETCH_COLUMN));
$E1 = $catalog[0];
$E2 = $catalog[1];
$muscle1 = scalar("SELECT primary_muscle FROM gym_exercises WHERE id = ?", [$E1]);

// ── Gratis: schede ────────────────────────────────────────────────────────────
echo "Gratis: schede (2)\n";
[$uA, $tA] = newUser('fl_a');
[$c1, $p1] = newPlan($tA, 'Uno');
[$c2, $p2] = newPlan($tA, 'Due');
check('prima e seconda scheda: 201', $c1 === 201 && $c2 === 201);
[$c3, $r3] = newPlan($tA, 'Tre');
check('la terza: 409 too_many_plans con limit 2', $c3 === 409 && ($r3['success'] ?? null) === false && ($r3['code'] ?? '') === 'too_many_plans' && ($r3['limit'] ?? null) === 2, json_encode($r3));
check('il messaggio dice 2 e che con Plus o Pro il limite è più alto', str_contains($r3['message'] ?? '', '2') && str_contains($r3['message'] ?? '', 'Plus') && str_contains($r3['message'] ?? '', 'Pro'), $r3['message'] ?? '');
check('il messaggio non parla di acquisto', !preg_match('/acquist|prezz|abbon/i', $r3['message'] ?? ''));
check('restano 2 schede', count(plansOf($tA)) === 2);

echo "Gratis: giorni (4)\n";
$planA = (int)$p1['plan']['id'];
$planB = (int)$p2['plan']['id'];
[$cd, $rd] = newDays($tA, $planA, 4);
check('4 giorni: 201', $cd === 201 && count($rd['days'] ?? []) === 4, json_encode($rd));
[$cd, $rd] = newDays($tA, $planA, 1);
check('un quinto giorno: 409 too_many_days con limit 4', $cd === 409 && ($rd['code'] ?? '') === 'too_many_days' && ($rd['limit'] ?? null) === 4 && str_contains($rd['message'] ?? '', '4'), json_encode($rd));
[$cd, $rd] = newDays($tA, $planB, 5);
check('5 giorni in una volta: 409 too_many_days', $cd === 409 && ($rd['code'] ?? '') === 'too_many_days' && ($rd['limit'] ?? null) === 4);
check('nessun giorno creato a metà', (int)scalar("SELECT COUNT(*) FROM gym_workout_days WHERE plan_id = ?", [$planB]) === 0);
check('la scheda A resta a 4 giorni', (int)scalar("SELECT COUNT(*) FROM gym_workout_days WHERE plan_id = ?", [$planA]) === 4);

echo "Gratis: esercizi personali (10), doppioni uniti esclusi\n";
// 9 personali in attesa + 1 doppione unito, via SQL (la creazione è limitata a 10 all'ora)
$ins = $conn->prepare("INSERT INTO gym_exercises (name, muscle_group, primary_muscle, created_by, status, merged_into) VALUES (?, 'petto', 'petto', ?, ?, ?)");
for ($i = 1; $i <= 9; $i++) {
    $ins->execute(["Mio $i", $uA, 'pending', null]);
}
$ins->execute(['Mio doppione', $uA, 'rejected', $E1]);
[$ce, $re] = call('POST', '/api/exercise/create.php', $tA, ['name' => 'Il decimo', 'muscle_group' => 'petto']);
check('9 personali + 1 doppione unito: il decimo si crea (201)', $ce === 201, "codice $ce: " . json_encode($re));
[$ce, $re] = call('POST', '/api/exercise/create.php', $tA, ['name' => 'L\'undicesimo', 'muscle_group' => 'petto']);
check('l\'undicesimo: 409 too_many_exercises con limit 10', $ce === 409 && ($re['code'] ?? '') === 'too_many_exercises' && ($re['limit'] ?? null) === 10 && str_contains($re['message'] ?? '', '10'), json_encode($re));
check('il messaggio non dice «in attesa di revisione»', !str_contains($re['message'] ?? '', 'revisione'), $re['message'] ?? '');
check('il messaggio dice che con Plus o Pro il limite è più alto', str_contains($re['message'] ?? '', 'Plus') && str_contains($re['message'] ?? '', 'Pro'), $re['message'] ?? '');

echo "tier_until passato = Gratis\n";
[$uE, $tE] = newUser('fl_e');
setTier($uE, 'plus', '2026-01-01 00:00:00');
newPlan($tE); newPlan($tE);
[$ce, $re] = newPlan($tE);
check('plus scaduto: la terza scheda è 409 con limit 2', $ce === 409 && ($re['limit'] ?? null) === 2, json_encode($re));
$tomorrow = gmdate('Y-m-d H:i:s', time() + 86400);
setTier($uE, 'plus', $tomorrow);
[$ce, $re] = newPlan($tE);
check('plus con scadenza futura: la terza scheda è 201', $ce === 201, json_encode($re));
[$ce, $re] = call('GET', '/api/user/read.php', $tE);
check('user/read: tier plus in vigore', ($re['tier'] ?? '') === 'plus');
setTier($uE, 'plus', '2026-01-01 00:00:00');
[$ce, $re] = call('GET', '/api/user/read.php', $tE);
check('user/read con scadenza passata: tier free', ($re['tier'] ?? '') === 'free');

// ── user/read ────────────────────────────────────────────────────────────────
echo "user/read: tier, limits, features\n";
[$ce, $re] = call('GET', '/api/user/read.php', $tA);
check('Gratis: tier free', ($re['tier'] ?? '') === 'free');
check('Gratis: limits 2/4/10', ($re['limits'] ?? null) === ['plans' => 2, 'days_per_plan' => 4, 'personal_exercises' => 10], json_encode($re['limits'] ?? null));
check('Gratis: features vuote', ($re['features'] ?? null) === []);
[$uP, $tP] = newUser('fl_p');
setTier($uP, 'plus');
[$ce, $re] = call('GET', '/api/user/read.php', $tP);
check('Plus: tier plus', ($re['tier'] ?? '') === 'plus');
check('Plus: limits 50/14/30', ($re['limits'] ?? null) === ['plans' => 50, 'days_per_plan' => 14, 'personal_exercises' => 30]);
check('Plus: features con focus_session_edit, muscle_status_full, weekly_sets_by_muscle', ($re['features'] ?? null) === ['focus_session_edit', 'muscle_status_full', 'weekly_sets_by_muscle'], json_encode($re['features'] ?? null));
setTier($uP, 'pro');
[$ce, $re] = call('GET', '/api/user/read.php', $tP);
check('Pro: tier pro e stesse features', ($re['tier'] ?? '') === 'pro' && count($re['features'] ?? []) === 3);
setTier($uP, 'plus');

// ── Discesa da Plus: sola lettura ─────────────────────────────────────────────
echo "Discesa da Plus: 3 schede e una da 5 giorni\n";
[$uD, $tD] = newUser('fl_d');
setTier($uD, 'plus');
$planIds = [];
foreach (['X', 'Y', 'Z'] as $n) {
    [$c, $r] = newPlan($tD, "Scheda $n");
    $planIds[$n] = (int)$r['plan']['id'];
}
[$c, $r] = newDays($tD, $planIds['X'], 5);
check('da Plus: 5 giorni sulla scheda X', $c === 201 && count($r['days']) === 5, json_encode($r));
[$c, $r] = newDays($tD, $planIds['Y'], 2);
$dayY = (int)$r['days'][0]['id'];
$dayY2 = (int)$r['days'][1]['id'];
$dayX = array_map(fn($d) => (int)$d['id'], planById($tD, $planIds['X'])['days']);
[$c, $r] = addExercise($tD, $dayY, $E1);
$weY1 = (int)($r['workout_exercise']['id'] ?? 0);
[$c, $r] = addExercise($tD, $dayY, $E2);
$weY2 = (int)($r['workout_exercise']['id'] ?? 0);
check('da Plus: due esercizi nel giorno di Y', $weY1 > 0 && $weY2 > 0);
[$c, $r] = addExercise($tD, $dayX[0], $E1);
$weX = (int)($r['workout_exercise']['id'] ?? 0);
call('POST', '/api/workout/activate_plan.php', $tD, ['plan_id' => $planIds['Y']]);

setTier($uD, 'free');
$plans = plansOf($tD);
check('Gratis con 3 schede: tutte read_only con plans_over_limit', count($plans) === 3 && count(array_filter($plans, fn($p) => ($p['read_only'] ?? null) === true && ($p['read_only_reason'] ?? null) === 'plans_over_limit')) === 3, json_encode(array_map(fn($p) => [$p['read_only'] ?? '-', $p['read_only_reason'] ?? '-'], $plans)));

$ro = function ($desc, $path, $body) use ($tD) {
    [$c, $r] = call('POST', $path, $tD, $body);
    check($desc, $c === 409 && ($r['success'] ?? null) === false && ($r['code'] ?? '') === 'plan_read_only' && ($r['reason'] ?? '') === 'plans_over_limit' && ($r['limit'] ?? null) === 2 && is_string($r['message'] ?? null) && $r['message'] !== '', "codice $c: " . json_encode($r));
};
$ro('create_days: 409 plan_read_only (plans_over_limit, limit 2)', '/api/workout/create_days.php', ['plan_id' => $planIds['Z'], 'days' => [['name' => 'Nuovo']]]);
$ro('add_exercise: 409 plan_read_only', '/api/workout/add_exercise.php', ['day_id' => $dayY, 'exercise_id' => $E1, 'rest' => 60, 'planned_sets' => [['set_number' => 1, 'kind' => 'working', 'reps_min' => 8, 'reps_max' => 8]]]);
$ro('update_exercise: 409 plan_read_only', '/api/workout/update_exercise.php', ['day_id' => $dayY, 'exercise_id' => $weY1, 'rest' => 90, 'planned_sets' => [['set_number' => 1, 'kind' => 'working', 'reps_min' => 8, 'reps_max' => 8]]]);
$ro('reorder_exercise: 409 plan_read_only', '/api/workout/reorder_exercise.php', ['day_id' => $dayY, 'exercise_id' => $weY2, 'direction' => 'up']);
$ro('delete_exercise: 409 plan_read_only', '/api/workout/delete_exercise.php', ['day_id' => $dayY, 'exercise_id' => $weY2]);
check('nulla è cambiato: 2 esercizi nel giorno di Y, riposo 60', (int)scalar("SELECT COUNT(*) FROM gym_workout_exercises WHERE day_id = ?", [$dayY]) === 2 && (int)scalar("SELECT rest FROM gym_workout_exercises WHERE id = ?", [$weY1]) === 60);
check('nessun giorno aggiunto a Z', (int)scalar("SELECT COUNT(*) FROM gym_workout_days WHERE plan_id = ?", [$planIds['Z']]) === 0);

[$c, $r] = call('POST', '/api/workout/update_plan.php', $tD, ['plan_id' => $planIds['Z'], 'name' => 'Z rinominata']);
check('update_plan (rinomina) funziona in sola lettura', $c === 200, "codice $c: " . json_encode($r));
[$c, $r] = call('POST', '/api/workout/activate_plan.php', $tD, ['plan_id' => $planIds['Z']]);
check('activate_plan funziona in sola lettura', $c === 200, "codice $c: " . json_encode($r));
[$c, $r] = call('POST', '/api/workout/record_workout.php', $tD, ['workout_records' => [
    ['exercise_id' => $E1, 'exercise_name' => 'A', 'day_id' => $dayY, 'set_number' => 1, 'weight' => 40, 'reps' => 10],
]]);
check('record_workout funziona in sola lettura (201)', $c === 201 && ($r['success'] ?? false) === true, "codice $c: " . json_encode($r));

[$c, $r] = call('POST', '/api/workout/delete_day.php', $tD, ['day_id' => $dayY2]);
check('delete_day funziona in sola lettura (200)', $c === 200 && ($r['success'] ?? null) === true, "codice $c: " . json_encode($r));
check('delete_day sotto il limite di schede non sblocca (3 schede)', (planById($tD, $planIds['Y'])['read_only'] ?? null) === true);
[$c, $r] = call('POST', '/api/workout/delete_plan.php', $tD, ['plan_id' => $planIds['Z']]);
check('delete_plan funziona in sola lettura (200)', $c === 200);
$plans = plansOf($tD);
$y = planById($tD, $planIds['Y']);
check('con 2 schede: Y è modificabile (read_only false, motivo null)', ($y['read_only'] ?? null) === false && array_key_exists('read_only_reason', $y) && $y['read_only_reason'] === null, json_encode($y));
$x = planById($tD, $planIds['X']);
check('con 2 schede: X (5 giorni) è read_only con days_over_limit', ($x['read_only'] ?? null) === true && ($x['read_only_reason'] ?? null) === 'days_over_limit', json_encode([$x['read_only'] ?? '-', $x['read_only_reason'] ?? '-']));
[$c, $r] = call('POST', '/api/workout/add_exercise.php', $tD, ['day_id' => $dayX[0], 'exercise_id' => $E2, 'rest' => 60, 'planned_sets' => [['set_number' => 1, 'kind' => 'working', 'reps_min' => 8, 'reps_max' => 8]]]);
check('X: add_exercise 409 plan_read_only con reason days_over_limit e limit 4', $c === 409 && ($r['code'] ?? '') === 'plan_read_only' && ($r['reason'] ?? '') === 'days_over_limit' && ($r['limit'] ?? null) === 4, json_encode($r));
[$c, $r] = call('POST', '/api/workout/create_days.php', $tD, ['plan_id' => $planIds['X'], 'days' => [['name' => 'Altro']]]);
check('X: create_days 409 plan_read_only (la sola lettura prevale sul tetto)', $c === 409 && ($r['code'] ?? '') === 'plan_read_only' && ($r['reason'] ?? '') === 'days_over_limit', json_encode($r));
[$c, $r] = call('POST', '/api/workout/update_exercise.php', $tD, ['day_id' => $dayX[0], 'exercise_id' => $weX, 'rest' => 90, 'planned_sets' => [['set_number' => 1, 'kind' => 'working', 'reps_min' => 8, 'reps_max' => 8]]]);
check('X: update_exercise 409 plan_read_only', $c === 409 && ($r['code'] ?? '') === 'plan_read_only');
[$c, $r] = call('POST', '/api/workout/add_exercise.php', $tD, ['day_id' => $dayY, 'exercise_id' => $E2, 'rest' => 60, 'planned_sets' => [['set_number' => 1, 'kind' => 'working', 'reps_min' => 8, 'reps_max' => 8]]]);
check('Y (modificabile): add_exercise 201', $c === 201, "codice $c: " . json_encode($r));

[$c, $r] = call('POST', '/api/workout/delete_day.php', $tD, ['day_id' => $dayX[4]]);
check('X: delete_day in sola lettura (5 -> 4 giorni): 200', $c === 200);
$x = planById($tD, $planIds['X']);
check('X con 4 giorni torna modificabile', ($x['read_only'] ?? null) === false && count($x['days']) === 4);
[$c, $r] = call('POST', '/api/workout/create_days.php', $tD, ['plan_id' => $planIds['X'], 'days' => [['name' => 'Quinto']]]);
check('X: il quinto giorno è comunque rifiutato dal tetto (409 too_many_days)', $c === 409 && ($r['code'] ?? '') === 'too_many_days');

// ── delete_day ───────────────────────────────────────────────────────────────
echo "delete_day: righe collegate, rinumerazione, ultimo giorno, altro utente\n";
[$uF, $tF] = newUser('fl_f');
[$c, $r] = newPlan($tF, 'Quattro');
$planF = (int)$r['plan']['id'];
[$c, $r] = newDays($tF, $planF, 4);
$daysF = array_map(fn($d) => (int)$d['id'], $r['days']);
$wex = [];
foreach ([1, 2] as $k) {
    [$c, $r] = addExercise($tF, $daysF[1], $k === 1 ? $E1 : $E2);
    $wex[] = (int)$r['workout_exercise']['id'];
}
[$c, $r] = addExercise($tF, $daysF[2], $E1);
$weKeep = (int)$r['workout_exercise']['id'];
check('il giorno 2 ha 2 esercizi con serie pianificate', (int)scalar("SELECT COUNT(*) FROM gym_workout_plan_sets WHERE workout_exercise_id IN (" . implode(',', $wex) . ")") === 2);
[$uG, $tG] = newUser('fl_g');
[$c, $r] = call('POST', '/api/workout/delete_day.php', $tG, ['day_id' => $daysF[1]]);
check('giorno di un altro utente: 404', $c === 404, "codice $c: " . json_encode($r));
check('e il giorno c\'è ancora', (int)scalar("SELECT COUNT(*) FROM gym_workout_days WHERE id = ?", [$daysF[1]]) === 1);
[$c, $r] = call('POST', '/api/workout/delete_day.php', $tF, ['day_id' => 99999999]);
check('giorno inesistente: 404', $c === 404);
[$c, $r] = call('POST', '/api/workout/delete_day.php', $tF, []);
check('senza day_id: 400', $c === 400);
[$c, $r] = call('GET', '/api/workout/delete_day.php?day_id=' . $daysF[1], $tF);
check('GET non è ammesso: 405', $c === 405, "codice $c");
[$c, $r] = call('POST', '/api/workout/delete_day.php', $tF, ['day_id' => $daysF[1]]);
check('delete_day del giorno 2: 200 success', $c === 200 && ($r['success'] ?? null) === true, "codice $c: " . json_encode($r));
check('il giorno non c\'è più', (int)scalar("SELECT COUNT(*) FROM gym_workout_days WHERE id = ?", [$daysF[1]]) === 0);
check('i suoi esercizi non ci sono più', (int)scalar("SELECT COUNT(*) FROM gym_workout_exercises WHERE id IN (" . implode(',', $wex) . ")") === 0);
check('nessuna serie pianificata orfana', (int)scalar("SELECT COUNT(*) FROM gym_workout_plan_sets ps LEFT JOIN gym_workout_exercises we ON we.id = ps.workout_exercise_id WHERE we.id IS NULL") === 0);
check('nessun esercizio di scheda orfano', (int)scalar("SELECT COUNT(*) FROM gym_workout_exercises we LEFT JOIN gym_workout_days d ON d.id = we.day_id WHERE d.id IS NULL") === 0);
check('l\'esercizio di un altro giorno è intatto', (int)scalar("SELECT COUNT(*) FROM gym_workout_exercises WHERE id = ?", [$weKeep]) === 1);
$orders = $conn->prepare("SELECT day_order FROM gym_workout_days WHERE plan_id = ? ORDER BY day_order");
$orders->execute([$planF]);
check('i giorni rimasti sono rinumerati 1, 2, 3', array_map('intval', $orders->fetchAll(PDO::FETCH_COLUMN)) === [1, 2, 3]);
$order = $conn->prepare("SELECT id FROM gym_workout_days WHERE plan_id = ? ORDER BY day_order");
$order->execute([$planF]);
check('l\'ordine relativo è conservato', array_map('intval', $order->fetchAll(PDO::FETCH_COLUMN)) === [$daysF[0], $daysF[2], $daysF[3]]);
[$c, $r] = call('POST', '/api/workout/delete_day.php', $tF, ['day_id' => $daysF[0]]);
[$c, $r] = call('POST', '/api/workout/delete_day.php', $tF, ['day_id' => $daysF[2]]);
[$c, $r] = call('POST', '/api/workout/delete_day.php', $tF, ['day_id' => $daysF[3]]);
check('l\'ultimo giorno: 409 last_day con messaggio sull\'eliminare la scheda', $c === 409 && ($r['success'] ?? null) === false && ($r['code'] ?? '') === 'last_day' && str_contains($r['message'] ?? '', 'scheda'), "codice $c: " . json_encode($r));
check('e il giorno c\'è ancora', (int)scalar("SELECT COUNT(*) FROM gym_workout_days WHERE plan_id = ?", [$planF]) === 1);

// ── Dashboard ────────────────────────────────────────────────────────────────
echo "Dashboard: detail basic (Gratis) e full (Plus)\n";
[$uH, $tH] = newUser('fl_h');
[$c, $r] = newPlan($tH, 'H');
$planH = (int)$r['plan']['id'];
[$c, $r] = newDays($tH, $planH, 1);
$dayH = (int)$r['days'][0]['id'];
addExercise($tH, $dayH, $E1);
$records = [
    ['exercise_id' => $E1, 'exercise_name' => 'A', 'day_id' => $dayH, 'set_number' => 1, 'weight' => 40, 'reps' => 10, 'is_warmup' => true],
    ['exercise_id' => $E1, 'exercise_name' => 'A', 'day_id' => $dayH, 'set_number' => 2, 'weight' => 50, 'reps' => 8],
    ['exercise_id' => $E1, 'exercise_name' => 'A', 'day_id' => $dayH, 'set_number' => 3, 'weight' => 50, 'reps' => 8],
];
[$c, $r] = call('POST', '/api/workout/record_workout.php', $tH, ['workout_records' => $records]);
check('allenamento salvato (2 serie allenanti + 1 riscaldamento)', $c === 201, "codice $c: " . json_encode($r));

[$c, $d] = call('GET', '/api/workout_stats/dashboard.php', $tH);
check('Gratis: detail basic', $c === 200 && ($d['detail'] ?? '') === 'basic', "codice $c");
check('Gratis: weekly_sets è solo {total: 2} (riscaldamento escluso)', ($d['weekly_sets'] ?? null) === ['total' => 2], json_encode($d['weekly_sets'] ?? null));
$rec = $d['recovery'] ?? [];
$statuses = array_unique(array_column($rec, 'status'));
sort($statuses);
check('Gratis: solo stati PRONTO / IN RECUPERO', $statuses === ['IN RECUPERO', 'PRONTO'] || $statuses === ['IN RECUPERO'] || $statuses === ['PRONTO'], json_encode($statuses));
check('Gratis: il muscolo allenato è IN RECUPERO', ($rec[$muscle1]['status'] ?? '') === 'IN RECUPERO', json_encode($rec[$muscle1] ?? null));
check('Gratis: nessun percent né ready_at in nessun muscolo', count(array_filter($rec, fn($m) => array_key_exists('percent', $m) || array_key_exists('ready_at', $m))) === 0 && count($rec) === 12);
check('Gratis: last_trained c\'è per l\'allenato e null per gli altri', ($rec[$muscle1]['last_trained'] ?? null) !== null && count(array_filter($rec, fn($m) => $m['last_trained'] === null)) === 11);
check('il resto del dashboard è intatto (weekly_workouts, weekly_volume, user_level)', ($d['weekly_workouts'] ?? null) === 1 && isset($d['weekly_volume']['total_weight']) && isset($d['user_level']));

setTier($uH, 'plus');
[$c, $d] = call('GET', '/api/workout_stats/dashboard.php', $tH);
check('Plus: detail full', ($d['detail'] ?? '') === 'full');
check('Plus: weekly_sets ha week, previous_to_date, previous_total e total 2', isset($d['weekly_sets']['week'], $d['weekly_sets']['previous_to_date'], $d['weekly_sets']['previous_total']) && ($d['weekly_sets']['total'] ?? null) === 2 && ($d['weekly_sets']['week'][$muscle1] ?? null) === 2, json_encode($d['weekly_sets'] ?? null));
$m = $d['recovery'][$muscle1] ?? [];
check('Plus: il muscolo allenato ha percent, status, last_trained e ready_at', isset($m['percent'], $m['status'], $m['last_trained'], $m['ready_at']), json_encode($m));
check('Plus: un muscolo mai allenato ha percent 100 e PRONTO', count(array_filter($d['recovery'], fn($x) => $x['status'] === 'PRONTO' && $x['percent'] === 100 && $x['last_trained'] === null)) === 11);

echo "\nCONTROLLI $checks FALLITI $fails\n";
exit($fails > 0 ? 1 : 0);
