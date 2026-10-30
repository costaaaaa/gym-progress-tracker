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
// nel fuso dell'allenamento e il muscolo principale dell'esercizio. $extra sovrascrive gli altri
// campi: history_id (default: uno per data e fuso), set_id (progressivo), exercise_id, weight, reps
// e seconds_from_start.
function setRow($date, $muscle = 'petto', $zone = 'Europe/Rome', $extra = [])
{
    static $nextSetId = 0;
    return $extra + [
        'date' => $date,
        'started_at' => new DateTimeImmutable($date, new DateTimeZone($zone)),
        'primary_muscle' => $muscle,
        'history_id' => crc32($date . $zone),
        'set_id' => ++$nextSetId,
        'exercise_id' => 1,
        'weight' => 0,
        'reps' => '8',
        'seconds_from_start' => null,
    ];
}

// Una sessione di $n serie uguali (peso, ripetizioni) dello stesso esercizio.
function sessionRows($date, $n, $weight, $reps, $extra = [], $muscle = 'petto')
{
    $rows = [];
    for ($i = 0; $i < $n; $i++) $rows[] = setRow($date, $muscle, 'Europe/Rome', ['weight' => $weight, 'reps' => (string) $reps] + $extra);
    return $rows;
}

// Una serie di petto della sessione di oggi (29/10 alle 09:00, Roma); $extra come in setRow.
function todayRow($extra = [])
{
    return setRow('2026-10-29 09:00:00', 'petto', 'Europe/Rome', $extra);
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

echo "\nCedimento: riferimento di 2 sessioni nei 30 giorni, oggi una serie al cedimento\n";
// Riferimento: 80 kg × 8 → 1RM stimato 80 × (1 + 8/30) = 101.3. Oggi 80 × 8: massimo da fresco
// 30 × (101.3 / 80 − 1) = 7.99 ripetizioni, RIR = 7.99 − 8 → 0 (dura). Con la stanchezza tra le
// serie (senza orario: −30% dopo ogni serie dura) anche le altre due sono dure: quota 100% → ×1.15.
// 60 h × 1.15 = 69 h, arrotondate a 6 h: 72 h. Dal 29/10 09:00 a domenica 01/11 09:00.
$rows = array_merge(sessionRows('2026-10-12 09:00:00', 3, 80, 8), sessionRows('2026-10-18 09:00:00', 3, 80, 8), sessionRows('2026-10-29 09:00:00', 3, 80, 8));
$r = recoveryStatus($rows, profile('intermedio', 25, 'M'), $now);
check('petto al cedimento: pronto 01/11 alle 09:00 (×1.15)', $r['petto']['ready_at'] === '2026-11-01T09:00:00+01:00');

echo "\nCedimento: senza 2 sessioni precedenti il calcolo resta quello di prima\n";
// Come l'esempio della sessione singola: 60 h, pronto sabato 31/10 alle 21:00. Una sola sessione
// precedente non basta come riferimento, e la sessione corrente non fa da riferimento a se stessa.
$r = recoveryStatus(sessionRows('2026-10-29 09:00:00', 3, 80, 8), profile('intermedio', 25, 'M'), $now);
check('nessuna sessione precedente: pronto 31/10 alle 21:00', $r['petto']['ready_at'] === '2026-10-31T21:00:00+01:00');
$rows = array_merge(sessionRows('2026-10-18 09:00:00', 3, 80, 8), sessionRows('2026-10-29 09:00:00', 3, 80, 8));
$r = recoveryStatus($rows, profile('intermedio', 25, 'M'), $now);
check('una sola sessione precedente: pronto 31/10 alle 21:00', $r['petto']['ready_at'] === '2026-10-31T21:00:00+01:00');

echo "\nCedimento: quali sessioni fanno da riferimento\n";
// Il riferimento sono le ultime 2 sessioni (80 × 8 → 1RM 101.3): oggi 80 × 8 è al cedimento, ×1.15 → 72 h,
// pronto 01/11 alle 09:00. La terza, più vecchia (100 × 8 → 1RM 126.7), non conta: se contasse il massimo
// da fresco sarebbe 30 × (126.7 / 80 − 1) = 17.5 ripetizioni, RIR 9.5, serie facili e nessun ×1.15.
$rows = array_merge(sessionRows('2026-10-05 09:00:00', 3, 100, 8), sessionRows('2026-10-12 09:00:00', 3, 80, 8), sessionRows('2026-10-18 09:00:00', 3, 80, 8), sessionRows('2026-10-29 09:00:00', 3, 80, 8));
$r = recoveryStatus($rows, profile('intermedio', 25, 'M'), $now);
check('la terza sessione più vecchia è ignorata: ×1.15, pronto 01/11 alle 09:00', $r['petto']['ready_at'] === '2026-11-01T09:00:00+01:00');
// Confine dei 30 giorni dalla sessione di oggi (29/10 09:00): il 29/09 alle 09:00 è ancora dentro,
// alle 08:59 è fuori e resta una sola sessione precedente (nessun riferimento, 60 h).
$rows = array_merge(sessionRows('2026-09-29 09:00:00', 3, 80, 8), sessionRows('2026-10-18 09:00:00', 3, 80, 8), sessionRows('2026-10-29 09:00:00', 3, 80, 8));
$r = recoveryStatus($rows, profile('intermedio', 25, 'M'), $now);
check('esattamente 30 giorni prima: conta come riferimento (×1.15)', $r['petto']['ready_at'] === '2026-11-01T09:00:00+01:00');
$rows = array_merge(sessionRows('2026-09-29 08:59:00', 3, 80, 8), sessionRows('2026-10-18 09:00:00', 3, 80, 8), sessionRows('2026-10-29 09:00:00', 3, 80, 8));
$r = recoveryStatus($rows, profile('intermedio', 25, 'M'), $now);
check('un minuto oltre i 30 giorni: non conta (60 h)', $r['petto']['ready_at'] === '2026-10-31T21:00:00+01:00');
// Record: il riferimento è 60 × 8 → 1RM 76.0. Oggi 80 × 5 supera il riferimento: massimo da fresco
// 30 × (76 / 80 − 1) = −1.5, RIR 0 (non negativo), dura: ×1.15 → 72 h.
$rows = array_merge(sessionRows('2026-10-12 09:00:00', 3, 60, 8), sessionRows('2026-10-18 09:00:00', 3, 60, 8), sessionRows('2026-10-29 09:00:00', 3, 80, 5));
$r = recoveryStatus($rows, profile('intermedio', 25, 'M'), $now);
check('record (peso oltre il riferimento): RIR 0, ×1.15, pronto 01/11 alle 09:00', $r['petto']['ready_at'] === '2026-11-01T09:00:00+01:00');

echo "\nCedimento: corpo libero\n";
// Riferimento a peso 0: il massimo di ripetizioni delle ultime 2 sessioni (12 e 10 → 12). Oggi 3 serie
// da 12: massimo da fresco 12, RIR 0, dure → ×1.15 → 72 h, pronto 01/11 alle 09:00.
$rows = array_merge(sessionRows('2026-10-12 09:00:00', 3, 0, 12), sessionRows('2026-10-18 09:00:00', 3, 0, 10), sessionRows('2026-10-29 09:00:00', 3, 0, 12));
$r = recoveryStatus($rows, profile('intermedio', 25, 'M'), $now);
check('corpo libero con riferimento: ×1.15, pronto 01/11 alle 09:00', $r['petto']['ready_at'] === '2026-11-01T09:00:00+01:00');
// Senza 2 sessioni di riferimento il corpo libero non ha stima: 60 h.
$rows = array_merge(sessionRows('2026-10-18 09:00:00', 3, 0, 12), sessionRows('2026-10-29 09:00:00', 3, 0, 12));
$r = recoveryStatus($rows, profile('intermedio', 25, 'M'), $now);
check('corpo libero senza riferimento: pronto 31/10 alle 21:00', $r['petto']['ready_at'] === '2026-10-31T21:00:00+01:00');

echo "\nCedimento: stanchezza tra le serie (sessione senza orario)\n";
// Riferimento 80 × 8 (1RM 101.3, massimo da fresco a 80 kg: 7.99). Oggi 80 × 8, 80 × 6, 80 × 5:
// 1ª serie: 7.99 − 8 → RIR 0, dura: il massimo scende del 30% (moltiplicatore 0.70).
// 2ª serie: 7.99 × 0.70 = 5.59 − 6 → RIR 0, dura: moltiplicatore 0.49.
// 3ª serie: 7.99 × 0.49 = 3.91 − 5 → RIR 0, dura. Senza stanchezza la 2ª sarebbe RIR 1.99 e la 3ª 2.99
// (1 serie dura su 3, ×1.0, 60 h); con la stanchezza 3 dure su 3: ×1.15 → 72 h, pronto 01/11 alle 09:00.
$ref = array_merge(sessionRows('2026-10-12 09:00:00', 3, 80, 8), sessionRows('2026-10-18 09:00:00', 3, 80, 8));
$today = [todayRow(['weight' => 80, 'reps' => '8']), todayRow(['weight' => 80, 'reps' => '6']), todayRow(['weight' => 80, 'reps' => '5'])];
$r = recoveryStatus(array_merge($ref, $today), profile('intermedio', 25, 'M'), $now);
check('80×8 / 80×6 / 80×5: tutte dure, ×1.15, pronto 01/11 alle 09:00', $r['petto']['ready_at'] === '2026-11-01T09:00:00+01:00');

echo "\nCedimento: top set + back-off (senza orario)\n";
// Riferimento 100 × 10 → 1RM 133.3: massimo da fresco 9.99 a 100 kg e 19.99 a 80 kg.
// 100 × 9: RIR 0.99, dura (×0.70). 100 × 8: 9.99 × 0.70 = 6.99 − 8 → RIR 0, dura (×0.49).
// 80 × 14: 19.99 × 0.49 = 9.80 − 14 → RIR 0, dura. Senza stanchezza solo la 1ª sarebbe dura
// (RIR 1.99 e 5.99 per le altre): 1 su 3, ×1.0. Con la stanchezza 3 su 3: ×1.15 → 72 h, pronto 01/11 alle 09:00.
$ref = array_merge(sessionRows('2026-10-12 09:00:00', 3, 100, 10), sessionRows('2026-10-18 09:00:00', 3, 100, 10));
$today = [todayRow(['weight' => 100, 'reps' => '9']), todayRow(['weight' => 100, 'reps' => '8']), todayRow(['weight' => 80, 'reps' => '14'])];
$r = recoveryStatus(array_merge($ref, $today), profile('intermedio', 25, 'M'), $now);
check('100×9 / 100×8 / 80×14: tutte dure, ×1.15, pronto 01/11 alle 09:00', $r['petto']['ready_at'] === '2026-11-01T09:00:00+01:00');

echo "\nCedimento: stesso esercizio due volte nella sessione, in ordine di set_id\n";
// Esercizio 1 (80 × 8 di riferimento), serie 80 × 8 (set_id 1), un altro esercizio senza riferimento
// (set_id 2), poi di nuovo l'esercizio 1 con 80 × 5 e 80 × 5 (set_id 3 e 4). Le righe arrivano in ordine
// inverso, l'ordine che conta è quello di set_id e le due comparse sono un solo ambito:
// 80 × 8: RIR 0, dura (×0.70). 80 × 5: 7.99 × 0.70 = 5.59 − 5 = 0.59, dura (×0.49). 80 × 5: 3.91 − 5 → RIR 0, dura.
// 3 dure su 3: ×1.15. Con 4 serie anche il volume è ×1.15: 60 × 1.15 × 1.15 = 79.35 h, arrotondate a 78 h,
// pronto 01/11 alle 15:00. In ordine d'arrivo o come due blocchi separati sarebbero 1 dura su 3 (×1.0):
// 60 × 1.15 = 69 h → 72 h, pronto 01/11 alle 09:00.
$ref = array_merge(sessionRows('2026-10-12 09:00:00', 3, 80, 8), sessionRows('2026-10-18 09:00:00', 3, 80, 8));
$today = [
    todayRow(['set_id' => 4, 'weight' => 80, 'reps' => '5']),
    todayRow(['set_id' => 3, 'weight' => 80, 'reps' => '5']),
    todayRow(['set_id' => 2, 'exercise_id' => 2, 'weight' => 0, 'reps' => '10']),
    todayRow(['set_id' => 1, 'weight' => 80, 'reps' => '8']),
];
$r = recoveryStatus(array_merge($ref, $today), profile('intermedio', 25, 'M'), $now);
check('esercizio ripetuto in scheda: un solo ambito in ordine di set_id (×1.15)', $r['petto']['ready_at'] === '2026-11-01T15:00:00+01:00');

echo "\nCedimento: stanchezza con orario, confini del gap\n";
// Riferimento 80 × 8 (1RM 101.3, massimo da fresco a 80 kg: 7.9875). Sessione di 4 serie con orario:
// 80 × 8 a 0 s (RIR 0, dura), 80 × R al secondo $gap, poi due serie leggere 40 × 1 (massimo da fresco
// oltre 10: RIR 10, facili, non cambiano il moltiplicatore). Il calo dopo la 1ª serie dura dipende dal gap
// fino alla 2ª: sotto 90 s 40%, da 90 a 270 s 30%, oltre 270 s 15%. Con 4 serie il volume vale ×1.15.
// La 2ª serie è dura se 7.9875 × (1 − calo) − R ≤ 1:
//   calo 40%: 4.79 − 4 = 0.79 (dura)    calo 30%: 5.59 − 4 = 1.59 (media)
//   calo 30%: 5.59 − 5 = 0.59 (dura)    calo 15%: 6.79 − 5 = 1.79 (media)
// Con la 2ª dura: 2 serie dure su 4 = 50% → ×1.15 anche per il volume: 60 × 1.15 × 1.15 = 79.35 h →
// 78 h, pronto 01/11 alle 15:00. Con la 2ª media: 1 su 4, ×1.0: 60 × 1.15 = 69 h → 72 h, 01/11 alle 09:00.
function timedSession($gap, $reps2)
{
    $secs = [0, $gap, $gap + 1000, $gap + 2000];
    $sets = [[80, 8], [80, $reps2], [40, 1], [40, 1]];
    $rows = [];
    foreach ($sets as $k => [$weight, $reps]) {
        $rows[] = todayRow(['weight' => $weight, 'reps' => (string) $reps, 'seconds_from_start' => $secs[$k]]);
    }
    return array_merge(sessionRows('2026-10-12 09:00:00', 3, 80, 8), sessionRows('2026-10-18 09:00:00', 3, 80, 8), $rows);
}
$p = profile('intermedio', 25, 'M');
$r = recoveryStatus(timedSession(89, 4), $p, $now);
check('gap 89 s (calo 40%): la 2ª serie è dura, pronto 01/11 alle 15:00', $r['petto']['ready_at'] === '2026-11-01T15:00:00+01:00');

$r = recoveryStatus(timedSession(90, 4), $p, $now);
check('gap 90 s (calo 30%): la 2ª serie è media, pronto 01/11 alle 09:00', $r['petto']['ready_at'] === '2026-11-01T09:00:00+01:00');
$r = recoveryStatus(timedSession(270, 5), $p, $now);
check('gap 270 s (calo 30%): la 2ª serie è dura, pronto 01/11 alle 15:00', $r['petto']['ready_at'] === '2026-11-01T15:00:00+01:00');
$r = recoveryStatus(timedSession(271, 5), $p, $now);
check('gap 271 s (calo 15%): la 2ª serie è media, pronto 01/11 alle 09:00', $r['petto']['ready_at'] === '2026-11-01T09:00:00+01:00');

echo "\nCedimento: ambito muscolo con l'orario, esercizio senza\n";
// Panca (esercizio 1, riferimento 80 × 8) e croci (esercizio 3, riferimento 20 × 10 → 1RM 26.7, massimo
// da fresco a 20 kg: 30 × (26.7 / 20 − 1) = 10.05). Con l'orario l'ambito è il muscolo: panca 80 × 8 a 0 s
// (dura, gap 100 s fino alle croci: calo 30%, moltiplicatore 0.70), croci 20 × 7 a 100 s:
// 10.05 × 0.70 = 7.04 − 7 = 0.04, dura. Poi due serie leggere di panca (40 × 1, facili).
// 2 dure su 4 = 50% → ×1.15, e 4 serie ×1.15: 60 × 1.15 × 1.15 = 79.35 h → 78 h, pronto 01/11 alle 15:00.
// Senza stanchezza tra gli esercizi le croci sarebbero 10.05 − 7 = 3.05, facili: 1 dura su 4, ×1.0 → 72 h.
function benchThenFlyes($flyesSeconds)
{
    $rows = [
        todayRow(['exercise_id' => 1, 'weight' => 80, 'reps' => '8', 'seconds_from_start' => 0]),
        todayRow(['exercise_id' => 3, 'weight' => 20, 'reps' => '7', 'seconds_from_start' => $flyesSeconds]),
        todayRow(['exercise_id' => 1, 'weight' => 40, 'reps' => '1', 'seconds_from_start' => 1000]),
        todayRow(['exercise_id' => 1, 'weight' => 40, 'reps' => '1', 'seconds_from_start' => 1100]),
    ];
    return array_merge(
        sessionRows('2026-10-12 09:00:00', 3, 80, 8), sessionRows('2026-10-18 09:00:00', 3, 80, 8),
        sessionRows('2026-10-12 09:00:00', 3, 20, 10, ['exercise_id' => 3]), sessionRows('2026-10-18 09:00:00', 3, 20, 10, ['exercise_id' => 3]),
        $rows
    );
}
$r = recoveryStatus(benchThenFlyes(100), $p, $now);
check('con l\'orario, panca e poi croci: le croci partono stanche (×1.15, 78 h)', $r['petto']['ready_at'] === '2026-11-01T15:00:00+01:00');
$rows = benchThenFlyes(100);
$rows[count($rows) - 1]['seconds_from_start'] = null;
$r = recoveryStatus($rows, $p, $now);
check('una sola serie senza orario: ambito l\'esercizio, le croci non partono stanche (72 h)', $r['petto']['ready_at'] === '2026-11-01T09:00:00+01:00');

echo "\nCedimento: il calo dopo una serie media\n";
// Riferimento 80 × 8 (1RM 101.3, massimo da fresco a 80 kg: 7.9875). La 1ª serie è 80 × 6: RIR
// 7.9875 − 6 = 1.99, media (non dura). Il suo calo dipende dal gap fino alla 2ª serie: 20% sotto
// 90 s, 15% da 90 a 270 s e senza orario, 8% oltre 270 s. La 2ª serie decide il fattore:
// con 2 serie, dura → 1 su 2 = 50% → ×1.15 (72 h, pronto 01/11 alle 09:00); media → nessuna dura e non
// tutte facili → ×1.0 (60 h, pronto 31/10 alle 21:00). Le serie sono 2, il volume vale ×1.0.
function mediumThen($weight2, $reps2, $secondsOfSecond)
{
    $secs = [$secondsOfSecond === null ? null : 0, $secondsOfSecond];
    $rows = [todayRow(['weight' => 80, 'reps' => '6', 'seconds_from_start' => $secs[0]]), todayRow(['weight' => $weight2, 'reps' => (string) $reps2, 'seconds_from_start' => $secs[1]])];
    return array_merge(sessionRows('2026-10-12 09:00:00', 3, 80, 8), sessionRows('2026-10-18 09:00:00', 3, 80, 8), $rows);
}
// Senza orario (calo 15%): 2ª serie 80 × 6: 7.9875 × 0.85 = 6.79 − 6 = 0.79, dura. Con un calo dell'8%
// sarebbe 7.35 − 6 = 1.35, media (60 h).
$r = recoveryStatus(mediumThen(80, 6, null), $p, $now);
check('senza orario, dopo una media (calo 15%): la 2ª serie è dura, ×1.15, pronto 01/11 alle 09:00', $r['petto']['ready_at'] === '2026-11-01T09:00:00+01:00');
// Gap 60 s (calo 20%): 2ª serie 70 × 10, massimo da fresco 30 × (101.3 / 70 − 1) = 13.41: 13.41 × 0.80 = 10.73
// − 10 = 0.73, dura. Con un calo del 15% sarebbe 11.40 − 10 = 1.40, media (60 h).
$r = recoveryStatus(mediumThen(70, 10, 60), $p, $now);
check('gap 60 s dopo una media (calo 20%): la 2ª serie è dura, ×1.15, pronto 01/11 alle 09:00', $r['petto']['ready_at'] === '2026-11-01T09:00:00+01:00');
// Gap 180 s (calo 15%): come senza orario, 80 × 6 → RIR 0.79, dura. Con un calo dell'8% sarebbe media.
$r = recoveryStatus(mediumThen(80, 6, 180), $p, $now);
check('gap 180 s dopo una media (calo 15%): la 2ª serie è dura, ×1.15, pronto 01/11 alle 09:00', $r['petto']['ready_at'] === '2026-11-01T09:00:00+01:00');
// Gap 400 s (calo 8%): 7.9875 × 0.92 = 7.35 − 6 = 1.35, media: nessuna dura, ×1.0. Con un calo del 15%
// sarebbe dura (0.79, ×1.15).
$r = recoveryStatus(mediumThen(80, 6, 400), $p, $now);
check('gap 400 s dopo una media (calo 8%): la 2ª serie resta media, ×1.0, pronto 31/10 alle 21:00', $r['petto']['ready_at'] === '2026-10-31T21:00:00+01:00');

echo "\nCedimento: fasce del fattore\n";
// Riferimento 80 × 8 (1RM 101.3). Oggi 3 × 60 kg × 5: massimo da fresco 30 × (101.3 / 60 − 1) = 20.65,
// RIR 15.65 → 10 (tetto), tutte facili (RIR ≥ 4) e nessuna stanchezza: ×0.90 → 54 h, pronto 31/10 alle 15:00.
$ref = array_merge(sessionRows('2026-10-12 09:00:00', 3, 80, 8), sessionRows('2026-10-18 09:00:00', 3, 80, 8));
$r = recoveryStatus(array_merge($ref, sessionRows('2026-10-29 09:00:00', 3, 60, 5)), $p, $now);
check('tutte le serie facili (RIR ≥ 4): ×0.90, pronto 31/10 alle 15:00', $r['petto']['ready_at'] === '2026-10-31T15:00:00+01:00');

// Una serie facile (60 × 5, RIR 10) e una media (80 × 6: 7.99 − 6 = 1.99, nessuna dura): non sono né
// metà dure né tutte facili → ×1.0. La terza serie, a corpo libero, non ha stima (il riferimento è con peso): 3 serie, volume ×1.0,
// 60 h, pronto 31/10 alle 21:00.
$today = [todayRow(['weight' => 60, 'reps' => '5']), todayRow(['weight' => 80, 'reps' => '6'])];
$r = recoveryStatus(array_merge($ref, $today, sessionRows('2026-10-29 09:00:00', 1, 0, 8, [], 'petto')), $p, $now);
check('serie facili e medie, nessuna dura: ×1.0, pronto 31/10 alle 21:00', $r['petto']['ready_at'] === '2026-10-31T21:00:00+01:00');
// Quota esattamente al 50%: 2 serie con stima, una dura e una facile. Riferimento 80 × 8 (massimo da
// fresco a 80 kg: 7.9875). 80 × 8: RIR 0, dura (moltiplicatore 0.70). 60 × 5: massimo da fresco a 60 kg
// 30 × (101.3 / 60 − 1) = 20.65, × 0.70 = 14.46 − 5 = 9.46, facile. 1 dura su 2 = 50% → ×1.15 (non ×1.0):
// 60 × 1.15 = 69 h, arrotondate a 6 h: 72 h, pronto 01/11 alle 09:00.
$today = [todayRow(['weight' => 80, 'reps' => '8']), todayRow(['weight' => 60, 'reps' => '5'])];
$r = recoveryStatus(array_merge($ref, $today), $p, $now);
check('una dura e una facile (esattamente 50%): ×1.15, pronto 01/11 alle 09:00', $r['petto']['ready_at'] === '2026-11-01T09:00:00+01:00');

// Nessuna serie con stima, anche se un riferimento c'è: non entra nessun fattore (×1.0), come senza
// riferimento. Riferimento solo con peso (80 × 8) e oggi 3 serie a corpo libero (12 ripetizioni): la
// stima a peso 0 chiede un riferimento a peso 0. 60 h, pronto 31/10 alle 21:00.
$r = recoveryStatus(array_merge($ref, sessionRows('2026-10-29 09:00:00', 3, 0, 12)), $p, $now);
check('riferimento con peso, oggi corpo libero: nessuna stima, 60 h, pronto 31/10 alle 21:00', $r['petto']['ready_at'] === '2026-10-31T21:00:00+01:00');
// Il contrario: riferimento a corpo libero (12 ripetizioni) e oggi 3 × 80 kg × 8: la stima con peso
// chiede un riferimento con peso. 60 h, pronto 31/10 alle 21:00 (80 × 8 al cedimento darebbe ×1.15).
$refBodyweight = array_merge(sessionRows('2026-10-12 09:00:00', 3, 0, 12), sessionRows('2026-10-18 09:00:00', 3, 0, 12));
$r = recoveryStatus(array_merge($refBodyweight, sessionRows('2026-10-29 09:00:00', 3, 80, 8)), $p, $now);
check('riferimento a corpo libero, oggi con peso: nessuna stima, 60 h, pronto 31/10 alle 21:00', $r['petto']['ready_at'] === '2026-10-31T21:00:00+01:00');
// Le sessioni oltre i 10 giorni servono solo come riferimento: da sole non fanno recupero.
$r = recoveryStatus($ref, $p, $now);
check('solo sessioni oltre i 10 giorni: tutti i muscoli PRONTO senza last_trained', count(array_filter($r, fn($m) => $m['status'] === 'PRONTO' && $m['last_trained'] === null)) === 12);

echo "\n$checks controlli, $fails falliti\n";
exit($fails > 0 ? 1 : 0);
