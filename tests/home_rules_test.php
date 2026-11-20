<?php
// Regole pure della Home (backend/lib/home_rules.php): giorno proposto, giorni della settimana, layout dei blocchi
// e proposta di un modulo. Nessun database. Si lancia con tests/home_rules.sh. Esce con 1 se un controllo fallisce.

require __DIR__ . '/../backend/models/User.php';
require_once __DIR__ . '/../backend/lib/home_rules.php';

$fails = 0;
$checks = 0;
function check($desc, $expected, $got)
{
    global $fails, $checks;
    $checks++;
    if ($expected === $got) {
        echo "  \033[32m✓\033[0m $desc\n";
    } else {
        $fails++;
        echo "  \033[31m✗\033[0m $desc\n";
        echo '      atteso:   ' . var_export($expected, true) . "\n";
        echo '      ottenuto: ' . var_export($got, true) . "\n";
    }
}

echo "Giorno proposto (next_plan_day)\n";
$days = array(
    array('id' => 10, 'name' => 'Push', 'exercises' => 5),
    array('id' => 11, 'name' => 'Pull', 'exercises' => 6),
    array('id' => 12, 'name' => 'Legs', 'exercises' => 4),
);
check('senza giorni: null', null, next_plan_day(array(), 10));
check('senza ultimo allenamento: il primo', $days[0], next_plan_day($days, null));
check('dopo il primo: il secondo', $days[1], next_plan_day($days, 10));
check('dopo il secondo: il terzo', $days[2], next_plan_day($days, 11));
check('dopo l\'ultimo si ricomincia dal primo', $days[0], next_plan_day($days, 12));
check('ultimo giorno di un\'altra scheda (o eliminato): il primo', $days[0], next_plan_day($days, 99));
check('un solo giorno: sempre quello', $days[0], next_plan_day(array($days[0]), 10));

echo "Giorno dell'allenamento (workout_records_day)\n";
function recs($json)
{
    return json_decode($json);
}
check('tutti lo stesso giorno', 10, workout_records_day(recs('[{"exercise_id":1,"day_id":10},{"exercise_id":2,"day_id":10}]')));
check('giorno come stringa di cifre', 10, workout_records_day(recs('[{"exercise_id":1,"day_id":"10"}]')));
check('giorni diversi: null', null, workout_records_day(recs('[{"exercise_id":1,"day_id":10},{"exercise_id":2,"day_id":11}]')));
check('un elemento senza giorno: null', null, workout_records_day(recs('[{"exercise_id":1,"day_id":10},{"exercise_id":2}]')));
check('nessun giorno (app vecchie, allenamento passato): null', null, workout_records_day(recs('[{"exercise_id":1}]')));
check('giorno non valido: null', null, workout_records_day(recs('[{"exercise_id":1,"day_id":"abc"}]')));
check('giorno zero o negativo: null', null, workout_records_day(recs('[{"exercise_id":1,"day_id":0}]')));
check('gli elementi senza esercizio non contano', 10, workout_records_day(recs('[{"exercise_id":1,"day_id":10},{"day_id":99}]')));
check('elenco vuoto: null', null, workout_records_day(array()));

echo "Giorni della settimana (week_day_flags)\n";
$mon = '2026-11-16';
check('nessun allenamento: sette falsi', array_fill(0, 7, false), week_day_flags(array(), $mon));
check('lunedì e domenica', array(true, false, false, false, false, false, true),
    week_day_flags(array('2026-11-16 00:00:00', '2026-11-22 23:59:59'), $mon));
check('due allenamenti lo stesso giorno contano un giorno', array(false, false, true, false, false, false, false),
    week_day_flags(array('2026-11-18 07:00:00', '2026-11-18 19:00:00'), $mon));
check('fuori dalla settimana: ignorati', array_fill(0, 7, false),
    week_day_flags(array('2026-11-15 23:59:59', '2026-11-23 00:00:00'), $mon));
check('cambio d\'ora (lunedì 26 ottobre 2026 dopo la domenica 25): sette giorni di calendario',
    array(true, false, false, false, false, false, true),
    week_day_flags(array('2026-10-26 08:00:00', '2026-11-01 12:00:00'), '2026-10-26'));

echo "Layout dei blocchi (home_layout_valid / home_layout_stored)\n";
$ok = array(array('key' => 'last', 'hidden' => false, 'large' => false), array('key' => 'body', 'hidden' => true, 'large' => true));
check('elenco valido: normalizzato', $ok, home_layout_valid($ok));
check('campi in più si scartano', $ok, home_layout_valid(array(
    array('key' => 'last', 'hidden' => false, 'large' => false, 'x' => 1), array('key' => 'body', 'hidden' => true, 'large' => true, 'y' => 2))));
check('elenco vuoto è valido', array(), home_layout_valid(array()));
check('tutti i cinque blocchi', 5, count(home_layout_valid(array_map(function ($k) { return array('key' => $k, 'hidden' => false, 'large' => false); }, User::HOME_BLOCKS))));
check('non è un elenco (oggetto con chiavi)', false, home_layout_valid(array('a' => $ok[0])));
check('non è un array', false, home_layout_valid('last'));
check('chiave sconosciuta', false, home_layout_valid(array(array('key' => 'ai', 'hidden' => false, 'large' => false))));
check('chiave non stringa', false, home_layout_valid(array(array('key' => 1, 'hidden' => false, 'large' => false))));
check('doppione', false, home_layout_valid(array($ok[0], $ok[0])));
check('hidden stringa', false, home_layout_valid(array(array('key' => 'last', 'hidden' => 'false', 'large' => false))));
check('large intero', false, home_layout_valid(array(array('key' => 'last', 'hidden' => false, 'large' => 1))));
check('manca large', false, home_layout_valid(array(array('key' => 'last', 'hidden' => false))));
check('elemento non array', false, home_layout_valid(array('last')));
check('troppi elementi', false, home_layout_valid(array_merge($ok, $ok, $ok, $ok)));
check('stored: JSON valido', $ok, home_layout_stored(json_encode($ok)));
check('stored: NULL', null, home_layout_stored(null));
check('stored: JSON rotto', null, home_layout_stored('{non json'));
check('stored: valore non valido', null, home_layout_stored(json_encode(array(array('key' => 'zzz', 'hidden' => false, 'large' => false)))));

echo "Proposta di un modulo (module_to_offer)\n";
$none = array('body' => false, 'recovery' => false, 'levels' => false, 'groups' => false, 'ai' => false);
$now = new DateTimeImmutable('2026-11-21 12:00:00');
check('modulo con ordine: Peso e misure per primo', 'body', module_to_offer($none, '2026-11-10 12:00:00', array(), null, $now));
check('meno di sette giorni dalla scelta: null', null, module_to_offer($none, '2026-11-14 12:00:01', array(), null, $now));
check('esattamente sette giorni: si propone', 'body', module_to_offer($none, '2026-11-14 12:00:00', array(), null, $now));
check('scelta mai fatta: null', null, module_to_offer($none, null, array(), null, $now));
check('il primo è già attivo: passa al successivo', 'levels', module_to_offer(array('body' => true) + $none, '2026-11-01 00:00:00', array(), null, $now));
check('rifiutato: passa al successivo', 'levels', module_to_offer($none, '2026-11-01 00:00:00', array('body'), null, $now));
check('ordine completo: groups poi recovery', 'groups', module_to_offer(array('body' => true, 'levels' => true) + $none, '2026-11-01 00:00:00', array(), null, $now));
check('recovery per ultimo', 'recovery', module_to_offer(array('body' => true, 'levels' => true, 'groups' => true) + $none, '2026-11-01 00:00:00', array(), null, $now));
check('assistenti AI mai proposti', null, module_to_offer(array('body' => true, 'levels' => true, 'groups' => true, 'recovery' => true, 'ai' => false), '2026-11-01 00:00:00', array(), null, $now));
check('tutti attivi: null', null, module_to_offer(array_fill_keys(User::MODULES, true), '2026-11-01 00:00:00', array(), null, $now));
check('tutti attivi o rifiutati: null', null, module_to_offer(array('body' => true) + $none, '2026-11-01 00:00:00', array('levels', 'groups', 'recovery'), null, $now));
check('ultima risposta meno di sette giorni fa: null', null, module_to_offer($none, '2026-11-01 00:00:00', array('body'), '2026-11-15 12:00:00', $now));
check('ultima risposta sette giorni fa: si propone', 'levels', module_to_offer($none, '2026-11-01 00:00:00', array('body'), '2026-11-14 12:00:00', $now));
check('la scelta recente blocca anche con ultima risposta vecchia', null, module_to_offer($none, '2026-11-20 00:00:00', array(), '2026-10-01 00:00:00', $now));
check('chiavi sconosciute tra i rifiutati si ignorano', 'body', module_to_offer($none, '2026-11-01 00:00:00', array('zzz'), null, $now));

echo "\n$checks controlli, $fails falliti\n";
exit($fails ? 1 : 0);
