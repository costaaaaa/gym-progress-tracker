<?php
require __DIR__ . '/../backend/lib/recovery_rules.php';

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

// Una serie letta dal database: 'date' (come in gym_workout_history.date), l'istante di inizio
// nel fuso dell'allenamento e il muscolo principale dell'esercizio.
function setRow($date, $muscle = 'petto', $zone = 'Europe/Rome')
{
    return [
        'date' => $date,
        'started_at' => new DateTimeImmutable($date, new DateTimeZone($zone)),
        'primary_muscle' => $muscle,
    ];
}

function profile($level = 'intermedio', $age = 25, $gender = 'M')
{
    return ['level' => $level, 'age' => $age, 'gender' => $gender];
}

echo "Nessuna sessione\n";
$now = new DateTime('2026-10-30 12:00:00', new DateTimeZone('Europe/Rome'));
$r = recoveryStatus([], profile(), $now);
check('i 12 muscoli sono presenti', count($r) === 12);
check('tutti PRONTO al 100% senza allenamento', count(array_filter($r, fn($m) => $m['status'] === 'PRONTO' && $m['percent'] === 100 && $m['last_trained'] === null)) === 12);
check('nessuna chiave ready_at', count(array_filter($r, fn($m) => array_key_exists('ready_at', $m))) === 0);

echo "\nUna sessione: petto, intermedio, 3 serie, 25 anni, M\n";
// 60 h di base (intermedio) senza fattori: iniziata giovedì 29/10 09:00 (CET, +01:00) è pronta
// sabato 31/10 21:00. Alle 12:00 di venerdì 30/10 sono passate 27 h su 60: 45%.
$rows = [setRow('2026-10-29 09:00:00'), setRow('2026-10-29 09:00:00'), setRow('2026-10-29 09:00:00')];
$r = recoveryStatus($rows, profile('intermedio', 25, 'M'), $now);
check('petto: 45%', $r['petto']['percent'] == 45);
check('petto: AFFATICATO (sotto il 50%)', $r['petto']['status'] === 'AFFATICATO');
check('petto: last_trained è la data della sessione', $r['petto']['last_trained'] === '2026-10-29 09:00:00');
check('petto: pronto sabato 31/10 alle 21:00', $r['petto']['ready_at'] === '2026-10-31T21:00:00+01:00');
check('schiena resta PRONTO senza ready_at', $r['schiena'] === ['percent' => 100, 'status' => 'PRONTO', 'last_trained' => null]);

echo "\nVolume: 4 serie ×1.15\n";
// 60 × 1.15 = 69 h, arrotondate a multipli di 6 h: 72 h. Dal 29/10 09:00 a domenica 01/11 09:00.
$rows = array_fill(0, 4, setRow('2026-10-29 09:00:00'));
$r = recoveryStatus($rows, profile('intermedio', 25, 'M'), $now);
check('petto con 4 serie: pronto 01/11 alle 09:00', $r['petto']['ready_at'] === '2026-11-01T09:00:00+01:00');

echo "\nVolume: 6 serie ×1.30\n";
// 60 × 1.30 = 78 h: dal 29/10 09:00 a domenica 01/11 15:00.
$rows = array_fill(0, 6, setRow('2026-10-29 09:00:00'));
$r = recoveryStatus($rows, profile('intermedio', 25, 'M'), $now);
check('petto con 6 serie: pronto 01/11 alle 15:00', $r['petto']['ready_at'] === '2026-11-01T15:00:00+01:00');

echo "\nEtà\n";
$rows = array_fill(0, 3, setRow('2026-10-29 09:00:00'));
$r = recoveryStatus($rows, profile('intermedio', 30, 'M'), $now);
check('30 anni ×1.10 = 66 h: pronto 01/11 alle 03:00', $r['petto']['ready_at'] === '2026-11-01T03:00:00+01:00');
$r = recoveryStatus($rows, profile('intermedio', 40, 'M'), $now);
check('40 anni ×1.20 = 72 h: pronto 01/11 alle 09:00', $r['petto']['ready_at'] === '2026-11-01T09:00:00+01:00');
$r = recoveryStatus($rows, profile('intermedio', 50, 'M'), $now);
check('50 anni ×1.35 = 81 h, arrotondate a 84 h: pronto 01/11 alle 21:00', $r['petto']['ready_at'] === '2026-11-01T21:00:00+01:00');
$r = recoveryStatus($rows, profile('intermedio', 29, 'M'), $now);
check('29 anni, nessun fattore: 60 h, pronto 31/10 alle 21:00', $r['petto']['ready_at'] === '2026-10-31T21:00:00+01:00');
$r = recoveryStatus($rows, profile('intermedio', null, 'M'), $now);
check('età assente = 25 anni: 60 h, pronto 31/10 alle 21:00', $r['petto']['ready_at'] === '2026-10-31T21:00:00+01:00');

echo "\nSesso\n";
$rows = array_fill(0, 3, setRow('2026-10-29 09:00:00'));
$r = recoveryStatus($rows, profile('intermedio', 25, 'F'), $now);
check('F ×0.90 = 54 h: petto pronto 31/10 alle 15:00', $r['petto']['ready_at'] === '2026-10-31T15:00:00+01:00');
$rows = array_fill(0, 3, setRow('2026-10-29 09:00:00', 'quadricipiti'));
$r = recoveryStatus($rows, profile('intermedio', 25, 'O'), $now);
check('O ×0.95: 72 h diventano 68.4, arrotondate a 66 h: quadricipiti pronti 01/11 alle 03:00', $r['quadricipiti']['ready_at'] === '2026-11-01T03:00:00+01:00');

echo "\nArrotondamento a 6 h e livello\n";
$rows = array_fill(0, 3, setRow('2026-10-29 09:00:00'));
$r = recoveryStatus($rows, profile('amatoriale', 25, 'O'), $now);
check('amatoriale O: 66 × 0.95 = 62.7 h, arrotondate per difetto a 60 h: pronto 31/10 alle 21:00', $r['petto']['ready_at'] === '2026-10-31T21:00:00+01:00');
$r = recoveryStatus($rows, profile('avanzato', 25, 'M'), $now);
check('avanzato: 54 h di base, pronto 31/10 alle 15:00', $r['petto']['ready_at'] === '2026-10-31T15:00:00+01:00');

echo "\nResiduo: riallenato prima di essere pronto\n";
// Il 27/10 09:00 la prima sessione (60 h) finisce il 29/10 alle 21:00. La seconda, il 29/10 alle
// 09:00, arriva 12 h prima: 60 + 12 × 0.5 = 66 h, pronto il 01/11 alle 03:00. Alle 12:00 del 30/10
// sono passate 27 h su 66: 40.9%.
$rows = array_merge(
    array_fill(0, 3, setRow('2026-10-27 09:00:00')),
    array_fill(0, 3, setRow('2026-10-29 09:00:00'))
);
$r = recoveryStatus($rows, profile('intermedio', 25, 'M'), $now);
check('petto: pronto 01/11 alle 03:00 (66 h dalla seconda sessione)', $r['petto']['ready_at'] === '2026-11-01T03:00:00+01:00');
check('petto: last_trained è la seconda sessione', $r['petto']['last_trained'] === '2026-10-29 09:00:00');
check('petto: 41%', $r['petto']['percent'] == 41);

echo "\nResiduo dispari: si arrotonda a 6 h prima, poi si aggiunge il residuo\n";
// La prima sessione (27/10 09:00, 60 h) finisce il 29/10 alle 21:00. La seconda, il 29/10 alle 16:00,
// arriva 5 h prima: 60 (già arrotondate a 6 h) + 5 × 0.5 = 62.5 h, arrotondate a 63 h (round, metà verso
// l'alto): pronto il 01/11 alle 07:00. Arrotondare a 6 h dopo il residuo darebbe 60 h (31/10 alle
// 04:00), senza l'arrotondamento finale 62 h o 62.5 h. Alle 12:00 del 30/10 sono passate 20 h su 63: 31.7%.
$rows = array_merge(
    array_fill(0, 3, setRow('2026-10-27 09:00:00')),
    array_fill(0, 3, setRow('2026-10-29 16:00:00'))
);
$r = recoveryStatus($rows, profile('intermedio', 25, 'M'), $now);
check('petto: pronto 01/11 alle 07:00 (63 h dalla seconda sessione)', $r['petto']['ready_at'] === '2026-11-01T07:00:00+01:00');
check('petto: 32%', $r['petto']['percent'] == 32);

echo "\nResiduo: riallenato dopo essere pronto\n";
// Il 25/10 09:00 la prima sessione (60 h) finisce il 27/10 alle 21:00: la seconda, il 29/10 alle
// 09:00, non ha residuo e vale 60 h da sola.
$rows = array_merge(
    array_fill(0, 3, setRow('2026-10-25 09:00:00')),
    array_fill(0, 3, setRow('2026-10-29 09:00:00'))
);
$r = recoveryStatus($rows, profile('intermedio', 25, 'M'), $now);
check('petto: pronto 31/10 alle 21:00, nessun residuo', $r['petto']['ready_at'] === '2026-10-31T21:00:00+01:00');

echo "\nSoglie di percent e stato\n";
// Sessione del 29/10 09:00, 60 h, pronta il 31/10 alle 21:00.
$rows = array_fill(0, 3, setRow('2026-10-29 09:00:00'));
$tz = new DateTimeZone('Europe/Rome');
$r = recoveryStatus($rows, profile(), new DateTime('2026-10-30 14:00:00', $tz)); // 29 h su 60: 48.3%
check('29 h su 60: 48% AFFATICATO', $r['petto']['percent'] == 48 && $r['petto']['status'] === 'AFFATICATO');
$r = recoveryStatus($rows, profile(), new DateTime('2026-10-30 15:00:00', $tz)); // 30 h su 60: 50%
check('30 h su 60: 50% IN RECUPERO (il 50% non è affaticato)', $r['petto']['percent'] == 50 && $r['petto']['status'] === 'IN RECUPERO');
$r = recoveryStatus($rows, profile(), new DateTime('2026-10-31 20:54:00', $tz)); // 59.9 h su 60: 99.8%
check('59.9 h su 60: 99% e non 100 (IN RECUPERO finché non è pronto)', $r['petto']['percent'] == 99 && $r['petto']['status'] === 'IN RECUPERO');
$r = recoveryStatus($rows, profile(), new DateTime('2026-10-31 21:00:00', $tz)); // proprio all'ora di ready_at
check('all\'ora di ready_at: PRONTO 100%, con last_trained e ready_at', $r['petto']['percent'] === 100 && $r['petto']['status'] === 'PRONTO' && $r['petto']['last_trained'] === '2026-10-29 09:00:00' && $r['petto']['ready_at'] === '2026-10-31T21:00:00+01:00');

echo "\nready_at nel fuso di now, con allenamenti in fusi diversi\n";
// Stesso istante (29/10 08:00Z) salvato a Los Angeles e a Tokyo: pronto il 31/10 alle 20:00Z.
$rows = array_merge(
    array_fill(0, 3, setRow('2026-10-29 01:00:00', 'petto', 'America/Los_Angeles')),
    array_fill(0, 3, setRow('2026-10-29 17:00:00', 'schiena', 'Asia/Tokyo'))
);
$r = recoveryStatus($rows, profile(), $now); // $now è a Roma
check('petto (Los Angeles) in ora di Roma: 31/10 alle 21:00 +01:00', $r['petto']['ready_at'] === '2026-10-31T21:00:00+01:00');
check('schiena (Tokyo) in ora di Roma: 31/10 alle 21:00 +01:00', $r['schiena']['ready_at'] === '2026-10-31T21:00:00+01:00');
check('last_trained resta la data salvata nel fuso dell\'allenamento', $r['petto']['last_trained'] === '2026-10-29 01:00:00' && $r['schiena']['last_trained'] === '2026-10-29 17:00:00');
$r = recoveryStatus($rows, profile(), new DateTime('2026-10-30 07:00:00', new DateTimeZone('America/New_York')));
check('con now a New York: 31/10 alle 16:00 -04:00', $r['petto']['ready_at'] === '2026-10-31T16:00:00-04:00');
check('stessi 27 h su 60 (45%) a prescindere dal fuso di now', $r['petto']['percent'] == 45);

echo "\nEsercizi senza muscolo principale\n";
$rows = array_fill(0, 3, setRow('2026-10-29 09:00:00', null));
$r = recoveryStatus($rows, profile(), $now);
check('non contano: i 12 muscoli restano PRONTO', count(array_filter($r, fn($m) => $m['status'] === 'PRONTO' && $m['last_trained'] === null)) === 12);

echo "\n$checks controlli, $fails falliti\n";
exit($fails > 0 ? 1 : 0);
