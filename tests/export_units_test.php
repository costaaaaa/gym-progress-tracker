<?php
// Eseguito da tests/export_units.sh (serve un database con lo schema del repo).
// Argomenti: cartella backend da provare, fase.
//
// Due utenti con gli stessi dati in kg, uno con unità kg e uno con lb. Per l'utente in lb ogni peso e ogni
// circonferenza dell'export è convertito (valori attesi calcolati a mano con le regole dell'app); per quello in kg
// l'export non cambia, a parte la chiave `units`.
$backend = $argv[1];
require $backend . '/config/database.php';
require __DIR__ . '/lib/http_test.php';

$conn = (new Database())->getConnection();
startTestServer($backend);

function newUser($name, $unit)
{
    global $conn;
    $conn->prepare("INSERT INTO gym_users (username, email, password, weight_unit) VALUES (?, ?, ?, ?)")
        ->execute([$name, "$name@example.test", password_hash('Prova!Export2026', PASSWORD_DEFAULT), $unit]);
    $id = (int)$conn->lastInsertId();
    $token = bin2hex(random_bytes(16));
    $conn->prepare("INSERT INTO gym_api_tokens (user_id, token_hash, expires_at) VALUES (?, ?, '2099-01-01 00:00:00')")
        ->execute([$id, hash('sha256', $token)]);
    return [$id, $token];
}

// Stessi dati per entrambi: serie con pesi di ogni tipo, misure con e senza valori, gamification
function seed($userId)
{
    global $conn;
    $conn->prepare("INSERT INTO gym_workout_history (id, user_id, date, time_zone, duration_seconds) VALUES (?, ?, '2026-03-01 18:00:00', 'Europe/Rome', 3600)")
        ->execute([$userId * 10, $userId]);
    $sets = [[1, '80.00', '8', 0], [2, '100.00', '5', 0], [3, '22.68', '10', 0], [4, '0.00', '12', 0], [5, '60.50', '6', 1], [6, '120.37', '3', 0], [7, '0.01', '1', 0]];
    foreach ($sets as [$n, $w, $reps, $warm]) {
        $conn->prepare("INSERT INTO gym_workout_sets (workout_history_id, exercise_id, set_number, weight, reps, is_warmup) VALUES (?, 1, ?, ?, ?, ?)")
            ->execute([$userId * 10, $n, $w, $reps, $warm]);
    }
    $stat = $conn->prepare("INSERT INTO gym_user_stats (user_id, date, weight, body_fat_percentage, muscle_mass_percentage, chest_size, arm_size, waist_size, leg_size) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $stat->execute([$userId, '2026-03-01', '82.50', '18.40', '41.20', '100.00', '35.56', '83.25', '61.00']);
    $stat->execute([$userId, '2026-03-08', '83.25', null, null, null, null, '83.25', null]);
    $stat->execute([$userId, '2026-03-15', null, '17.90', null, '0.01', null, null, null]);
    $conn->prepare("INSERT INTO gym_user_gamification (user_id, total_xp, level, lifetime_volume_kg) VALUES (?, 500, 3, '12345.50')")->execute([$userId]);
}


// Confronto esatto (tipi compresi): check() degli helper vuole una condizione, qui si passa atteso e ottenuto
function eq($desc, $expected, $got)
{
    check($desc, $expected === $got, 'atteso ' . json_encode($expected) . ', ottenuto ' . json_encode($got));
}

[$kgId, $kgToken] = newUser('eukg', 'kg');
[$lbId, $lbToken] = newUser('eulb', 'lb');
seed($kgId);
seed($lbId);

$kg = call('GET', '/api/user/export.php', $kgToken);
$lb = call('GET', '/api/user/export.php', $lbToken);
check('export in kg: 200', $kg[0] === 200 && ($kg[1]['success'] ?? null) === true, $kg[2]);
check('export in lb: 200', $lb[0] === 200 && ($lb[1]['success'] ?? null) === true, $lb[2]);
$K = $kg[1];
$L = $lb[1];

echo "Intestazione\n";
eq('kg: units = kg e cm', ['weight' => 'kg', 'length' => 'cm'], $K['units'] ?? null);
eq('lb: units = lb e in', ['weight' => 'lb', 'length' => 'in'], $L['units'] ?? null);
eq('units è la prima chiave dopo success', ['success', 'units'], array_slice(array_keys($K), 0, 2));

eq('profile non contiene weight_unit', false, array_key_exists('weight_unit', $K['profile']) || array_key_exists('weight_unit', $L['profile']));

echo "Pesi delle serie (quarto di libbra, testo a due decimali)\n";
$kgWeights = array_column($K['workouts'][0]['sets'], 'weight');
$lbWeights = array_column($L['workouts'][0]['sets'], 'weight');
eq('kg: pesi come nel database', ['80.00', '100.00', '22.68', '0.00', '60.50', '120.37', '0.01'], $kgWeights);
eq('lb: pesi al quarto di libbra', ['176.25', '220.50', '50.00', '0.00', '133.50', '265.25', '0.00'], $lbWeights);

echo "Misure corporee\n";
$kgStats = $K['body_stats'];
$lbStats = $L['body_stats'];
eq('kg: prima misura come nel database', ['82.50', '100.00', '35.56', '83.25', '61.00'], [$kgStats[0]['weight'], $kgStats[0]['chest_size'], $kgStats[0]['arm_size'], $kgStats[0]['waist_size'], $kgStats[0]['leg_size']]);
eq('lb: peso corporeo al decimo di libbra, circonferenze al decimo di pollice',
    ['181.90', '39.40', '14.00', '32.80', '24.00'],
    [$lbStats[0]['weight'], $lbStats[0]['chest_size'], $lbStats[0]['arm_size'], $lbStats[0]['waist_size'], $lbStats[0]['leg_size']]);
eq('lb: seconda misura (solo peso e vita)', ['183.50', null, null, '32.80', null], [$lbStats[1]['weight'], $lbStats[1]['chest_size'], $lbStats[1]['arm_size'], $lbStats[1]['waist_size'], $lbStats[1]['leg_size']]);
eq('lb: terza misura, valori nulli restano nulli', [null, '0.00', null, null, null], [$lbStats[2]['weight'], $lbStats[2]['chest_size'], $lbStats[2]['arm_size'], $lbStats[2]['waist_size'], $lbStats[2]['leg_size']]);
eq('lb: le percentuali non si toccano', ['18.40', '41.20', null, '17.90'], [$lbStats[0]['body_fat_percentage'], $lbStats[0]['muscle_mass_percentage'], $lbStats[1]['body_fat_percentage'], $lbStats[2]['body_fat_percentage']]);

echo "Campi con l'unità nel nome\n";
eq('kg: lifetime_volume_kg', '12345.50', $K['gamification']['profile'][0]['lifetime_volume_kg'] ?? null);
eq('lb: lifetime_volume_kg resta in kg', '12345.50', $L['gamification']['profile'][0]['lifetime_volume_kg'] ?? null);

echo "Il resto dell'export è identico\n";
// Tolti units, i valori dell'inventario e ciò che dipende dall'utente o dal momento, i due export coincidono
function stripped($e)
{
    unset($e['units'], $e['exported_at'], $e['profile'], $e['devices']);
    foreach ($e['workouts'] as &$w) foreach ($w['sets'] as &$s) unset($s['weight']);
    unset($w, $s);
    foreach ($e['body_stats'] as &$b) unset($b['weight'], $b['chest_size'], $b['arm_size'], $b['waist_size'], $b['leg_size']);
    unset($b);
    return $e;
}
eq('kg e lb, tolto l\'inventario: stesse chiavi e stessi valori', stripped($K), stripped($L));
eq('stesse chiavi di primo livello', array_keys($K), array_keys($L));

finishTest();
