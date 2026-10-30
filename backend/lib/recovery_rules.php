<?php
// Recupero muscolare: per ogni muscolo, quanto manca prima di poterlo riallenare. Usata da
// workout_stats/dashboard.php (campo recovery). Zero dipendenze DB: prende le serie già lette e
// il profilo dell'utente, e restituisce lo stato di ogni muscolo.
require_once __DIR__ . '/muscle_rules.php';

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

// $rows: una riga per serie allenante, con 'date' (come in gym_workout_history.date, chiave della
// sessione), 'started_at' (DateTimeImmutable: l'istante di inizio nel fuso dell'allenamento) e
// 'primary_muscle'. $profile: 'level' (amatoriale, intermedio, avanzato), 'age' e 'gender'.
// Ritorna, per ogni muscolo, percent, status, last_trained e (se allenato) ready_at.
function recoveryStatus(array $rows, array $profile, DateTimeInterface $now): array
{
    // Raggruppa per muscolo e sessione (gli esercizi senza muscolo principale non contano:
    // muscleCountedOf torna null)
    $sessionsByMuscle = [];
    foreach ($rows as $row) {
        $muscle = muscleCountedOf($row['primary_muscle']);
        if ($muscle === null || !isset(RECOVERY_BASE_HOURS[$muscle])) continue;

        $date = $row['date'];
        if (!isset($sessionsByMuscle[$muscle][$date])) {
            $sessionsByMuscle[$muscle][$date] = ['started_at' => $row['started_at'], 'sets_count' => 0];
        }
        $sessionsByMuscle[$muscle][$date]['sets_count']++;
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
            $recoveryHours = $baseHours[$profile['level']] * $fVolume * $fAge * $fGender;
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
