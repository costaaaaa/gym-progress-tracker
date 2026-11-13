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

// Il fuso del processo non deve cambiare nulla: tutto è in UTC. tests/tier_rules.sh passa il fuso
// atteso come primo argomento; senza argomento il controllo si salta.
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
check('valore sconosciuto: free', tierEffective('premium', null, $now) === 'free');
check('valore vuoto: free', tierEffective('', null, $now) === 'free');
check('valore sconosciuto con scadenza futura: free', tierEffective('gold', '2027-01-01 00:00:00', $now) === 'free');

echo "Data -> tier_until\n";
$r = tierSetUntil('plus', '2026-12-31', $now);
check('plus con data: tier_until = giorno dopo alle 00:00:00', $r === ['until' => '2027-01-01 00:00:00']);
$r = tierSetUntil('pro', '2026-02-28', '2026-01-01 00:00:00');
check('fine febbraio: il giorno dopo è il 1 marzo', $r === ['until' => '2026-03-01 00:00:00']);
$r = tierSetUntil('pro', '2026-11-13', $now);
check('oggi (UTC) è valido: scade domani alle 00:00', $r === ['until' => '2026-11-14 00:00:00']);
check('senza data: tier_until NULL', tierSetUntil('pro', null, $now) === ['until' => null]);
check('free senza data: tier_until NULL', tierSetUntil('free', null, $now) === ['until' => null]);
check('data non valida (formato)', isset(tierSetUntil('plus', '13/11/2026', $now)['error']));
check('data non valida (31 febbraio)', isset(tierSetUntil('plus', '2027-02-31', $now)['error']));
check('data non valida (testo)', isset(tierSetUntil('plus', 'domani', $now)['error']));
check('data non valida (stringa vuota)', isset(tierSetUntil('plus', '', $now)['error']));
check('data nel passato', isset(tierSetUntil('plus', '2026-11-12', $now)['error']));
check('free con data: errore', isset(tierSetUntil('free', '2026-12-31', $now)['error']));
check('9999-12-31: oltre il massimo di DATETIME, errore', str_contains(tierSetUntil('plus', '9999-12-31', $now)['error'] ?? '', 'non valida'));
check('9999-12-30: scade 9999-12-31 00:00:00', tierSetUntil('plus', '9999-12-30', $now) === ['until' => '9999-12-31 00:00:00']);
check('livello sconosciuto: errore', isset(tierSetUntil('gold', null, $now)['error']));

echo "tier_until -> ultimo giorno valido\n";
check('senza scadenza: null', tierLastDay(null) === null);
check('mezzanotte: l\'ultimo giorno è il giorno prima', tierLastDay('2027-01-01 00:00:00') === '2026-12-31');
check('inverso di tierSetUntil (fine febbraio)', tierLastDay(tierSetUntil('pro', '2026-02-28', '2026-01-01 00:00:00')['until']) === '2026-02-28');
check('inverso di tierSetUntil (9999-12-30)', tierLastDay('9999-12-31 00:00:00') === '9999-12-30');
check('scadenza a metà giornata: vale fino a quel giorno', tierLastDay('2026-11-13 10:30:00') === '2026-11-13');

echo "\n$checks controlli, $fails falliti\n";
exit($fails > 0 ? 1 : 0);
