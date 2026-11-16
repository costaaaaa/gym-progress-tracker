<?php
// Eseguito da tests/delete_cascade.sh (serve un database con lo schema del repo).
// Argomenti: cartella backend da provare, fase (cases | seed-orphans | check-orphans).
//
// Con MySQL 9.7 la cascata ON DELETE CASCADE che attraversa quattro o più tabelle non arriva in fondo:
// questo test cancella con il codice vero (User::deleteAccount, WorkoutPlan::delete) e conta, per ogni
// chiave esterna dello schema, le righe figlie rimaste senza genitore.
require $argv[1] . '/config/database.php';
require $argv[1] . '/models/User.php';
require $argv[1] . '/models/WorkoutPlan.php';

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
        foreach ($cols as $c) {
            $on[] = "c.`{$c['COLUMN_NAME']}` = p.`{$c['REFERENCED_COLUMN_NAME']}`";
        }
        $first = $cols[0];
        $sql = "SELECT COUNT(*) FROM `{$first['TABLE_NAME']}` c
                LEFT JOIN `{$first['REFERENCED_TABLE_NAME']}` p ON " . implode(' AND ', $on) . "
                WHERE c.`{$first['COLUMN_NAME']}` IS NOT NULL AND p.`{$first['REFERENCED_COLUMN_NAME']}` IS NULL";
        $found[$name] = (int)$conn->query($sql)->fetchColumn();
    }
    return $found;
}

function checkNoOrphans($conn, $when)
{
    $o = orphans($conn);
    check("$when: " . count($o) . " chiavi esterne controllate, nessun orfano", count($o) > 0 && array_sum($o) === 0,
        json_encode(array_filter($o)));
}

// Numero di righe dei dati di un utente, per tabella
function counts($conn, $u)
{
    $q = [
        'gym_workout_plans' => "SELECT COUNT(*) FROM gym_workout_plans WHERE user_id = $u",
        'gym_workout_days' => "SELECT COUNT(*) FROM gym_workout_days d JOIN gym_workout_plans p ON p.id = d.plan_id WHERE p.user_id = $u",
        'gym_workout_exercises' => "SELECT COUNT(*) FROM gym_workout_exercises e JOIN gym_workout_days d ON d.id = e.day_id JOIN gym_workout_plans p ON p.id = d.plan_id WHERE p.user_id = $u",
        'gym_workout_plan_sets' => "SELECT COUNT(*) FROM gym_workout_plan_sets s JOIN gym_workout_exercises e ON e.id = s.workout_exercise_id JOIN gym_workout_days d ON d.id = e.day_id JOIN gym_workout_plans p ON p.id = d.plan_id WHERE p.user_id = $u",
        'gym_workout_history' => "SELECT COUNT(*) FROM gym_workout_history WHERE user_id = $u",
        'gym_workout_sets' => "SELECT COUNT(*) FROM gym_workout_sets s JOIN gym_workout_history h ON h.id = s.workout_history_id WHERE h.user_id = $u",
        'gym_groups' => "SELECT COUNT(*) FROM gym_groups WHERE owner_user_id = $u",
        'gym_group_members' => "SELECT COUNT(*) FROM gym_group_members WHERE user_id = $u",
    ];
    $out = [];
    foreach ($q as $t => $sql) {
        $out[$t] = (int)$conn->query($sql)->fetchColumn();
    }
    return $out;
}

function planCounts($conn, $plan)
{
    return [
        'days' => (int)$conn->query("SELECT COUNT(*) FROM gym_workout_days WHERE plan_id = $plan")->fetchColumn(),
        'exercises' => (int)$conn->query("SELECT COUNT(*) FROM gym_workout_exercises e JOIN gym_workout_days d ON d.id = e.day_id WHERE d.plan_id = $plan")->fetchColumn(),
        'sets' => (int)$conn->query("SELECT COUNT(*) FROM gym_workout_plan_sets s JOIN gym_workout_exercises e ON e.id = s.workout_exercise_id JOIN gym_workout_days d ON d.id = e.day_id WHERE d.plan_id = $plan")->fetchColumn(),
    ];
}

// 3 schede (2, 3 e 2 giorni), 2 esercizi per giorno, 2 serie pianificate per esercizio, 3 allenamenti con 2 serie, un gruppo
function seedUser($conn, $name, $ex)
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
                    ->execute([$day, $ex[$pos], $pos]);
                $we = (int)$conn->lastInsertId();
                $conn->prepare("INSERT INTO gym_workout_plan_sets (workout_exercise_id, set_number, kind) VALUES (?, 1, 'warmup')")->execute([$we]);
                $conn->prepare("INSERT INTO gym_workout_plan_sets (workout_exercise_id, set_number, kind, reps_min, reps_max) VALUES (?, 2, 'working', 8, 10)")->execute([$we]);
            }
        }
    }
    for ($h = 0; $h < 3; $h++) {
        $conn->prepare("INSERT INTO gym_workout_history (user_id, exercises) VALUES (?, '[]')")->execute([$u]);
        $hist = (int)$conn->lastInsertId();
        foreach ([1, 2] as $n) {
            $conn->prepare("INSERT INTO gym_workout_sets (workout_history_id, exercise_id, set_number, weight, reps) VALUES (?, ?, ?, 50, '10')")
                ->execute([$hist, $ex[0], $n]);
        }
    }
    $conn->prepare("INSERT INTO gym_groups (name, owner_user_id, invite_code) VALUES (?, ?, ?)")->execute(["Gruppo $name", $u, substr(md5($name), 0, 10)]);
    $g = (int)$conn->lastInsertId();
    $conn->prepare("INSERT INTO gym_group_members (group_id, user_id, role, share_consent_at) VALUES (?, ?, 'owner', NOW())")->execute([$g, $u]);
    return $u;
}

if ($phase === 'cases') {
    $ex = array_map('intval', $conn->query("SELECT id FROM gym_exercises ORDER BY id LIMIT 2")->fetchAll(PDO::FETCH_COLUMN));
    if (count($ex) < 2) {
        fwrite(STDERR, "Il catalogo esercizi dello schema è vuoto\n");
        exit(2);
    }
    $u1 = seedUser($conn, 'casc1', $ex);
    $u2 = seedUser($conn, 'casc2', $ex);
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
    $before = array_map(fn($p) => planCounts($conn, $p), $others);
    $plan = new WorkoutPlan($conn);
    $plan->id = $victim;
    $plan->user_id = $u1;
    check("delete() risponde true", $plan->delete() === true);
    check("la scheda non c'è più", (int)$conn->query("SELECT COUNT(*) FROM gym_workout_plans WHERE id = $victim")->fetchColumn() === 0);
    check("sono spariti i suoi giorni, esercizi e serie pianificate", planCounts($conn, $victim) === ['days' => 0, 'exercises' => 0, 'sets' => 0],
        json_encode(planCounts($conn, $victim)));
    check("le altre due schede dello stesso utente sono intatte", $before === array_map(fn($p) => planCounts($conn, $p), $others));
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
    check("nemmeno giorni, esercizi e serie pianificate delle sue schede (senza passare dall'utente)",
        [0, 0, 0] === [
            (int)$conn->query("SELECT COUNT(*) FROM gym_workout_days d LEFT JOIN gym_workout_plans p ON p.id = d.plan_id WHERE p.id IS NULL")->fetchColumn(),
            (int)$conn->query("SELECT COUNT(*) FROM gym_workout_exercises e LEFT JOIN gym_workout_days d ON d.id = e.day_id WHERE d.id IS NULL")->fetchColumn(),
            (int)$conn->query("SELECT COUNT(*) FROM gym_workout_plan_sets s LEFT JOIN gym_workout_exercises e ON e.id = s.workout_exercise_id WHERE e.id IS NULL")->fetchColumn(),
        ]);
    checkNoOrphans($conn, 'dopo il caso 2');
    check("i dati del secondo utente sono intatti", $base2 === counts($conn, $u2), json_encode(counts($conn, $u2)));
} elseif ($phase === 'seed-orphans') {
    // Orfani come li lasciava la cascata rotta: si inseriscono con i controlli sulle chiavi esterne spenti.
    // Parte dal secondo utente rimasto (sano) per avere gli id dei giorni/esercizi veri su cui appoggiare le righe sane.
    $before = orphans($conn);
    $conn->exec("SET FOREIGN_KEY_CHECKS = 0");
    $ex = array_map('intval', $conn->query("SELECT id FROM gym_exercises ORDER BY id LIMIT 2")->fetchAll(PDO::FETCH_COLUMN));
    $conn->exec("INSERT INTO gym_workout_days (id, plan_id, name, day_order) VALUES (900001, 990001, 'Orfano A', 1), (900002, 990001, 'Orfano B', 2)");
    $conn->exec("INSERT INTO gym_workout_exercises (id, day_id, exercise_id, position, rest) VALUES
        (910001, 900001, {$ex[0]}, 0, 60), (910002, 900002, {$ex[1]}, 0, 60), (910003, 990002, {$ex[0]}, 0, 60)");
    $conn->exec("INSERT INTO gym_workout_plan_sets (workout_exercise_id, set_number, kind) VALUES
        (910001, 1, 'warmup'), (910002, 1, 'warmup'), (910003, 1, 'warmup'), (990003, 1, 'warmup')");
    $conn->exec("SET FOREIGN_KEY_CHECKS = 1");
    $o = orphans($conn);
    $k = ['gym_workout_days.gym_workout_days_ibfk_1', 'gym_workout_exercises.gym_workout_exercises_ibfk_1', 'gym_workout_plan_sets.gym_workout_plan_sets_ibfk_1'];
    check("orfani inseriti per chiave esterna: giorni 2, esercizi 1, serie 1 (gli esercizi sotto i giorni orfani e le loro serie hanno ancora il genitore: la pulizia deve prenderli lo stesso)",
        [2, 1, 1] === [$o[$k[0]] - $before[$k[0]], $o[$k[1]] - $before[$k[1]], $o[$k[2]] - $before[$k[2]]],
        json_encode(array_filter($o)));
} elseif ($phase === 'check-orphans') {
    echo "Dopo la sezione di pulizia\n";
    checkNoOrphans($conn, 'dopo la pulizia');
    $u2 = (int)$conn->query("SELECT id FROM gym_users WHERE username = 'casc2'")->fetchColumn();
    $c = counts($conn, $u2);
    check("le righe sane del secondo utente restano (3 schede, 7 giorni, 14 esercizi, 28 serie)",
        [3, 7, 14, 28] === [$c['gym_workout_plans'], $c['gym_workout_days'], $c['gym_workout_exercises'], $c['gym_workout_plan_sets']], json_encode($c));
    check("gli orfani sono spariti", 0 === (int)$conn->query("SELECT COUNT(*) FROM gym_workout_days WHERE id IN (900001, 900002)")->fetchColumn()
        + (int)$conn->query("SELECT COUNT(*) FROM gym_workout_exercises WHERE id IN (910001, 910002, 910003)")->fetchColumn()
        + (int)$conn->query("SELECT COUNT(*) FROM gym_workout_plan_sets WHERE workout_exercise_id IN (910001, 910002, 910003, 990003)")->fetchColumn());
}

echo "\nCONTROLLI $checks FALLITI $fails\n";
exit($fails === 0 ? 0 : 1);
