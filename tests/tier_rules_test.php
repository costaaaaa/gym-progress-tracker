<?php
require __DIR__ . '/../backend/lib/tier_rules.php';

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

// Il fuso del processo non deve cambiare nulla: gli istanti sono UTC, i giorni sono in ora italiana.
// tests/tier_rules.sh passa il fuso atteso come primo argomento; senza argomento il controllo si salta.
echo "Livello effettivo (fuso " . date_default_timezone_get() . ")\n";
if (isset($argv[1])) {
    check("il fuso di PHP è quello atteso ({$argv[1]})", date_default_timezone_get() === $argv[1]);
}
$now = '2026-11-13 12:00:00';
check('senza scadenza: plus resta plus', tierEffective('plus', null, $now) === 'plus');
check('senza scadenza: pro resta pro', tierEffective('pro', null, $now) === 'pro');
check('senza scadenza: free resta free', tierEffective('free', null, $now) === 'free');
check('scadenza futura: pro resta pro', tierEffective('pro', '2026-11-13 12:00:01', $now) === 'pro');
check('scadenza passata: pro diventa free', tierEffective('pro', '2026-11-13 11:59:59', $now) === 'free');
check('istante esatto della scadenza: scaduto', tierEffective('plus', '2026-11-13 12:00:00', $now) === 'free');
check('scade 2026-11-30 23:00:00: un secondo prima è ancora plus', tierEffective('plus', '2026-11-30 23:00:00', '2026-11-30 22:59:59') === 'plus');
check('scade 2026-11-30 23:00:00: all\'istante è free', tierEffective('plus', '2026-11-30 23:00:00', '2026-11-30 23:00:00') === 'free');
check('valore sconosciuto: free', tierEffective('premium', null, $now) === 'free');
check('valore vuoto: free', tierEffective('', null, $now) === 'free');
check('valore sconosciuto con scadenza futura: free', tierEffective('gold', '2027-01-01 00:00:00', $now) === 'free');

echo "Data -> tier_until\n";
$r = tierSetUntil('plus', '2026-12-31', $now);
check('plus con data: tier_until = giorno dopo alle 00:00 italiane, in UTC', $r === ['until' => '2026-12-31 23:00:00']);
$r = tierSetUntil('pro', '2026-02-28', '2026-01-01 00:00:00');
check('fine febbraio: scade il 1 marzo alle 00:00 italiane', $r === ['until' => '2026-02-28 23:00:00']);
$r = tierSetUntil('pro', '2026-11-13', $now);
check('oggi (ora italiana) è valido: scade domani alle 00:00 italiane', $r === ['until' => '2026-11-13 23:00:00']);
check('senza data: tier_until NULL', tierSetUntil('pro', null, $now) === ['until' => null]);
check('free senza data: tier_until NULL', tierSetUntil('free', null, $now) === ['until' => null]);
check('data non valida (formato)', isset(tierSetUntil('plus', '13/11/2026', $now)['error']));
check('data non valida (31 febbraio)', isset(tierSetUntil('plus', '2027-02-31', $now)['error']));
check('data non valida (testo)', isset(tierSetUntil('plus', 'domani', $now)['error']));
check('data non valida (stringa vuota)', isset(tierSetUntil('plus', '', $now)['error']));
check('data nel passato', isset(tierSetUntil('plus', '2026-11-12', $now)['error']));
check('free con data: errore', isset(tierSetUntil('free', '2026-12-31', $now)['error']));
check('9999-12-31: oltre il massimo di DATETIME, errore', str_contains(tierSetUntil('plus', '9999-12-31', $now)['error'] ?? '', 'non valida'));
check('9999-12-30: scade 9999-12-30 23:00:00', tierSetUntil('plus', '9999-12-30', $now) === ['until' => '9999-12-30 23:00:00']);
check('livello sconosciuto: errore', isset(tierSetUntil('gold', null, $now)['error']));

echo "Giorno italiano -> istante UTC\n";
$cases = [
    'inverno' => ['2026-11-30', '2026-11-30 23:00:00'],
    'estate' => ['2026-06-30', '2026-06-30 22:00:00'],
    'ora legale di marzo 2027: ultimo giorno prima del cambio' => ['2027-03-27', '2027-03-27 23:00:00'],
    'ora legale di marzo 2027: giorno del cambio (domenica 28)' => ['2027-03-28', '2027-03-28 22:00:00'],
    'ora solare di ottobre 2026: ultimo giorno prima del cambio' => ['2026-10-24', '2026-10-24 22:00:00'],
    'ora solare di ottobre 2026: giorno del cambio (domenica 25)' => ['2026-10-25', '2026-10-25 23:00:00'],
];
foreach ($cases as $name => [$day, $until]) {
    check("$name: $day -> $until", tierSetUntil('plus', $day, '2026-01-01 00:00:00') === ['until' => $until]);
    check("$name: andata e ritorno", tierLastDay($until) === $day);
}
check('ultimo giorno 2026-11-30, un secondo prima della mezzanotte italiana: accettato', tierSetUntil('plus', '2026-11-30', '2026-11-30 22:59:59') === ['until' => '2026-11-30 23:00:00']);
$r = tierSetUntil('plus', '2026-11-30', '2026-11-30 23:00:00');
check('ultimo giorno 2026-11-30, a mezzanotte italiana: rifiutato', ($r['error'] ?? '') === 'La data 2026-11-30 è già passata (ora italiana).');

echo "tier_until -> ultimo giorno valido\n";
check('senza scadenza: null', tierLastDay(null) === null);
check('mezzanotte italiana: l\'ultimo giorno è il giorno prima', tierLastDay('2026-12-31 23:00:00') === '2026-12-31');
check('un\'ora dopo la mezzanotte UTC il giorno italiano è già cambiato', tierLastDay('2027-01-01 00:00:00') === '2027-01-01');
check('inverso di tierSetUntil (fine febbraio)', tierLastDay(tierSetUntil('pro', '2026-02-28', '2026-01-01 00:00:00')['until']) === '2026-02-28');
check('inverso di tierSetUntil (9999-12-30)', tierLastDay('9999-12-30 23:00:00') === '9999-12-30');
check('scadenza a metà giornata: vale fino a quel giorno', tierLastDay('2026-11-13 10:30:00') === '2026-11-13');

echo "\n$checks controlli, $fails falliti\n";
exit($fails > 0 ? 1 : 0);
