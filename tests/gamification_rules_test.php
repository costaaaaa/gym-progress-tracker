<?php
// Record personali e XP di un allenamento (backend/lib/gamification_rules.php), senza database.
// Si lancia con tests/gamification_rules.sh. Esce con 1 se un controllo fallisce.

require __DIR__ . '/../backend/lib/gamification_rules.php';

$fails = 0;
$checks = 0;
function check($desc, $cond)
{
    global $fails, $checks;
    $checks++;
    if ($cond) {
        echo "  \033[32m✓\033[0m $desc\n";
    } else {
        $fails++;
        echo "  \033[31m✗\033[0m $desc\n";
    }
}

echo "Record (tests/fixtures/pr_cases.json, stessi casi del client)\n";
$fixture = json_decode(file_get_contents(__DIR__ . '/fixtures/pr_cases.json'), true);
foreach ($fixture['cases'] as $case) {
    $prev = $case['history'] === null ? null : setBests(array_merge(...$case['history']));
    $rec = exerciseRecords($case['sets'], $prev);
    $e = $case['expect'];
    check($case['name'], $rec['weight'] === $e['weight'] && $rec['one_rm'] === $e['oneRM']
        && $rec['bw_reps'] === $e['reps'] && $rec['is_pr'] === $e['isPR']);
}

echo "XP dell'allenamento\n";
$pr_sets = [['weight' => 85, 'reps' => 3]];
$prev = [1 => setBests([['weight' => 80, 'reps' => 5]]), 2 => setBests([['weight' => 80, 'reps' => 5]])];

$r = workoutRewards([1 => $pr_sets], $prev, true, []);
check('sessione valida con un record: 20 + 15 generali, 10 + 15 sull\'esercizio',
    $r['xp_general'] === XP_SESSION + XP_PR && $r['exercises'] === [1 => ['xp' => XP_EXERCISE_SESSION + XP_EXERCISE_PR, 'is_pr' => true]]);

$r = workoutRewards([1 => $pr_sets], $prev, true, [1]);
check('record già pagato oggi sullo stesso esercizio: solo gli XP di sessione',
    $r['xp_general'] === XP_SESSION && !$r['pr_in_session'] && $r['exercises'] === [1 => ['xp' => XP_EXERCISE_SESSION, 'is_pr' => false]]);

$r = workoutRewards([1 => $pr_sets], $prev, false, [2]);
check('sessione senza XP: il record paga lo stesso (il limite vale per esercizio)',
    $r['xp_general'] === XP_PR && $r['exercises'] === [1 => ['xp' => XP_EXERCISE_PR, 'is_pr' => true]]);

$r = workoutRewards([1 => [['weight' => 60, 'reps' => 5]]], $prev, false, []);
check('sessione senza XP e senza record: niente', $r['xp_general'] === 0 && $r['exercises'] === []);

$r = workoutRewards([1 => $pr_sets, 2 => $pr_sets], $prev, true, []);
check('due record: il bonus generale una volta sola', $r['xp_general'] === XP_SESSION + XP_PR && count($r['exercises']) === 2);

$r = workoutRewards([1 => [['weight' => 60, 'reps' => 5]], 3 => [['weight' => 0, 'reps' => 10], ['weight' => 20, 'reps' => 0]]], $prev, true, []);
check('volume: somma delle serie con ripetizioni di tutti gli esercizi', $r['volume'] == 300.0);
check('esercizio mai fatto: XP di sessione, nessun record', $r['exercises'][3] === ['xp' => XP_EXERCISE_SESSION, 'is_pr' => false]);

echo "Ripetizioni\n";
check('"8-10" vale 10', parseReps('8-10') === 10);
check('"12/10/8" vale 12', parseReps('12/10/8') === 12);
check('"max" vale 0', parseReps('max') === 0);

echo "\n$checks controlli, $fails falliti\n";
exit($fails > 0 ? 1 : 0);
