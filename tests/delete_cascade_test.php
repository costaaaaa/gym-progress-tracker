<?php
// Eseguito da tests/delete_cascade.sh (serve un database con lo schema del repo).
// Argomenti: cartella backend da provare, fase (cases | seed-orphans | check-orphans).
//
// Con MySQL 9.7 la cascata ON DELETE CASCADE che attraversa quattro o più tabelle non arriva in fondo:
// questo test cancella con il codice vero (User::deleteAccount, WorkoutPlan::delete) e conta, per ogni
// chiave esterna dello schema, le righe figlie rimaste senza genitore.
require $argv[1] . '/config/database.php';
require_once $argv[1] . '/models/User.php';
require_once $argv[1] . '/models/WorkoutPlan.php';

$phase = $argv[2] ?? 'cases';
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

// Righe figlie senza genitore, per ogni chiave esterna del database (anche quelle future): tabella.colonna => numero
function orphans($conn)
{
    $rows = $conn->query("SELECT CONSTRAINT_NAME, TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
        FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL
        ORDER BY TABLE_NAME, CONSTRAINT_NAME, ORDINAL_POSITION")->fetchAll();
    $fks = [];
    foreach ($rows as $r) {
        $fks[$r['TABLE_NAME'] . '.' . $r['CONSTRAINT_NAME']][] = $r;
    }
    $found = [];
    foreach ($fks as $name => $cols) {
        $on = [];
        foreach ($cols as $column) {
            $on[] = "c.`{$column['COLUMN_NAME']}` = p.`{$column['REFERENCED_COLUMN_NAME']}`";
        }
        $first = $cols[0];
        $sql = "SELECT COUNT(*) FROM `{$first['TABLE_NAME']}` c
                LEFT JOIN `{$first['REFERENCED_TABLE_NAME']}` p ON " . implode(' AND ', $on) . "
                WHERE c.`{$first['COLUMN_NAME']}` IS NOT NULL AND p.`{$first['REFERENCED_COLUMN_NAME']}` IS NULL";
        $found[$name] = (int)$conn->query($sql)->fetchColumn();
    }
    return $found;
}

// Le chiavi esterne della catena schede > giorni > esercizi > serie pianificate (come le chiama orphans())
const CHAIN_FOREIGN_KEYS = [
    'gym_workout_days.gym_workout_days_ibfk_1',
    'gym_workout_exercises.gym_workout_exercises_ibfk_1',
    'gym_workout_plan_sets.gym_workout_plan_sets_ibfk_1',
];

function checkNoOrphans($conn, $when)
{
    $found = orphans($conn);
    check("$when: " . count($found) . " chiavi esterne controllate, nessun orfano", count($found) > 0 && array_sum($found) === 0,
        json_encode(array_filter($found)));
}

// Righe della catena schede > giorni > esercizi > serie pianificate di tutte le schede di un utente
function planChainCounts($conn, $userId)
{
    $userId = (int)$userId;
    $from = "FROM gym_workout_plans p JOIN gym_workout_days d ON d.plan_id = p.id";
    $q = [
        'gym_workout_plans' => "SELECT COUNT(*) FROM gym_workout_plans p WHERE p.user_id = $userId",
        'gym_workout_days' => "SELECT COUNT(*) $from WHERE p.user_id = $userId",
        'gym_workout_exercises' => "SELECT COUNT(*) $from JOIN gym_workout_exercises e ON e.day_id = d.id WHERE p.user_id = $userId",
        'gym_workout_plan_sets' => "SELECT COUNT(*) $from JOIN gym_workout_exercises e ON e.day_id = d.id JOIN gym_workout_plan_sets s ON s.workout_exercise_id = e.id WHERE p.user_id = $userId",
    ];
    $out = [];
    foreach ($q as $table => $sql) {
        $out[$table] = (int)$conn->query($sql)->fetchColumn();
    }
    return $out;
}

// Id dei giorni di una scheda: si leggono prima di cancellarla, per poter contare dopo che cosa resta sotto
function dayIdsOfPlan($conn, $planId)
{
    return array_map('intval', $conn->query("SELECT id FROM gym_workout_days WHERE plan_id = " . (int)$planId . " ORDER BY id")->fetchAll(PDO::FETCH_COLUMN));
}

// Righe sotto un elenco di giorni (i giorni stessi, i loro esercizi, le serie di quegli esercizi), senza passare
// dalla tabella delle schede: conta anche i figli rimasti dopo che la scheda e i giorni non ci sono più.
function dayChainCounts($conn, array $dayIds)
{
    // Elenco vuoto: IN (0) non trova nulla (gli id partono da 1), IN () sarebbe un errore di sintassi
    $ids = implode(',', array_map('intval', $dayIds)) ?: '0';
    return [
        'gym_workout_days' => (int)$conn->query("SELECT COUNT(*) FROM gym_workout_days WHERE id IN ($ids)")->fetchColumn(),
        'gym_workout_exercises' => (int)$conn->query("SELECT COUNT(*) FROM gym_workout_exercises WHERE day_id IN ($ids)")->fetchColumn(),
        'gym_workout_plan_sets' => (int)$conn->query("SELECT COUNT(*) FROM gym_workout_plan_sets s JOIN gym_workout_exercises e ON e.id = s.workout_exercise_id WHERE e.day_id IN ($ids)")->fetchColumn(),
    ];
}

// Numero di righe dei dati di un utente, per tabella
function counts($conn, $u)
{
    $q = [
        'gym_workout_history' => "SELECT COUNT(*) FROM gym_workout_history WHERE user_id = $u",
        'gym_workout_sets' => "SELECT COUNT(*) FROM gym_workout_sets s JOIN gym_workout_history h ON h.id = s.workout_history_id WHERE h.user_id = $u",
        'gym_groups' => "SELECT COUNT(*) FROM gym_groups WHERE owner_user_id = $u",
        'gym_group_members' => "SELECT COUNT(*) FROM gym_group_members WHERE user_id = $u",
    ];
    $out = planChainCounts($conn, $u);
    foreach ($q as $table => $sql) {
        $out[$table] = (int)$conn->query($sql)->fetchColumn();
    }
    return $out;
}

// Orfani in più (o in meno) per una chiave esterna rispetto a una lettura precedente di orphans()
function orphanDelta($after, $before, $foreignKey)
{
    return $after[$foreignKey] - $before[$foreignKey];
}

// 3 schede (2, 3 e 2 giorni), 2 esercizi per giorno, 2 serie pianificate per esercizio, 3 allenamenti con 2 serie, un gruppo
function seedUser($conn, $name, $exerciseIds)
{
    $conn->prepare("INSERT INTO gym_users (username, email, password) VALUES (?, ?, ?)")
        ->execute([$name, "$name@example.test", password_hash('Prova!Cascata2026', PASSWORD_DEFAULT)]);
    $u = (int)$conn->lastInsertId();
    foreach ([2, 3, 2] as $p => $nDays) {
        $conn->prepare("INSERT INTO gym_workout_plans (user_id, name) VALUES (?, ?)")->execute([$u, "Scheda $p"]);
        $plan = (int)$conn->lastInsertId();
        for ($d = 1; $d <= $nDays; $d++) {
            $conn->prepare("INSERT INTO gym_workout_days (plan_id, name, day_order) VALUES (?, ?, ?)")->execute([$plan, "Giorno $d", $d]);
            $day = (int)$conn->lastInsertId();
            foreach ([0, 1] as $pos) {
                $conn->prepare("INSERT INTO gym_workout_exercises (day_id, exercise_id, position, rest) VALUES (?, ?, ?, 60)")
                    ->execute([$day, $exerciseIds[$pos], $pos]);
                $workoutExerciseId = (int)$conn->lastInsertId();
                $conn->prepare("INSERT INTO gym_workout_plan_sets (workout_exercise_id, set_number, kind) VALUES (?, 1, 'warmup')")->execute([$workoutExerciseId]);
                $conn->prepare("INSERT INTO gym_workout_plan_sets (workout_exercise_id, set_number, kind, reps_min, reps_max) VALUES (?, 2, 'working', 8, 10)")->execute([$workoutExerciseId]);
            }
        }
    }
    for ($h = 0; $h < 3; $h++) {
        $conn->prepare("INSERT INTO gym_workout_history (user_id) VALUES (?)")->execute([$u]);
        $hist = (int)$conn->lastInsertId();
        foreach ([1, 2] as $n) {
            $conn->prepare("INSERT INTO gym_workout_sets (workout_history_id, exercise_id, set_number, weight, reps) VALUES (?, ?, ?, 50, '10')")
                ->execute([$hist, $exerciseIds[0], $n]);
        }
    }
    $conn->prepare("INSERT INTO gym_groups (name, owner_user_id, invite_code) VALUES (?, ?, ?)")->execute(["Gruppo $name", $u, substr(md5($name), 0, 10)]);
    $g = (int)$conn->lastInsertId();
    $conn->prepare("INSERT INTO gym_group_members (group_id, user_id, role, share_consent_at) VALUES (?, ?, 'owner', NOW())")->execute([$g, $u]);
    return $u;
}

if ($phase === 'cases') {
    $exerciseIds = array_map('intval', $conn->query("SELECT id FROM gym_exercises ORDER BY id LIMIT 2")->fetchAll(PDO::FETCH_COLUMN));
    if (count($exerciseIds) < 2) {
        fwrite(STDERR, "Il catalogo esercizi dello schema è vuoto\n");
        exit(2);
    }
    $u1 = seedUser($conn, 'casc1', $exerciseIds);
    $u2 = seedUser($conn, 'casc2', $exerciseIds);
    $base1 = counts($conn, $u1);
    $base2 = counts($conn, $u2);

    echo "Dati di partenza\n";
    check("utente con 3 schede, 7 giorni, 14 esercizi, 28 serie pianificate",
        [3, 7, 14, 28] === [$base1['gym_workout_plans'], $base1['gym_workout_days'], $base1['gym_workout_exercises'], $base1['gym_workout_plan_sets']],
        json_encode($base1));
    check("3 allenamenti con 6 serie e un gruppo con un membro",
        [3, 6, 1, 1] === [$base1['gym_workout_history'], $base1['gym_workout_sets'], $base1['gym_groups'], $base1['gym_group_members']],
        json_encode($base1));
    check("il secondo utente ha gli stessi dati", $base1 === $base2, json_encode($base2));
    checkNoOrphans($conn, "all'inizio");

    echo "\nCaso 1: WorkoutPlan::delete su una scheda con 3 giorni\n";
    $plans = array_map('intval', $conn->query("SELECT id FROM gym_workout_plans WHERE user_id = $u1 ORDER BY id")->fetchAll(PDO::FETCH_COLUMN));
    $victim = $plans[1];
    $others = [$plans[0], $plans[2]];
    $countOtherPlans = fn() => array_map(fn($p) => dayChainCounts($conn, dayIdsOfPlan($conn, $p)), $others);
    $othersBefore = $countOtherPlans();
    $victimDays = dayIdsOfPlan($conn, $victim);
    $victimBefore = dayChainCounts($conn, $victimDays);
    $plan = new WorkoutPlan($conn);
    $thrown = false;
    try {
        $plan->deleteDaysAndExercises($u1, $victim);
    } catch (LogicException $e) {
        $thrown = true;
    }
    check("deleteDaysAndExercises() fuori da una transazione lancia LogicException e non cancella nulla",
        $thrown && $victimBefore === dayChainCounts($conn, $victimDays) && 0 < array_sum($victimBefore));
    $plan->id = $victim;
    $plan->user_id = $u1;
    check("delete() risponde true", $plan->delete() === true);
    check("la scheda non c'è più", (int)$conn->query("SELECT COUNT(*) FROM gym_workout_plans WHERE id = $victim")->fetchColumn() === 0);
    $victimLeft = dayChainCounts($conn, $victimDays);
    check("sono spariti i suoi giorni, esercizi e serie pianificate", 0 === array_sum($victimLeft), json_encode($victimLeft));
    check("le altre due schede dello stesso utente sono intatte", $othersBefore === $countOtherPlans());
    checkNoOrphans($conn, 'dopo il caso 1');
    $after1 = counts($conn, $u1);
    check("allenamenti e gruppo dell'utente intatti",
        [$base1['gym_workout_history'], $base1['gym_workout_sets'], $base1['gym_groups'], $base1['gym_group_members']] ===
        [$after1['gym_workout_history'], $after1['gym_workout_sets'], $after1['gym_groups'], $after1['gym_group_members']]);
    check("i dati del secondo utente sono intatti", $base2 === counts($conn, $u2), json_encode(counts($conn, $u2)));

    echo "\nCaso 2: User::deleteAccount su un utente con 3 schede\n";
    $user = new User($conn);
    $user->id = $u1;
    check("deleteAccount() risponde true", $user->deleteAccount('Prova!Cascata2026') === true);
    check("l'utente non c'è più", (int)$conn->query("SELECT COUNT(*) FROM gym_users WHERE id = $u1")->fetchColumn() === 0);
    $gone = counts($conn, $u1);
    check("non resta nulla dei suoi dati", 0 === array_sum($gone), json_encode($gone));
    $chainOrphans = array_intersect_key(orphans($conn), array_flip(CHAIN_FOREIGN_KEYS));
    check("giorni, esercizi e serie pianificate delle sue schede non sono rimasti (righe senza genitore nella catena)",
        count($chainOrphans) === 3 && 0 === array_sum($chainOrphans), json_encode($chainOrphans));
    checkNoOrphans($conn, 'dopo il caso 2');
    check("i dati del secondo utente sono intatti", $base2 === counts($conn, $u2), json_encode(counts($conn, $u2)));
} elseif ($phase === 'seed-orphans') {
    // Orfani come li lasciava la cascata rotta: si inseriscono con i controlli sulle chiavi esterne spenti.
    // Gli id (9xxxxx) non esistono nelle tabelle genitore. Si confronta con gli orfani già presenti prima.
    $orphansBefore = orphans($conn);
    $conn->exec("SET FOREIGN_KEY_CHECKS = 0");
    $exerciseIds = array_map('intval', $conn->query("SELECT id FROM gym_exercises ORDER BY id LIMIT 2")->fetchAll(PDO::FETCH_COLUMN));
    $conn->exec("INSERT INTO gym_workout_days (id, plan_id, name, day_order) VALUES (900001, 990001, 'Orfano A', 1), (900002, 990001, 'Orfano B', 2)");
    $conn->exec("INSERT INTO gym_workout_exercises (id, day_id, exercise_id, position, rest) VALUES
        (910001, 900001, {$exerciseIds[0]}, 0, 60), (910002, 900002, {$exerciseIds[1]}, 0, 60), (910003, 990002, {$exerciseIds[0]}, 0, 60)");
    $conn->exec("INSERT INTO gym_workout_plan_sets (workout_exercise_id, set_number, kind) VALUES
        (910001, 1, 'warmup'), (910002, 1, 'warmup'), (910003, 1, 'warmup'), (990003, 1, 'warmup')");
    $conn->exec("SET FOREIGN_KEY_CHECKS = 1");
    $orphansNow = orphans($conn);
    [$daysKey, $exercisesKey, $setsKey] = CHAIN_FOREIGN_KEYS;
    check("orfani inseriti per chiave esterna: giorni 2, esercizi 1, serie 1 (gli esercizi sotto i giorni orfani e le loro serie hanno ancora il genitore: la pulizia deve prenderli lo stesso)",
        [2, 1, 1] === [orphanDelta($orphansNow, $orphansBefore, $daysKey), orphanDelta($orphansNow, $orphansBefore, $exercisesKey), orphanDelta($orphansNow, $orphansBefore, $setsKey)],
        json_encode(array_filter($orphansNow)));
} elseif ($phase === 'check-orphans') {
    echo "Dopo la sezione di pulizia\n";
    checkNoOrphans($conn, 'dopo la pulizia');
    $u2 = (int)$conn->query("SELECT id FROM gym_users WHERE username = 'casc2'")->fetchColumn();
    $survivors = counts($conn, $u2);
    check("le righe sane del secondo utente restano (3 schede, 7 giorni, 14 esercizi, 28 serie)",
        [3, 7, 14, 28] === [$survivors['gym_workout_plans'], $survivors['gym_workout_days'], $survivors['gym_workout_exercises'], $survivors['gym_workout_plan_sets']], json_encode($survivors));
    check("gli orfani sono spariti", 0 === (int)$conn->query("SELECT COUNT(*) FROM gym_workout_days WHERE id IN (900001, 900002)")->fetchColumn()
        + (int)$conn->query("SELECT COUNT(*) FROM gym_workout_exercises WHERE id IN (910001, 910002, 910003)")->fetchColumn()
        + (int)$conn->query("SELECT COUNT(*) FROM gym_workout_plan_sets WHERE workout_exercise_id IN (910001, 910002, 910003, 990003)")->fetchColumn());
}

echo "\nCONTROLLI $checks FALLITI $fails\n";
exit($fails === 0 ? 0 : 1);
