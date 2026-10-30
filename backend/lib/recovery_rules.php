<?php
// Recupero muscolare: per ogni muscolo, quanto manca prima di poterlo riallenare. Usata da
// workout_stats/dashboard.php (campo recovery). Zero dipendenze DB: prende le serie già lette e
// il profilo dell'utente, e restituisce lo stato di ogni muscolo.
require_once __DIR__ . '/muscle_rules.php';
require_once __DIR__ . '/gamification_rules.php';

// Ore di recupero di base per muscolo e livello (amatoriale, intermedio, avanzato), prima dei
// fattori di volume, età e sesso. L'ordine è quello della risposta di dashboard.php.
const RECOVERY_BASE_HOURS = [
    'bicipiti'     => ['amatoriale' => 54, 'intermedio' => 48, 'avanzato' => 42],
    'tricipiti'    => ['amatoriale' => 54, 'intermedio' => 48, 'avanzato' => 42],
    'petto'        => ['amatoriale' => 66, 'intermedio' => 60, 'avanzato' => 54],
    'schiena'      => ['amatoriale' => 66, 'intermedio' => 60, 'avanzato' => 54],
    'spalle'       => ['amatoriale' => 54, 'intermedio' => 48, 'avanzato' => 42],
    'quadricipiti' => ['amatoriale' => 84, 'intermedio' => 72, 'avanzato' => 66],
    'femorali'     => ['amatoriale' => 84, 'intermedio' => 72, 'avanzato' => 66],
    'glutei'       => ['amatoriale' => 84, 'intermedio' => 72, 'avanzato' => 66],
    'adduttori'    => ['amatoriale' => 54, 'intermedio' => 48, 'avanzato' => 42],
    'abduttori'    => ['amatoriale' => 54, 'intermedio' => 48, 'avanzato' => 42],
    'polpacci'     => ['amatoriale' => 42, 'intermedio' => 36, 'avanzato' => 30],
    'addome'       => ['amatoriale' => 36, 'intermedio' => 30, 'avanzato' => 24],
];

// Riferimento di un esercizio nella sessione $historyId: le ultime 2 sessioni precedenti con
// quell'esercizio, non oltre 30 giorni prima. Con meno di 2 sessioni torna null. Altrimenti torna
// 'ref_1rm' (massimo 1RM stimato sulle serie con peso) e 'ref_bodyweight_reps' (massimo di
// ripetizioni sulle serie a peso 0) di quelle 2 sessioni.
function exerciseReference(array $rows, array $sessions, $historyId, $exerciseId): ?array
{
    $started = $sessions[$historyId]['started_at'];
    $oldest = $started->modify('-30 days');
    $previous = [];
    foreach ($sessions as $candidate) {
        if (!isset($candidate['exercises'][$exerciseId])) continue;
        if ($candidate['started_at'] < $started && $candidate['started_at'] >= $oldest) $previous[] = $candidate;
    }
    usort($previous, fn($a, $b) => $a['started_at'] <=> $b['started_at']);
    $previous = array_slice($previous, -2);
    if (count($previous) < 2) return null;

    $reference = ['ref_1rm' => 0.0, 'ref_bodyweight_reps' => 0];
    foreach ($previous as $candidate) {
        foreach ($candidate['rows'] as $j) {
            if ($rows[$j]['exercise_id'] != $exerciseId) continue;
            $weight = (float) $rows[$j]['weight'];
            $reps = parseReps($rows[$j]['reps']);
            if ($weight > 0) $reference['ref_1rm'] = max($reference['ref_1rm'], estimateOneRepMax($weight, $reps));
            else $reference['ref_bodyweight_reps'] = max($reference['ref_bodyweight_reps'], $reps);
        }
    }
    return $reference;
}

// Massimo da fresco di ogni serie allenante, in ripetizioni: [indice della riga => massimo, o null
// se la serie non ha stima]. Il riferimento (exerciseReference) si calcola una volta per coppia
// sessione-esercizio.
function freshMaxReps(array $rows, array $sessions): array
{
    $fresh = [];
    $references = [];
    foreach ($sessions as $historyId => $session) {
        foreach ($session['rows'] as $i) {
            $row = $rows[$i];
            $fresh[$i] = null;

            $key = $historyId . ':' . $row['exercise_id'];
            if (!array_key_exists($key, $references)) {
                $references[$key] = exerciseReference($rows, $sessions, $historyId, $row['exercise_id']);
            }
            $reference = $references[$key];
            if ($reference === null) continue;

            $weight = (float) $row['weight'];
            // Epley invertito: estimateOneRepMax = peso × (1 + rip / 30), quindi le ripetizioni
            // possibili con $weight sono 30 × (1RM / peso − 1); negative se il peso supera il riferimento
            if ($weight > 0 && $reference['ref_1rm'] > 0) $fresh[$i] = 30 * ($reference['ref_1rm'] / $weight - 1);
            else if ($weight == 0 && $reference['ref_bodyweight_reps'] > 0) $fresh[$i] = $reference['ref_bodyweight_reps'];
        }
    }
    return $fresh;
}

// Di quanto una serie dura (RIR ≤ 1) o media (RIR ≤ 3) abbassa il massimo da fresco delle successive.
// $gap: secondi fino alla serie successiva dello stesso ambito; null se non c'è o la sessione non ha l'orario.
function fatigueDrop(float $rir, ?int $gap): float
{
    $hard = $rir <= 1;
    if ($gap === null) return $hard ? 0.30 : 0.15;
    if ($gap < 90) return $hard ? 0.40 : 0.20;
    if ($gap <= 270) return $hard ? 0.30 : 0.15;
    return $hard ? 0.15 : 0.08;
}

// RIR stimato di ogni serie allenante: [indice della riga => RIR 0-10, o null se la serie non ha
// stima]. Dentro l'ambito della stanchezza le serie si leggono in ordine e ogni serie dura o media
// abbassa il massimo da fresco di quelle dopo. Con l'orario (seconds_from_start su tutte le serie
// della sessione) l'ambito è il muscolo e l'ordine è quello dell'orario. Limite noto: una sessione
// senza orario (vecchia, manuale) non ha stanchezza tra esercizi diversi: l'ambito è l'esercizio e
// l'ordine è quello di salvataggio.
function estimatedRirs(array $rows): array
{
    $sessions = [];
    foreach ($rows as $i => $row) {
        $sessions[$row['history_id']]['started_at'] = $row['started_at'];
        $sessions[$row['history_id']]['rows'][] = $i;
        $sessions[$row['history_id']]['exercises'][$row['exercise_id']] = true;
    }
    $fresh = freshMaxReps($rows, $sessions);

    $rirs = [];
    foreach ($sessions as $session) {
        $timed = true;
        foreach ($session['rows'] as $i) {
            if ($rows[$i]['seconds_from_start'] === null) $timed = false;
        }

        $scopes = [];
        foreach ($session['rows'] as $i) {
            $key = $timed ? (muscleCountedOf($rows[$i]['primary_muscle']) ?? '') : $rows[$i]['exercise_id'];
            $scopes[$key][] = $i;
        }
        foreach ($scopes as $scope) {
            usort($scope, fn($a, $b) => $timed
                ? [$rows[$a]['seconds_from_start'], $rows[$a]['set_id']] <=> [$rows[$b]['seconds_from_start'], $rows[$b]['set_id']]
                : $rows[$a]['set_id'] <=> $rows[$b]['set_id']);
            $multiplier = 1.0;
            foreach ($scope as $position => $i) {
                $rirs[$i] = null;
                if ($fresh[$i] === null) continue;
                $rir = min(10, max(0, $fresh[$i] * $multiplier - parseReps($rows[$i]['reps'])));
                $rirs[$i] = $rir;
                if ($rir > 3) continue;
                $next = $scope[$position + 1] ?? null;
                $gap = ($timed && $next !== null) ? (int) $rows[$next]['seconds_from_start'] - (int) $rows[$i]['seconds_from_start'] : null;
                $multiplier *= 1 - fatigueDrop($rir, $gap);
            }
        }
    }
    return $rirs;
}

// Fattore di vicinanza al cedimento di un muscolo in una sessione, dai RIR stimati delle sue serie:
// metà o più serie dure (RIR ≤ 1) allungano il recupero, serie tutte facili (RIR ≥ 4) lo accorciano.
function failureFactor(array $rirs): float
{
    if (!$rirs) return 1.0;
    $hard = count(array_filter($rirs, fn($rir) => $rir <= 1));
    if ($hard / count($rirs) >= 0.5) return 1.15;
    if (min($rirs) >= 4) return 0.90;
    return 1.0;
}

// $rows: una riga per serie allenante, con 'history_id' (la sessione), 'date' (come in
// gym_workout_history.date, chiave della sessione di recupero), 'started_at' (DateTimeImmutable:
// l'istante di inizio nel fuso dell'allenamento), 'set_id', 'exercise_id', 'primary_muscle',
// 'weight', 'reps' (stringa, come nel database) e 'seconds_from_start' (int|null). $profile:
// 'level' (amatoriale, intermedio, avanzato), 'age' e 'gender'.
// Ritorna, per ogni muscolo, percent, status, last_trained e (se allenato) ready_at.
function recoveryStatus(array $rows, array $profile, DateTimeInterface $now): array
{
    $rirs = estimatedRirs($rows);

    // Al recupero partecipano solo le serie degli ultimi 10 giorni; le più vecchie servono come
    // riferimento per il RIR.
    $since = (clone $now)->modify('-10 days')->format('Y-m-d H:i:s');
    // Raggruppa per muscolo e sessione (gli esercizi senza muscolo principale non contano:
    // muscleCountedOf torna null)
    $sessionsByMuscle = [];
    foreach ($rows as $i => $row) {
        $muscle = muscleCountedOf($row['primary_muscle']);
        if ($muscle === null || !isset(RECOVERY_BASE_HOURS[$muscle])) continue;
        if ($row['date'] < $since) continue;

        $date = $row['date'];
        if (!isset($sessionsByMuscle[$muscle][$date])) {
            $sessionsByMuscle[$muscle][$date] = ['started_at' => $row['started_at'], 'sets_count' => 0, 'rirs' => []];
        }
        $sessionsByMuscle[$muscle][$date]['sets_count']++;
        if ($rirs[$i] !== null) $sessionsByMuscle[$muscle][$date]['rirs'][] = $rirs[$i];
    }

    $age = $profile['age'] ?? 25;
    if ($age >= 50) $fAge = 1.35;
    else if ($age >= 40) $fAge = 1.20;
    else if ($age >= 30) $fAge = 1.10;
    else $fAge = 1.0;
    // M = 1.0, F = 0.90, altro/non indicato = valore intermedio
    $gender = $profile['gender'] ?? null;
    $fGender = ($gender === 'F') ? 0.90 : (($gender === 'O') ? 0.95 : 1.0);

    $result = [];
    foreach (RECOVERY_BASE_HOURS as $muscle => $baseHours) {
        if (!isset($sessionsByMuscle[$muscle])) {
            $result[$muscle] = ['percent' => 100, 'status' => 'PRONTO', 'last_trained' => null];
            continue;
        }

        $sessions = $sessionsByMuscle[$muscle];
        ksort($sessions);

        $readyAt = null;
        $lastTrained = null;
        $lastTrainedAt = null;
        foreach ($sessions as $date => $session) {
            $lastTrained = $date;
            $lastTrainedAt = $session['started_at'];
            $fVolume = 1.0;
            if ($session['sets_count'] >= 6) $fVolume = 1.30;
            else if ($session['sets_count'] >= 4) $fVolume = 1.15;
            $fFailure = failureFactor($session['rirs']);
            $recoveryHours = $baseHours[$profile['level']] * $fVolume * $fFailure * $fAge * $fGender;
            $recoveryHours = round($recoveryHours / 6) * 6;

            // Riallenato prima di essere pronto: metà delle ore che mancavano si aggiunge
            if ($readyAt && $lastTrainedAt < $readyAt) {
                $residualHours = ($readyAt->getTimestamp() - $lastTrainedAt->getTimestamp()) / 3600;
                $recoveryHours += $residualHours * 0.50;
            }
            $readyAt = $lastTrainedAt->modify('+' . round($recoveryHours) . ' hours');
        }

        if ($now >= $readyAt) {
            $percent = 100;
            $label = 'PRONTO';
        } else {
            $totalHours = ($readyAt->getTimestamp() - $lastTrainedAt->getTimestamp()) / 3600;
            $passedHours = ($now->getTimestamp() - $lastTrainedAt->getTimestamp()) / 3600;
            $percent = $totalHours > 0 ? min(99, round(($passedHours / $totalHours) * 100)) : 100;
            $label = $percent < 50 ? 'AFFATICATO' : 'IN RECUPERO';
        }

        $result[$muscle] = [
            'percent' => $percent,
            'status' => $label,
            'last_trained' => $lastTrained,
            'ready_at' => $readyAt->setTimezone($now->getTimezone())->format('c'),
        ];
    }
    return $result;
}
