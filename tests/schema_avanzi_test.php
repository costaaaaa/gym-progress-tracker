<?php
// Eseguito da tests/schema_avanzi.sh (serve un database con lo schema del repo).
// Argomenti: cartella backend da provare, fase (with-column | dropped).
//
// Avvia il server integrato di PHP sul backend e chiama gli endpoint veri con un token Bearer:
// salvataggio, storico, cambio data, cancellazione dell'allenamento, esportazione; poi i conteggi
// admin degli esercizi e la cancellazione dell'account dai modelli.
//   with-column: la colonna gym_workout_history.exercises esiste ed è facoltativa (sezione 37): ogni
//                allenamento salvato la lascia NULL.
//   dropped:     colonna e tabella gym_progress non esistono più: tutto deve funzionare uguale.
$backend = $argv[1];
$phase = $argv[2] ?? '';
if (!in_array($phase, ['with-column', 'dropped'], true)) {
    fwrite(STDERR, "Fase sconosciuta: '$phase' (with-column | dropped)\n");
    exit(2);
}
require $backend . '/config/database.php';
require_once $backend . '/models/User.php';
require_once $backend . '/models/Exercise.php';

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

// Server integrato nello stesso container: figlio di questo processo, ne eredita l'ambiente (DB_*)
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

function columnExists($conn, $table, $column)
{
    $stmt = $conn->prepare("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?");
    $stmt->execute([$table, $column]);
    return (int)$stmt->fetchColumn() > 0;
}

function tableExists($conn, $table)
{
    $stmt = $conn->prepare("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?");
    $stmt->execute([$table]);
    return (int)$stmt->fetchColumn() > 0;
}

echo "Fase $phase\n";

$withColumn = $phase === 'with-column';
check($withColumn ? 'la colonna exercises esiste' : 'la colonna exercises non esiste', columnExists($conn, 'gym_workout_history', 'exercises') === $withColumn);
check($withColumn ? 'la tabella gym_progress esiste' : 'la tabella gym_progress non esiste', tableExists($conn, 'gym_progress') === $withColumn);
if ($withColumn) {
    $stmt = $conn->query("SELECT IS_NULLABLE, COLUMN_DEFAULT FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'gym_workout_history' AND COLUMN_NAME = 'exercises'");
    $col = $stmt->fetch(PDO::FETCH_ASSOC);
    check('dopo la sezione 37 la colonna exercises è facoltativa (NULL, default NULL)', $col && $col['IS_NULLABLE'] === 'YES' && $col['COLUMN_DEFAULT'] === null, json_encode($col));
}

// Utente con una scheda (un giorno, due esercizi): il controllo premium vuole che i set siano di
// esercizi della scheda indicata da day_id, come mandano le app
$conn->prepare("INSERT INTO gym_users (username, email, password) VALUES (?, ?, ?)")
    ->execute(['avanzi', 'avanzi@example.test', password_hash('Prova!Avanzi2026', PASSWORD_DEFAULT)]);
$userId = (int)$conn->lastInsertId();
$exerciseIds = array_map('intval', $conn->query("SELECT id FROM gym_exercises ORDER BY id LIMIT 2")->fetchAll(PDO::FETCH_COLUMN));
$conn->prepare("INSERT INTO gym_workout_plans (user_id, name) VALUES (?, 'Scheda')")->execute([$userId]);
$plan = (int)$conn->lastInsertId();
$conn->prepare("INSERT INTO gym_workout_days (plan_id, name, day_order) VALUES (?, 'Giorno 1', 1)")->execute([$plan]);
$dayId = (int)$conn->lastInsertId();
foreach ([0, 1] as $pos) {
    $conn->prepare("INSERT INTO gym_workout_exercises (day_id, exercise_id, position, rest) VALUES (?, ?, ?, 60)")->execute([$dayId, $exerciseIds[$pos], $pos]);
}
$token = bin2hex(random_bytes(16));
$conn->prepare("INSERT INTO gym_api_tokens (user_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 DAY))")
    ->execute([$userId, hash('sha256', $token)]);

// Salvataggio, come lo manda un client (anche vecchio): exercise_name e day_id in ogni record
$records = [
    ['exercise_id' => $exerciseIds[0], 'exercise_name' => 'Esercizio A', 'day_id' => $dayId, 'set_number' => 1, 'weight' => 40, 'reps' => '10', 'is_warmup' => true, 'seconds_from_start' => 30],
    ['exercise_id' => $exerciseIds[0], 'exercise_name' => 'Esercizio A', 'day_id' => $dayId, 'set_number' => 2, 'weight' => 42.5, 'reps' => 8, 'intensity_technique' => 'dropset', 'seconds_from_start' => 240],
    ['exercise_id' => $exerciseIds[1], 'exercise_name' => 'Esercizio B', 'day_id' => $dayId, 'set_number' => 1, 'weight' => 20, 'reps' => '12'],
];
[$code, $saved] = call('POST', '/api/workout/record_workout.php', $token, ['workout_records' => $records, 'notes' => 'prova']);
check('record_workout.php salva (201, success, 3 serie)', $code === 201 && ($saved['success'] ?? false) === true && ($saved['sets_saved'] ?? 0) === 3, "codice $code: " . json_encode($saved));
$workoutId = (int)($saved['id'] ?? 0);

$setCount = (int)$conn->query("SELECT COUNT(*) FROM gym_workout_sets WHERE workout_history_id = $workoutId")->fetchColumn();
check('le 3 serie sono in gym_workout_sets', $setCount === 3, "serie: $setCount");
if ($withColumn) {
    $json = $conn->query("SELECT exercises FROM gym_workout_history WHERE id = $workoutId")->fetchColumn();
    check('exercises resta NULL', $json === null, var_export($json, true));
}

// Storico: il campo exercises della risposta nasce dalle serie
[$code, $history] = call('GET', '/api/workout_history/read.php', $token);
$rec = $history['records'][0] ?? null;
check('workout_history/read.php risponde con l\'allenamento', $code === 200 && $rec && (int)$rec['id'] === $workoutId, "codice $code");
check('lo storico ricostruisce 2 esercizi e 3 serie dalle serie', $rec && count($rec['exercises']) === 2
    && count($rec['exercises'][0]['sets']) === 2 && count($rec['exercises'][1]['sets']) === 1, json_encode($rec));
check('lo storico ha le note', $rec && $rec['notes'] === 'prova');

// Cambio data: solo la data cambia, nessuna riscrittura del JSON
$yesterday = (new DateTimeImmutable('yesterday', new DateTimeZone('Europe/Rome')))->format('Y-m-d');
[$code, $moved] = call('POST', '/api/workout_history/update_date.php', $token, ['id' => $workoutId, 'new_date' => $yesterday]);
check('update_date.php sposta l\'allenamento', $code === 200 && ($moved['success'] ?? false) === true, "codice $code: " . json_encode($moved));
$row = $conn->query("SELECT date, notes FROM gym_workout_history WHERE id = $workoutId")->fetch(PDO::FETCH_ASSOC);
check('la data è cambiata e le note no', substr($row['date'], 0, 10) === $yesterday && $row['notes'] === 'prova', json_encode($row));
if ($withColumn) {
    $json = $conn->query("SELECT exercises FROM gym_workout_history WHERE id = $workoutId")->fetchColumn();
    check('dopo il cambio data exercises è ancora NULL', $json === null, var_export($json, true));
}

// Esportazione: le serie ci sono come prima, le due voci tolte no
[$code, $export] = call('GET', '/api/user/export.php', $token);
check('user/export.php risponde', $code === 200 && ($export['success'] ?? false) === true, "codice $code: " . substr(json_encode($export), 0, 300));
$workout = $export['workouts'][0] ?? [];
$names = [];
foreach ($conn->query("SELECT id, name FROM gym_exercises WHERE id IN ({$exerciseIds[0]}, {$exerciseIds[1]})") as $r) {
    $names[(int)$r['id']] = $r['name'];
}
// Tutte le voci di ogni serie esportata, nell'ordine dell'export (id della serie)
$normalize = fn($s) => [
    'exercise' => $s['exercise'], 'set_number' => (int)$s['set_number'], 'weight' => (float)$s['weight'], 'reps' => (string)$s['reps'],
    'intensity_technique' => $s['intensity_technique'], 'is_warmup' => (bool)(int)$s['is_warmup'],
    'seconds_from_start' => $s['seconds_from_start'] === null ? null : (int)$s['seconds_from_start'],
];
$wantSets = [
    ['exercise' => $names[$exerciseIds[0]], 'set_number' => 1, 'weight' => 40.0, 'reps' => '10', 'intensity_technique' => null, 'is_warmup' => true, 'seconds_from_start' => 30],
    ['exercise' => $names[$exerciseIds[0]], 'set_number' => 2, 'weight' => 42.5, 'reps' => '8', 'intensity_technique' => 'dropset', 'is_warmup' => false, 'seconds_from_start' => 240],
    ['exercise' => $names[$exerciseIds[1]], 'set_number' => 1, 'weight' => 20.0, 'reps' => '12', 'intensity_technique' => null, 'is_warmup' => false, 'seconds_from_start' => null],
];
// Né una voce in più né una in meno: $normalize da solo leggerebbe come null una voce mancante
$sortedKeys = function ($set) {
    $keys = array_keys($set);
    sort($keys);
    return $keys;
};
$setsWithOtherKeys = array_filter($workout['sets'] ?? [], fn($s) => $sortedKeys($s) !== $sortedKeys($wantSets[0]));
check('ogni serie esportata ha esattamente quelle voci', $setsWithOtherKeys === [], json_encode($setsWithOtherKeys));
$gotSets = array_map($normalize, $workout['sets'] ?? []);
check('l\'export ha le 3 serie con tutte le voci (esercizio, numero, peso, ripetizioni, tecnica, riscaldamento, secondi)', $gotSets === $wantSets, json_encode($workout['sets'] ?? null));
check('l\'export conserva note, data e fuso dell\'allenamento', ($workout['notes'] ?? null) === 'prova' && isset($workout['date'], $workout['time_zone'], $workout['started_at']));
check('l\'export non ha più la voce exercises negli allenamenti', !array_key_exists('exercises', $workout));
check('l\'export non ha più exercise_progress', !array_key_exists('exercise_progress', $export));
check('l\'export ha ancora le altre sezioni (profilo, schede, gamification, dispositivi)',
    isset($export['profile'], $export['plans'], $export['gamification'], $export['devices'], $export['body_stats']));

// Conteggi admin degli esercizi (scheda + serie): ora senza gym_progress
$expectedUses = (int)$conn->query("SELECT (SELECT COUNT(*) FROM gym_workout_exercises WHERE exercise_id = {$exerciseIds[0]})
    + (SELECT COUNT(*) FROM gym_workout_sets WHERE exercise_id = {$exerciseIds[0]})")->fetchColumn();
$exercise = new Exercise($conn);
check('Exercise::usageCount conta scheda e serie', $exercise->usageCount($exerciseIds[0]) === $expectedUses && $expectedUses === 3, 'ottenuto ' . $exercise->usageCount($exerciseIds[0]));
$used = null;
foreach ($exercise->adminList('approved') as $r) {
    if ((int)$r['id'] === $exerciseIds[0]) {
        $used = (int)$r['uses'];
    }
}
check('Exercise::adminList dà gli stessi usi', $used === $expectedUses, 'ottenuto ' . var_export($used, true));

// Cancellazione dell'allenamento
[$code, $deleted] = call('POST', '/api/workout_history/delete.php', $token, ['id' => $workoutId]);
check('delete.php cancella l\'allenamento', $code === 200 && ($deleted['success'] ?? false) === true, "codice $code: " . json_encode($deleted));
$left = (int)$conn->query("SELECT (SELECT COUNT(*) FROM gym_workout_history WHERE id = $workoutId) + (SELECT COUNT(*) FROM gym_workout_sets WHERE workout_history_id = $workoutId)")->fetchColumn();
check('allenamento e serie sono spariti', $left === 0, "righe rimaste: $left");

// Un secondo salvataggio, poi la cancellazione dell'account dal modello
[$code, $again] = call('POST', '/api/workout/record_workout.php', $token, ['workout_records' => [$records[2]]]);
check('un secondo salvataggio riesce', $code === 201 && ($again['success'] ?? false) === true, "codice $code: " . json_encode($again));
$user = new User($conn);
$user->id = $userId;
check('User::deleteAccount cancella l\'account', $user->deleteAccount('Prova!Avanzi2026') === true);
$left = (int)$conn->query("SELECT (SELECT COUNT(*) FROM gym_users WHERE id = $userId) + (SELECT COUNT(*) FROM gym_workout_history WHERE user_id = $userId)")->fetchColumn();
check('utente e allenamenti sono spariti', $left === 0, "righe rimaste: $left");

echo "\nCONTROLLI $checks FALLITI $fails\n";
exit($fails > 0 ? 1 : 0);
