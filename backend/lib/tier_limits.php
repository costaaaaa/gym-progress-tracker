<?php
// Limiti del livello (Gratis, Plus, Pro), regola di sola lettura delle schede e riduzione delle
// risposte del dashboard per il Gratis. Zero dipendenze DB: sono le regole pure usate da
// api_helpers.php (user_limits, enforce_tier_limit, require_plan_writable), dagli endpoint workout/,
// exercise/create.php, user/read.php e workout_stats/dashboard.php. Il livello in vigore arriva da
// user_tier() (lib/tier_rules.php); le funzioni abilitate da user_features() (api_helpers.php), l'unico
// punto che lega il livello alle funzioni.

// Tetti per livello: Plus e Pro hanno quelli massimi del servizio. Un livello non noto vale Gratis.
function tierLimits(string $tier): array
{
    if ($tier === 'plus' || $tier === 'pro') {
        return ['plans' => 50, 'days_per_plan' => 14, 'personal_exercises' => 30];
    }
    return ['plans' => 2, 'days_per_plan' => 4, 'personal_exercises' => 10];
}

// Motivi di sola lettura, in ordine di precedenza: motivo → [chiave del limite in tierLimits(), chiave del
// messaggio del server]. È l'unico punto che lega un motivo al suo limite: un nuovo motivo si aggiunge qui.
const PLAN_READ_ONLY_REASONS = [
    'plans_over_limit' => ['plans', 'workout.plan_read_only_plans'],
    'days_over_limit' => ['days_per_plan', 'workout.plan_read_only_days'],
];

// Motivo per cui una scheda è in sola lettura, o null se si può modificare. Con più schede del limite
// sono tutte in sola lettura (plans_over_limit); altrimenti lo è la scheda con più giorni del limite
// (days_over_limit). $planCount: schede dell'utente; $planDays: giorni di questa scheda.
function planReadOnlyReason(int $planCount, int $planDays, array $limits): ?string
{
    $counts = ['plans' => $planCount, 'days_per_plan' => $planDays];
    foreach (PLAN_READ_ONLY_REASONS as $reason => [$limitKey]) {
        if ($counts[$limitKey] > $limits[$limitKey]) {
            return $reason;
        }
    }
    return null;
}

// 'full' se l'utente ha sia muscle_status_full sia weekly_sets_by_muscle (user_features), altrimenti 'basic':
// il campo detail del dashboard.
function dashboardDetail(bool $statusFull, bool $setsFull): string
{
    return ($statusFull && $setsFull) ? 'full' : 'basic';
}

// Stato muscolare (output di recoveryStatus). Con $full tutto com'è. Senza: solo PRONTO / IN RECUPERO
// (AFFATICATO diventa IN RECUPERO), senza percent e senza ready_at; last_trained resta (null = mai allenato).
function recoveryForDetail(array $recovery, bool $full): array
{
    if ($full) {
        return $recovery;
    }
    $basic = [];
    foreach ($recovery as $muscle => $row) {
        $basic[$muscle] = [
            'status' => $row['status'] === 'PRONTO' ? 'PRONTO' : 'IN RECUPERO',
            'last_trained' => $row['last_trained'],
        ];
    }
    return $basic;
}

// weekly_sets (output di weeklySetsBuckets). Con $full la forma completa più total; senza: solo { total }
// (serie della settimana, riscaldamento escluso a monte).
function weeklySetsForDetail(array $weeklySets, bool $full): array
{
    $total = array_sum($weeklySets['week']);
    if (!$full) {
        return ['total' => $total];
    }
    return $weeklySets + ['total' => $total];
}
