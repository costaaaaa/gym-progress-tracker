<?php
// Limiti del livello (Gratis, Plus, Pro), regola di sola lettura delle schede e riduzione delle
// risposte del dashboard per il Gratis. Zero dipendenze DB: sono le regole pure usate da
// api_helpers.php (tier_limits_for_user, require_plan_writable), dagli endpoint workout/, exercise/create.php,
// user/read.php e workout_stats/dashboard.php. Il livello in vigore arriva da user_tier()
// (lib/tier_rules.php).

// Tetti per livello: Plus e Pro hanno quelli massimi del servizio. Un livello non noto vale Gratis.
function tierLimits(string $tier): array
{
    if ($tier === 'plus' || $tier === 'pro') {
        return ['plans' => 50, 'days_per_plan' => 14, 'personal_exercises' => 30];
    }
    return ['plans' => 2, 'days_per_plan' => 4, 'personal_exercises' => 10];
}

// Motivo per cui una scheda è in sola lettura, o null se si può modificare. Con più schede del limite
// sono tutte in sola lettura (plans_over_limit); altrimenti lo è la scheda con più giorni del limite
// (days_over_limit). $planCount: schede dell'utente; $planDays: giorni di questa scheda.
function planReadOnlyReason(int $planCount, int $planDays, array $limits): ?string
{
    if ($planCount > $limits['plans']) {
        return 'plans_over_limit';
    }
    if ($planDays > $limits['days_per_plan']) {
        return 'days_over_limit';
    }
    return null;
}

// 'full' per Plus e Pro, 'basic' per il Gratis: quanto dettaglio mostra il dashboard.
function dashboardDetail(string $tier): string
{
    return ($tier === 'plus' || $tier === 'pro') ? 'full' : 'basic';
}

// Stato muscolare (output di recoveryStatus) per il dettaglio dato. 'basic': solo PRONTO / IN RECUPERO
// (AFFATICATO diventa IN RECUPERO), senza percent e senza ready_at; last_trained resta (null = mai allenato).
function recoveryForDetail(array $recovery, string $detail): array
{
    if ($detail === 'full') {
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

// weekly_sets (output di weeklySetsBuckets) per il dettaglio dato. 'basic': solo { total } (serie della
// settimana). 'full': la forma completa più total.
function weeklySetsForDetail(array $weeklySets, string $detail): array
{
    $total = array_sum($weeklySets['week']);
    if ($detail === 'basic') {
        return ['total' => $total];
    }
    return $weeklySets + ['total' => $total];
}
