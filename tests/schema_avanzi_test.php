<?php
// Eseguito da tests/schema_avanzi.sh (serve un database con lo schema del repo).
// Argomenti: cartella backend da provare, fase (with-column | dropped).
//
// Avvia il server integrato di PHP sul backend e chiama gli endpoint veri con un token Bearer:
// salvataggio, storico, cambio data, cancellazione dell'allenamento, esportazione, schede, profilo,
// statistiche, registrazione; poi i conteggi admin degli esercizi e la cancellazione dell'account dai
// modelli. Ogni fase si può rilanciare sullo stesso database: toglie gli utenti che crea.
//   with-column: la colonna gym_workout_history.exercises esiste ed è facoltativa (sezione 37): ogni
//                allenamento salvato la lascia NULL; le altre colonne e la tabella gym_progress
//                della sezione 38 ci sono ancora.
//   dropped:     dopo la sezione 38 colonne, indice e tabella non esistono più: tutto deve
//                funzionare uguale e le righe di prova (utente 9001) sono intatte.
$backend = $argv[1];
$phase = $argv[2] ?? '';
if (!in_array($phase, ['with-column', 'dropped'], true)) {
    fwrite(STDERR, "Fase sconosciuta: '$phase' (with-column | dropped)\n");
    exit(2);
}
require $backend . '/config/database.php';
require_once $backend . '/models/User.php';
require_once $backend . '/models/Exercise.php';

require __DIR__ . '/lib/http_test.php';

$conn = (new Database())->getConnection();

startTestServer($backend);

function columnExists($conn, $table, $column)
{
    $stmt = $conn->prepare("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?");
    $stmt->execute([$table, $column]);
    return (int)$stmt->fetchColumn() > 0;
}

function indexExists($conn, $table, $index)
{
    $stmt = $conn->prepare("SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?");
    $stmt->execute([$table, $index]);
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
// Cosa elimina la sezione 38
$dropColumns = [
    ['gym_workout_exercises', 'sets'], ['gym_workout_exercises', 'warmup_sets'], ['gym_workout_exercises', 'reps'],
    ['gym_workout_exercises', 'intensity_technique'], ['gym_workout_history', 'exercises'],
    ['gym_users', 'ai_tier'], ['gym_users', 'age'], ['gym_users', 'experience_years'],
];
foreach ($dropColumns as [$table, $column]) {
    check(($withColumn ? "la colonna $table.$column esiste" : "la colonna $table.$column non esiste"), columnExists($conn, $table, $column) === $withColumn);
}
check($withColumn ? 'la tabella gym_progress esiste' : 'la tabella gym_progress non esiste', tableExists($conn, 'gym_progress') === $withColumn);
check($withColumn ? 'l\'indice user_id di gym_workout_history esiste' : 'l\'indice user_id di gym_workout_history non esiste', indexExists($conn, 'gym_workout_history', 'user_id') === $withColumn);
// Quello che resta
foreach ([['gym_workout_sets', 'intensity_technique'], ['gym_workout_plan_sets', 'intensity_technique'], ['gym_users', 'birth_date'], ['gym_users', 'training_start_date']] as [$table, $column]) {
    check("la colonna $table.$column resta", columnExists($conn, $table, $column));
}
check('l\'indice idx_user_date resta', indexExists($conn, 'gym_workout_history', 'idx_user_date'));
$stmt = $conn->query("SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'gym_workout_history' AND CONSTRAINT_TYPE = 'FOREIGN KEY'");
check('la chiave esterna verso gym_users resta', (int)$stmt->fetchColumn() === 1);
if ($withColumn) {
    $stmt = $conn->query("SELECT IS_NULLABLE, COLUMN_DEFAULT FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'gym_workout_history' AND COLUMN_NAME = 'exercises'");
    $col = $stmt->fetch(PDO::FETCH_ASSOC);
    check('dopo la sezione 37 la colonna exercises è facoltativa (NULL, default NULL)', $col && $col['IS_NULLABLE'] === 'YES' && $col['COLUMN_DEFAULT'] === null, json_encode($col));
} else {
    // Righe di prova (utente 9001 'seme', ecc.) inserite da tests/schema_avanzi.sh prima della sezione 38: tutto quello che non è stato eliminato è intatto
    $u = $conn->query("SELECT username, birth_date, training_start_date FROM gym_users WHERE id = 9001")->fetch(PDO::FETCH_ASSOC);
    check('l\'utente di prova è intatto', $u && $u['username'] === 'seme' && $u['birth_date'] === '1990-04-02' && $u['training_start_date'] === '2018-01-15', json_encode($u));
    $e = $conn->query("SELECT day_id, exercise_id, position, rest, notes FROM gym_workout_exercises WHERE id = 9001")->fetch(PDO::FETCH_ASSOC);
    check('l\'esercizio di scheda di prova è intatto', $e && (int)$e['rest'] === 75 && $e['notes'] === 'nota seme' && (int)$e['day_id'] === 9001, json_encode($e));
    $p = $conn->query("SELECT reps_min, reps_max, intensity_technique FROM gym_workout_plan_sets WHERE workout_exercise_id = 9001")->fetchAll(PDO::FETCH_ASSOC);
    check('le serie pianificate di prova sono intatte', count($p) === 1 && (int)$p[0]['reps_min'] === 8 && (int)$p[0]['reps_max'] === 10 && $p[0]['intensity_technique'] === 'Rest Pause', json_encode($p));
    $h = $conn->query("SELECT notes, date FROM gym_workout_history WHERE id = 9001")->fetch(PDO::FETCH_ASSOC);
    check('l\'allenamento di prova è intatto', $h && $h['notes'] === 'allenamento seme' && $h['date'] === '2026-11-01 10:00:00', json_encode($h));
    $s = $conn->query("SELECT weight, reps, intensity_technique FROM gym_workout_sets WHERE workout_history_id = 9001")->fetchAll(PDO::FETCH_ASSOC);
    check('la serie registrata di prova è intatta (compresa la tecnica)', count($s) === 1 && (float)$s[0]['weight'] === 60.0 && $s[0]['reps'] === '8' && $s[0]['intensity_technique'] === 'Rest Pause', json_encode($s));
}

// Utente con una scheda (un giorno, due esercizi): il controllo premium vuole che i set siano di
// esercizi della scheda indicata da day_id, come mandano le app
$conn->prepare("INSERT INTO gym_users (username, email, password, birth_date, gender, training_start_date) VALUES (?, ?, ?, '1990-04-02', 'M', '2018-01-15')")
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

// Gli altri endpoint che toccano le tabelle modificate: schede, esercizi di scheda, profilo, statistiche, registrazione
[$code, $plans] = call('GET', '/api/workout/read_plans.php', $token);
$planExercises = $plans['records'][0]['days'][0]['exercises'] ?? [];
check('read_plans.php risponde con la scheda e i suoi 2 esercizi', $code === 200 && count($planExercises) === 2, "codice $code: " . substr(json_encode($plans), 0, 300));
$planKeys = array_keys($planExercises[0] ?? []);
check('read_plans.php non restituisce le colonne eliminate', array_intersect($planKeys, ['sets', 'warmup_sets', 'reps', 'intensity_technique']) === [], json_encode($planKeys));
$plannedSets = [['set_number' => 1, 'kind' => 'warmup'], ['set_number' => 2, 'kind' => 'working', 'reps_min' => 8, 'reps_max' => 10]];
[$code, $added] = call('POST', '/api/workout/add_exercise.php', $token, ['day_id' => $dayId, 'exercise_id' => $exerciseIds[0], 'rest' => 90, 'notes' => 'nota', 'planned_sets' => $plannedSets]);
$weId = (int)($added['workout_exercise']['id'] ?? 0);
check('add_exercise.php aggiunge l\'esercizio con 2 serie pianificate (201)', $code === 201 && $weId > 0 && count($added['workout_exercise']['planned_sets'] ?? []) === 2, "codice $code: " . json_encode($added));
[$code, $updated] = call('POST', '/api/workout/update_exercise.php', $token, ['day_id' => $dayId, 'exercise_id' => $weId, 'rest' => 45, 'notes' => 'nota 2', 'planned_sets' => [['set_number' => 1, 'kind' => 'working', 'reps_min' => 5, 'reps_max' => 5]]]);
check('update_exercise.php sostituisce le serie pianificate (200)', $code === 200 && ($updated['success'] ?? false) === true && count($updated['workout_exercise']['planned_sets'] ?? []) === 1 && (int)$updated['workout_exercise']['rest'] === 45, "codice $code: " . json_encode($updated));
$conn->prepare("DELETE FROM gym_workout_exercises WHERE id = ?")->execute([$weId]);

[$code, $me] = call('GET', '/api/user/read.php', $token);
$ageWant = (new DateTimeImmutable('1990-04-02'))->diff(new DateTimeImmutable('now', new DateTimeZone('UTC')))->y;
check('user/read.php risponde con età e anni di esperienza calcolati dalle date',
    $code === 200 && abs((int)($me['age'] ?? -99) - $ageWant) <= 1 && (float)($me['experience_years'] ?? 0) >= 8.0 && ($me['birth_date'] ?? '') === '1990-04-02', "codice $code: " . json_encode($me));
[$code, $set] = call('POST', '/api/user/update_settings.php', $token, ['rest_timer_enabled' => false, 'training_start_date' => '2016-06-01']);
check('update_settings.php salva e restituisce età e anni di esperienza (200)',
    $code === 200 && ($set['success'] ?? false) === true && abs((int)($set['age'] ?? -99) - $ageWant) <= 1 && (float)($set['experience_years'] ?? 0) >= 10.0 && ($set['training_start_date'] ?? '') === '2016-06-01', "codice $code: " . json_encode($set));
$conn->prepare("UPDATE gym_workout_plans SET is_active = 1 WHERE id = ?")->execute([$plan]);
[$code, $dash] = call('GET', '/api/workout_stats/dashboard.php', $token);
// user_level nasce da training_start_date di gym_users (2016 dopo update_settings: oltre 3 anni =
// 'avanzato'); plan_days_total conta i giorni delle schede attive dell'utente (la scheda di prova si attiva qui)
$planDaysWant = (int)$conn->query("SELECT COUNT(wd.id) FROM gym_workout_plans wp JOIN gym_workout_days wd ON wd.plan_id = wp.id WHERE wp.user_id = $userId AND wp.is_active = 1")->fetchColumn();
check('workout_stats/dashboard.php risponde (200, success) con livello e giorni di scheda dalle tabelle',
    $code === 200 && ($dash['success'] ?? false) === true && ($dash['user_level'] ?? null) === 'avanzato' && ($dash['plan_days_total'] ?? null) === $planDaysWant && $planDaysWant >= 1,
    "codice $code (giorni attesi $planDaysWant): " . substr(json_encode($dash), 0, 300));
$newName = $withColumn ? 'nuovoavanziA' : 'nuovoavanziB';
[$code, $reg] = call('POST', '/api/user/register.php', '', ['username' => $newName, 'email' => "$newName@example.test", 'password' => 'Prova!Avanzi2026', 'birth_date' => '1995-05-05', 'gender' => 'F', 'accept_terms' => true]);
$newUserStmt = $conn->prepare("SELECT birth_date, gender FROM gym_users WHERE username = ?");
$newUserStmt->execute([$newName]);
$newUser = $newUserStmt->fetch(PDO::FETCH_ASSOC);
check('register.php crea un utente nuovo (201)', $code === 201 && ($reg['success'] ?? false) === true && $newUser && $newUser['birth_date'] === '1995-05-05' && $newUser['gender'] === 'F', "codice $code: " . json_encode($reg));
// L'utente nuovo non serve oltre: la fase si può rilanciare sullo stesso database
$conn->prepare("DELETE FROM gym_users WHERE username = ?")->execute([$newName]);

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

finishTest();
