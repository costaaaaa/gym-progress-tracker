<?php
// Eseguito da tests/achievement_endpoints.sh (serve un database con lo schema del repo).
// Argomenti: cartella backend da provare.
//
// Avvia il server integrato di PHP sul backend e controlla che i nomi dei traguardi escano nella
// lingua dell'account: gamification/profile.php (label del catalogo) e unlocked_achievements di
// workout/record_workout.php dopo un salvataggio.
$backend = $argv[1];
require $backend . '/config/database.php';

require __DIR__ . '/lib/http_test.php';

$conn = (new Database())->getConnection();

startTestServer($backend);

$exerciseId = (int)$conn->query("SELECT id FROM gym_exercises ORDER BY id LIMIT 1")->fetchColumn();

// Account di prova nella lingua $locale, con una scheda di un esercizio; ritorna [token, day_id]
function newUser($name, $locale)
{
    global $conn, $exerciseId;
    $conn->prepare("INSERT INTO gym_users (username, email, password, locale) VALUES (?, ?, ?, ?)")
        ->execute([$name, "$name@example.test", password_hash('Prova!Traguardi2026', PASSWORD_DEFAULT), $locale]);
    $id = (int)$conn->lastInsertId();
    $conn->prepare("INSERT INTO gym_workout_plans (user_id, name) VALUES (?, 'Scheda')")->execute([$id]);
    $plan = (int)$conn->lastInsertId();
    $conn->prepare("INSERT INTO gym_workout_days (plan_id, name, day_order) VALUES (?, 'Giorno 1', 1)")->execute([$plan]);
    $day = (int)$conn->lastInsertId();
    $conn->prepare("INSERT INTO gym_workout_exercises (day_id, exercise_id, position, rest) VALUES (?, ?, 0, 60)")->execute([$day, $exerciseId]);
    $token = bin2hex(random_bytes(16));
    $conn->prepare("INSERT INTO gym_api_tokens (user_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 DAY))")
        ->execute([$id, hash('sha256', $token)]);
    return [$token, $day];
}

function labelsOf($response)
{
    return array_column($response['achievements'] ?? [], 'label', 'key');
}

$expected = [
    'it' => ['sessions_100' => 'Centurione', 'tonnage_auto' => '1,5 t — automobile', 'tonnage_shuttle' => '2.000 t — Space Shuttle', 'strength_140' => '140 kg in un esercizio'],
    'en' => ['sessions_100' => 'Centurion', 'tonnage_auto' => '1.5 t — a car', 'tonnage_shuttle' => '2,000 t — a Space Shuttle', 'strength_140' => '140 kg on one exercise'],
];

foreach (['it', 'en'] as $locale) {
    echo "Account in lingua: $locale\n";
    [$token, $day] = newUser("trag$locale", $locale);

    [$code, $profile] = call('GET', '/api/gamification/profile.php', $token);
    $labels = labelsOf($profile);
    check("profile.php risponde 200 con 19 traguardi ($locale)", $code === 200 && count($labels) === 19, "codice $code");
    foreach ($expected[$locale] as $key => $label) {
        check("profile.php: $key = «{$label}»", ($labels[$key] ?? null) === $label, 'ottenuto: ' . var_export($labels[$key] ?? null, true));
    }
    check('le chiavi dei traguardi restano quelle di sempre', array_keys($labels)[2] === 'sessions_100' && in_array('strength_140', array_keys($labels), true));

    [$code, $saved] = call('POST', '/api/workout/record_workout.php', $token, ['workout_records' => [
        ['exercise_id' => $exerciseId, 'exercise_name' => 'Esercizio', 'day_id' => $day, 'set_number' => 1, 'weight' => 140, 'reps' => '1'],
    ]]);
    check("record_workout.php salva (201) ($locale)", $code === 201 && ($saved['success'] ?? false) === true, "codice $code: " . json_encode($saved));
    $unlocked = array_column($saved['unlocked_achievements'] ?? [], 'label', 'key');
    check("unlocked_achievements: strength_140 = «{$expected[$locale]['strength_140']}»", ($unlocked['strength_140'] ?? null) === $expected[$locale]['strength_140'], json_encode($unlocked));
}

finishTest();
