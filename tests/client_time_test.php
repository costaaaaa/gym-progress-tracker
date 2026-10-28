<?php
// Orari mandati dal client (start_time, ended_at): client_datetime() li porta nel fuso del server prima
// che qualcuno li formatti per il database. Si lancia con tests/client_time.sh. Esce con 1 se un controllo fallisce.

require __DIR__ . '/../backend/config/api_helpers.php';

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

date_default_timezone_set('Europe/Rome');

check('UTC in ora legale: +2 ore', client_datetime('2026-10-24T16:00:00.000Z')->format('Y-m-d H:i:s') === '2026-10-24 18:00:00');
check('UTC in ora solare: +1 ora', client_datetime('2026-10-28T16:00:00.000Z')->format('Y-m-d H:i:s') === '2026-10-28 17:00:00');
check('dopo le 22 UTC finisce sul giorno dopo', client_datetime('2026-10-28T23:30:00.000Z')->format('Y-m-d H:i:s') === '2026-10-29 00:30:00');
check('cambio d\'ora di ottobre: 00:30 UTC del 25 è 02:30 ora legale', client_datetime('2026-10-25T00:30:00Z')->format('Y-m-d H:i:s') === '2026-10-25 02:30:00');
check('cambio d\'ora di ottobre: 01:30 UTC del 25 è 02:30 ora solare', client_datetime('2026-10-25T01:30:00Z')->format('Y-m-d H:i:s') === '2026-10-25 02:30:00');
check('offset esplicito diverso da UTC: stesso istante, ora del server', client_datetime('2026-10-28T11:00:00-05:00')->format('Y-m-d H:i:s') === '2026-10-28 17:00:00');
check('senza fuso: preso già nel fuso del server', client_datetime('2026-10-28 17:00:00')->format('Y-m-d H:i:s') === '2026-10-28 17:00:00');
check('l\'istante non cambia (timestamp)', client_datetime('2026-10-28T16:00:00.000Z')->getTimestamp() === (new DateTime('2026-10-28T16:00:00Z'))->getTimestamp());
check('il fuso del risultato è quello del server', client_datetime('2026-10-28T16:00:00.000Z')->getTimezone()->getName() === 'Europe/Rome');
check('stringa non valida: eccezione', (function () { try { client_datetime('non-una-data'); return false; } catch (Exception $e) { return true; } })());

echo "\n" . ($checks - $fails) . "/$checks controlli riusciti\n";
exit($fails > 0 ? 1 : 0);
