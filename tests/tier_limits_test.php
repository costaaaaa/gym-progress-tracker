<?php
require __DIR__ . '/../backend/lib/tier_limits.php';

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

echo "Limiti per livello (fuso " . date_default_timezone_get() . ")\n";
if (isset($argv[1])) {
    check("il fuso di PHP è quello atteso ({$argv[1]})", date_default_timezone_get() === $argv[1]);
}
check('free: 2 schede, 4 giorni, 10 esercizi personali', tierLimits('free') === ['plans' => 2, 'days_per_plan' => 4, 'personal_exercises' => 10]);
check('plus: 50 schede, 14 giorni, 30 esercizi personali', tierLimits('plus') === ['plans' => 50, 'days_per_plan' => 14, 'personal_exercises' => 30]);
check('pro come plus', tierLimits('pro') === tierLimits('plus'));
check('livello sconosciuto: come free', tierLimits('premium') === tierLimits('free'));

echo "Sola lettura\n";
$free = tierLimits('free');
check('2 schede, 4 giorni: modificabile', planReadOnlyReason(2, 4, $free) === null);
check('1 scheda, 1 giorno: modificabile', planReadOnlyReason(1, 1, $free) === null);
check('3 schede: sola lettura plans_over_limit', planReadOnlyReason(3, 2, $free) === 'plans_over_limit');
check('5 giorni: sola lettura days_over_limit', planReadOnlyReason(2, 5, $free) === 'days_over_limit');
check('3 schede e 5 giorni: prevale plans_over_limit', planReadOnlyReason(3, 5, $free) === 'plans_over_limit');
check('plus: 3 schede e 5 giorni modificabile', planReadOnlyReason(3, 5, tierLimits('plus')) === null);
check('plus: 51 schede: sola lettura', planReadOnlyReason(51, 1, tierLimits('plus')) === 'plans_over_limit');
check('plus: 15 giorni: sola lettura', planReadOnlyReason(1, 15, tierLimits('plus')) === 'days_over_limit');

echo "Dettaglio del dashboard\n";
check('entrambe le funzioni: full', dashboardDetail(true, true) === 'full');
check('nessuna funzione: basic', dashboardDetail(false, false) === 'basic');
check('solo lo stato completo: basic', dashboardDetail(true, false) === 'basic');
check('solo le serie complete: basic', dashboardDetail(false, true) === 'basic');

$recovery = [
    'petto' => ['percent' => 100, 'status' => 'PRONTO', 'last_trained' => null],
    'schiena' => ['percent' => 30, 'status' => 'AFFATICATO', 'last_trained' => '2026-11-15 10:00:00', 'ready_at' => '2026-11-17T10:00:00+01:00'],
    'spalle' => ['percent' => 70, 'status' => 'IN RECUPERO', 'last_trained' => '2026-11-15 11:00:00', 'ready_at' => '2026-11-16T22:00:00+01:00'],
    'bicipiti' => ['percent' => 100, 'status' => 'PRONTO', 'last_trained' => '2026-11-10 09:00:00', 'ready_at' => '2026-11-11T09:00:00+01:00'],
];
check('full: lo stato resta identico', recoveryForDetail($recovery, true) === $recovery);
$basic = recoveryForDetail($recovery, false);
check('basic: stesse chiavi (muscoli)', array_keys($basic) === array_keys($recovery));
check('basic: PRONTO resta PRONTO', $basic['petto']['status'] === 'PRONTO' && $basic['bicipiti']['status'] === 'PRONTO');
check('basic: AFFATICATO diventa IN RECUPERO', $basic['schiena']['status'] === 'IN RECUPERO');
check('basic: IN RECUPERO resta IN RECUPERO', $basic['spalle']['status'] === 'IN RECUPERO');
check('basic: niente percent né ready_at', !array_key_exists('percent', $basic['schiena']) && !array_key_exists('ready_at', $basic['schiena']) && !array_key_exists('percent', $basic['petto']));
check('basic: last_trained invariato (anche null)', $basic['schiena']['last_trained'] === '2026-11-15 10:00:00' && $basic['petto']['last_trained'] === null);
check('basic: solo le chiavi status e last_trained', array_keys($basic['schiena']) === ['status', 'last_trained']);

$weekly = ['week' => ['petto' => 3, 'schiena' => 4], 'previous_to_date' => ['petto' => 1, 'schiena' => 1], 'previous_total' => 9];
check('basic: weekly_sets è solo il totale', weeklySetsForDetail($weekly, false) === ['total' => 7]);
$full = weeklySetsForDetail($weekly, true);
check('full: forma di oggi più total', $full === $weekly + ['total' => 7]);
check('full: nessuna chiave persa', $full['week'] === $weekly['week'] && $full['previous_total'] === 9);
check('totale a zero', weeklySetsForDetail(['week' => ['petto' => 0], 'previous_to_date' => [], 'previous_total' => 0], false) === ['total' => 0]);

echo "\nCONTROLLI $checks FALLITI $fails\n";
exit($fails > 0 ? 1 : 0);
