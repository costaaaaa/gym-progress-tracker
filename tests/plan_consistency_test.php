<?php
// Eseguito da tests/plan_consistency.sh (serve un database con lo schema del repo).
// Argomenti: cartella backend da provare, fase (run).
//
// Avvia il server integrato di PHP sul backend e chiama gli endpoint veri con un token Bearer:
// create_plan, update_plan, create_days, read_plans.
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

// Ids delle schede attive dell'utente, dal database
function activePlans($conn, $userId)
{
    $stmt = $conn->prepare("SELECT id FROM gym_workout_plans WHERE user_id = ? AND is_active = 1 ORDER BY id");
    $stmt->execute([$userId]);
    return array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));
}

function dayCount($conn, $planId)
{
    $stmt = $conn->prepare("SELECT COUNT(*) FROM gym_workout_days WHERE plan_id = ?");
    $stmt->execute([$planId]);
    return (int)$stmt->fetchColumn();
}

$conn->prepare("INSERT INTO gym_users (username, email, password) VALUES (?, ?, ?)")
    ->execute(['schede', 'schede@example.test', password_hash('Prova!Schede2026', PASSWORD_DEFAULT)]);
$userId = (int)$conn->lastInsertId();
$token = bin2hex(random_bytes(16));
$conn->prepare("INSERT INTO gym_api_tokens (user_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 DAY))")
    ->execute([$userId, hash('sha256', $token)]);

echo "create_plan e update_plan\n";
[$code, $first] = call('POST', '/api/workout/create_plan.php', $token, ['name' => 'Prima', 'description' => 'd']);
$firstId = (int)($first['plan']['id'] ?? 0);
check('create_plan: la prima scheda nasce attiva (201)', $code === 201 && ($first['plan']['is_active'] ?? null) === 1 && activePlans($conn, $userId) === [$firstId], "codice $code: " . json_encode($first));

[$code, $upd] = call('POST', '/api/workout/update_plan.php', $token, ['plan_id' => $firstId, 'name' => 'Prima bis']);
check('update_plan senza is_active: 200 e la scheda resta attiva', $code === 200 && ($upd['plan']['is_active'] ?? null) === 1 && ($upd['plan']['name'] ?? '') === 'Prima bis' && activePlans($conn, $userId) === [$firstId], "codice $code: " . json_encode($upd));

[$code, $second] = call('POST', '/api/workout/create_plan.php', $token, ['name' => 'Seconda', 'is_active' => 1]);
$secondId = (int)($second['plan']['id'] ?? 0);
check('create_plan con is_active=1: 201 e resta attiva solo la nuova', $code === 201 && ($second['plan']['is_active'] ?? null) === 1 && activePlans($conn, $userId) === [$secondId], "codice $code: " . json_encode($second) . ' attive: ' . json_encode(activePlans($conn, $userId)));

[$code, $third] = call('POST', '/api/workout/create_plan.php', $token, ['name' => 'Terza']);
$thirdId = (int)($third['plan']['id'] ?? 0);
check('create_plan senza is_active con una scheda attiva: 201, nasce non attiva, l\'attiva non cambia', $code === 201 && ($third['plan']['is_active'] ?? null) === 0 && activePlans($conn, $userId) === [$secondId], "codice $code: " . json_encode($third));

echo "create_days\n";
$days = [['name' => 'Giorno 1'], ['name' => 'Giorno 2'], ['name' => 'Giorno 3']];
[$code, $created] = call('POST', '/api/workout/create_days.php', $token, ['plan_id' => $thirdId, 'days' => $days]);
check('create_days: 201 con id, nome e day_order di ogni giorno', $code === 201 && count($created['days'] ?? []) === 3
    && $created['days'][2]['name'] === 'Giorno 3' && $created['days'][2]['day_order'] === 3 && isset($created['days'][0]['id']), "codice $code: " . json_encode($created));
check('create_days: i 3 giorni sono salvati', dayCount($conn, $thirdId) === 3);

// Un inserimento che fallisce davvero a metà: il nome di 101 caratteri supera varchar(100) e MySQL
// (modalità rigida) rifiuta la riga, mentre i giorni prima e dopo sono validi
[$code, $failedDays] = call('POST', '/api/workout/create_days.php', $token, ['plan_id' => $firstId, 'days' => [
    ['name' => 'Giorno 1'], ['name' => str_repeat('x', 101)], ['name' => 'Giorno 3'],
]]);
check('create_days con un giorno che fallisce a metà: errore (5xx)', $code >= 500, "codice $code: " . substr(json_encode($failedDays), 0, 200));
check('create_days con un giorno che fallisce a metà: nessun giorno salvato', dayCount($conn, $firstId) === 0, 'giorni salvati: ' . dayCount($conn, $firstId));

[$code, $retry] = call('POST', '/api/workout/create_days.php', $token, ['plan_id' => $firstId, 'days' => $days]);
check('create_days: dopo il fallimento la stessa scheda accetta i giorni (201, day_order da 1)', $code === 201 && ($retry['days'][0]['day_order'] ?? null) === 1 && dayCount($conn, $firstId) === 3, "codice $code: " . json_encode($retry));

$tooMany = array_map(fn($n) => ['name' => "G$n"], range(1, 12));
[$code, $over] = call('POST', '/api/workout/create_days.php', $token, ['plan_id' => $firstId, 'days' => $tooMany]);
check('create_days oltre il tetto: 409 too_many_days e nessun giorno in più', $code === 409 && ($over['error'] ?? '') === 'too_many_days' && dayCount($conn, $firstId) === 3, "codice $code: " . json_encode($over));

[$code] = call('POST', '/api/workout/create_days.php', $token, ['plan_id' => $firstId, 'days' => []]);
check('create_days senza giorni: 400', $code === 400, "codice $code");

echo "CONTROLLI $checks FALLITI $fails\n";
exit($fails > 0 ? 1 : 0);
