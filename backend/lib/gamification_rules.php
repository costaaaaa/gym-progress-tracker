<?php
// Funzioni pure per le regole di gamification (XP, livelli, achievement).
// Zero dipendenze DB: usate da record_workout.php (live) e dal backfill (storico).

// ── Economia XP ──────────────────────────────────────────────────────────────
const XP_SESSION          = 20;  // per sessione completata
const XP_PR_WEIGHT        = 15;  // PR di peso su un esercizio (generale)
const XP_PR_1RM           = 15;  // PR di 1RM stimato (generale)
const XP_STREAK_WEEK      = 30;  // settimana di streak completata
const XP_EXERCISE_SESSION = 10;  // esercizio allenato nella sessione (per-esercizio)
const XP_EXERCISE_PR      = 15;  // PR su quell'esercizio (per-esercizio)

// ── Curva livelli: XP cumulativi per il livello L = 100×(L−1)² ───────────────

function xpForLevel(int $level): int {
    if ($level <= 1) return 0;
    return 100 * ($level - 1) ** 2;
}

function levelForXp(int $xp): int {
    if ($xp <= 0) return 1;
    return (int) floor(sqrt($xp / 100)) + 1;
}

// XP accumulati dentro il livello corrente (per la barra di progressione)
function xpIntoLevel(int $xp): int {
    $lvl = levelForXp($xp);
    return $xp - xpForLevel($lvl);
}

// XP totali necessari per completare il livello corrente (denominatore barra)
function xpForNextLevel(int $xp): int {
    $lvl = levelForXp($xp);
    return xpForLevel($lvl + 1) - xpForLevel($lvl);
}

// ── Rep parsing (mirror di extractReps in workoutMetrics.js) ─────────────────

function parseReps($repsValue): int {
    if ($repsValue === null || $repsValue === '') return 0;

    // Già numerico
    if (is_numeric($repsValue)) return max(0, (int) $repsValue);

    $str = (string) $repsValue;

    // "8-10" → prende il valore massimo
    if (strpos($str, '-') !== false) {
        $parts = explode('-', $str, 2);
        $max = intval(trim($parts[1]));
        if ($max > 0) return $max;
    }

    // Prende il numero più grande trovato nella stringa
    preg_match_all('/\d+/', $str, $matches);
    if (!empty($matches[0])) {
        return (int) max(array_map('intval', $matches[0]));
    }

    return 0;
}

// ── 1RM stimato con formula di Epley: w×(1+reps/30) ─────────────────────────

function estimateOneRepMax(float $weight, int $reps): float {
    if ($weight <= 0 || $reps <= 0) return 0.0;
    return round($weight * (1 + $reps / 30), 1);
}

// ── Achievement ───────────────────────────────────────────────────────────────
// $totals = [
//   'sessions'          => int,   // sessioni totali a vita
//   'lifetime_volume'   => float, // tonnellaggio a vita (kg)
//   'max_weight_ever'   => float, // peso grezzo massimo sollevato in qualunque esercizio
//   'longest_streak'    => int,   // streak massima in settimane
// ]
// Ritorna array di achievement_key che risultano sbloccati dati i totali.
// La chiamante confronta con quelli già salvati e fa INSERT IGNORE solo per i nuovi.

// ── Catalogo achievement (usato da profile.php e dalla risposta di record_workout) ─

function achievementCatalog(): array {
    return [
        ['key' => 'sessions_10',      'label' => 'Prime 10 sessioni',         'category' => 'sessions',  'threshold' => 10],
        ['key' => 'sessions_50',      'label' => '50 sessioni',                'category' => 'sessions',  'threshold' => 50],
        ['key' => 'sessions_100',     'label' => 'Centurione',                 'category' => 'sessions',  'threshold' => 100],
        ['key' => 'sessions_250',     'label' => '250 sessioni',               'category' => 'sessions',  'threshold' => 250],
        ['key' => 'tonnage_auto',     'label' => '1.500 kg sollevati',         'category' => 'tonnage',   'threshold' => 1500],
        ['key' => 'tonnage_elephant', 'label' => '6.000 kg — elefante',        'category' => 'tonnage',   'threshold' => 6000],
        ['key' => 'tonnage_whale',    'label' => '50.000 kg — balena',         'category' => 'tonnage',   'threshold' => 50000],
        ['key' => 'tonnage_bus',      'label' => '100.000 kg — autobus',       'category' => 'tonnage',   'threshold' => 100000],
        ['key' => 'strength_60',      'label' => '60 kg in un esercizio',      'category' => 'strength',  'threshold' => 60],
        ['key' => 'strength_100',     'label' => '100 kg in un esercizio',     'category' => 'strength',  'threshold' => 100],
        ['key' => 'strength_140',     'label' => '140 kg in un esercizio',     'category' => 'strength',  'threshold' => 140],
        ['key' => 'streak_4',         'label' => '4 settimane consecutive',    'category' => 'streak',    'threshold' => 4],
        ['key' => 'streak_8',         'label' => '8 settimane consecutive',    'category' => 'streak',    'threshold' => 8],
        ['key' => 'streak_12',        'label' => '12 settimane consecutive',   'category' => 'streak',    'threshold' => 12],
        ['key' => 'streak_24',        'label' => '24 settimane consecutive',   'category' => 'streak',    'threshold' => 24],
    ];
}

function achievementLabel(string $key): string {
    foreach (achievementCatalog() as $entry) {
        if ($entry['key'] === $key) return $entry['label'];
    }
    return $key;
}

function achievementsForTotals(array $totals): array {
    $keys = [];

    // Sessioni: 10 / 50 / 100 / 250
    $sessions = (int) ($totals['sessions'] ?? 0);
    foreach ([10 => 'sessions_10', 50 => 'sessions_50', 100 => 'sessions_100', 250 => 'sessions_250'] as $threshold => $key) {
        if ($sessions >= $threshold) $keys[] = $key;
    }

    // Tonnellaggio a vita (kg): 1500 / 6000 / 50000 / 100000
    $vol = (float) ($totals['lifetime_volume'] ?? 0);
    foreach ([1500 => 'tonnage_auto', 6000 => 'tonnage_elephant', 50000 => 'tonnage_whale', 100000 => 'tonnage_bus'] as $threshold => $key) {
        if ($vol >= $threshold) $keys[] = $key;
    }

    // Forza: primo 60 / 100 / 140 kg su un singolo esercizio (peso grezzo)
    $maxW = (float) ($totals['max_weight_ever'] ?? 0);
    foreach ([60 => 'strength_60', 100 => 'strength_100', 140 => 'strength_140'] as $threshold => $key) {
        if ($maxW >= $threshold) $keys[] = $key;
    }

    // Costanza (streak): 4 / 8 / 12 / 24 settimane
    $streak = (int) ($totals['longest_streak'] ?? 0);
    foreach ([4 => 'streak_4', 8 => 'streak_8', 12 => 'streak_12', 24 => 'streak_24'] as $threshold => $key) {
        if ($streak >= $threshold) $keys[] = $key;
    }

    return $keys;
}
