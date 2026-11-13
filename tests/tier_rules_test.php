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

// Il fuso del processo (TZ) non deve cambiare nulla: tutto è in UTC.
echo "Livello effettivo (" . date_default_timezone_get() . ", TZ=" . (getenv('TZ') ?: '-') . ")\n";
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
check('livello sconosciuto: errore', isset(tierSetUntil('gold', null, $now)['error']));

echo "\n$checks controlli, $fails falliti\n";
exit($fails > 0 ? 1 : 0);
