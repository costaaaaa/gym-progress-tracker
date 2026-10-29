<?php
// Serie allenanti per muscolo della settimana di calendario (lun-dom) e il confronto con la
// settimana scorsa, usate da workout_stats/dashboard.php (campo weekly_sets). Zero dipendenze
// DB: prende le righe già lette (date, primary_muscle) e le soglie già calcolate dal chiamante.
require_once __DIR__ . '/muscle_rules.php';

// Bucket a zero per tutti i COUNTED_MUSCLES, nell'ordine del corpo.
function weeklySetsEmptyBucket(): array
{
    return array_fill_keys(COUNTED_MUSCLES, 0);
}

// Divide le righe (ognuna con 'date' Y-m-d H:i:s e 'primary_muscle') in tre figure, dato il
// lunedì di questa settimana (00:00) e l'istante attuale:
// - week: serie di questa settimana (da lunedì a ora) per muscolo
// - previous_to_date: serie della settimana scorsa da lunedì (00:00) fino allo stesso istante di
//   una settimana fa ($now - 7 giorni), per muscolo
// - previous_total: totale della settimana scorsa intera (lunedì 00:00 - domenica 23:59:59), solo
//   come riferimento, non per muscolo
// Le righe non sono filtrate a monte (va bene se includono anche righe più vecchie della settimana
// scorsa: vengono ignorate); muscleCountedOf scarta ciò che non conta (NULL primary_muscle ecc.).
function weeklySetsBuckets(array $rows, DateTimeInterface $monday, DateTimeInterface $now): array
{
    $previousMonday = (clone $monday)->modify('-7 days');
    $nowLastWeek = (clone $now)->modify('-7 days');

    $week = weeklySetsEmptyBucket();
    $previousToDate = weeklySetsEmptyBucket();
    $previousTotal = 0;

    foreach ($rows as $row) {
        $muscle = muscleCountedOf($row['primary_muscle'] ?? null);
        if ($muscle === null) continue;

        // `date` è l'ora locale del luogo dell'allenamento (#55): si confronta come orologio con la
        // settimana di chi guarda, quindi si legge nello stesso fuso di $monday
        $date = new DateTime($row['date'], $monday->getTimezone());

        if ($date >= $monday) {
            $week[$muscle]++;
        } elseif ($date >= $previousMonday) {
            $previousTotal++;
            if ($date < $nowLastWeek) {
                $previousToDate[$muscle]++;
            }
        }
    }

    return ['week' => $week, 'previous_to_date' => $previousToDate, 'previous_total' => $previousTotal];
}
