<?php
require __DIR__ . '/../backend/lib/weekly_sets.php';

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

echo "Confine del lunedì\n";
$monday = new DateTime('2026-10-26 00:00:00'); // lunedì
$now = new DateTime('2026-10-29 10:00:00'); // giovedì 10:00
$rows = [
    ['date' => '2026-10-25 23:59:59', 'primary_muscle' => 'petto'], // domenica scorsa, fuori da "week"
    ['date' => '2026-10-26 00:00:00', 'primary_muscle' => 'petto'], // lunedì 00:00, dentro "week"
    ['date' => '2026-10-27 09:00:00', 'primary_muscle' => 'petto'],
];
$result = weeklySetsBuckets($rows, $monday, $now);
check('petto: 2 serie questa settimana (lunedì 00:00 incluso)', $result['week']['petto'] === 2);

echo "\nConfine di previous_to_date (ora - 7 giorni)\n";
// $now = 2026-10-29 10:00, quindi $now - 7 giorni = 2026-10-22 10:00
$rows2 = [
    ['date' => '2026-10-22 09:59:59', 'primary_muscle' => 'schiena'], // prima della soglia: dentro
    ['date' => '2026-10-22 10:00:00', 'primary_muscle' => 'schiena'], // alla soglia esatta: fuori
    ['date' => '2026-10-22 10:00:01', 'primary_muscle' => 'schiena'], // dopo la soglia: fuori
];
$result2 = weeklySetsBuckets($rows2, $monday, $now);
check('schiena: solo la serie prima dell\'istante di una settimana fa conta in previous_to_date', $result2['previous_to_date']['schiena'] === 1);
check('tutte e 3 le serie contano in previous_total (sono nella settimana scorsa intera)', $result2['previous_total'] === 3);

echo "\nConfine del lunedì della settimana scorsa\n";
$rows3 = [
    ['date' => '2026-10-18 23:59:59', 'primary_muscle' => 'glutei'], // prima del lunedì scorso: fuori da tutto
    ['date' => '2026-10-19 00:00:00', 'primary_muscle' => 'glutei'], // lunedì scorso 00:00: dentro previous_total
];
$result3 = weeklySetsBuckets($rows3, $monday, $now);
check('niente prima del lunedì scorso', $result3['previous_total'] === 1);

echo "\nprimary_muscle NULL o non contato\n";
$rows4 = [
    ['date' => '2026-10-27 09:00:00', 'primary_muscle' => null], // esercizio "gambe" personale senza scelta
    ['date' => '2026-10-27 09:00:00', 'primary_muscle' => 'boh'], // valore non tra i muscoli contati
    ['date' => '2026-10-27 09:00:00', 'primary_muscle' => 'quadricipiti'],
];
$result4 = weeklySetsBuckets($rows4, $monday, $now);
check('solo quadricipiti conta, NULL e valori sconosciuti no', array_sum($result4['week']) === 1 && $result4['week']['quadricipiti'] === 1);

echo "\nForma del bucket\n";
$empty = weeklySetsBuckets([], $monday, $now);
check('week ha le 12 chiavi di COUNTED_MUSCLES, nell\'ordine del corpo, tutte a 0', array_keys($empty['week']) === COUNTED_MUSCLES && array_sum($empty['week']) === 0);
check('previous_to_date ha le stesse 12 chiavi, tutte a 0', array_keys($empty['previous_to_date']) === COUNTED_MUSCLES && array_sum($empty['previous_to_date']) === 0);
check('previous_total è 0 senza righe', $empty['previous_total'] === 0);

echo "\n$checks controlli, $fails falliti\n";
exit($fails > 0 ? 1 : 0);
