<?php
// Livello dell'account (free, plus, pro; cumulativi). Zero dipendenze DB: sono le regole pure usate da
// user_tier() in config/api_helpers.php, da tools/tier.php e da api/admin/tiers.php.
// Gli istanti salvati e confrontati sono stringhe UTC 'Y-m-d H:i:s'; i giorni (l'ultimo giorno valido) sono
// giorni in ora italiana.

const TIER_LEVELS = ['free', 'plus', 'pro'];
// Fuso dei giorni di scadenza: il livello scade a mezzanotte italiana. Separato apposta da
// DEFAULT_TIME_ZONE (api_helpers.php, ripiego per il fuso del dispositivo): sono due regole diverse.
const TIER_TIME_ZONE = 'Europe/Rome';

// Livello in vigore: quello salvato, ma free se è scaduto ($until non NULL e $now >= $until; NULL =
// senza scadenza) o se il valore salvato non è un livello noto. $tier non è tipizzato apposta: accetta
// qualunque valore arrivi dal database (anche uno che non è un livello). Niente cron: si calcola alla lettura.
function tierEffective($tier, ?string $until, string $now): string
{
    if (!in_array($tier, TIER_LEVELS, true)) {
        return 'free';
    }
    if ($until !== null && $now >= $until) {
        return 'free';
    }
    return $tier;
}

// tier_until da salvare per "set <livello> [data]". $lastDay (AAAA-MM-GG, ora italiana) è l'ultimo
// giorno valido compreso: tier_until è il giorno dopo alle 00:00 italiane, espresso in UTC (es. 2026-11-30
// -> '2026-11-30 23:00:00', 2026-06-30 -> '2026-06-30 22:00:00'). Senza data (o con free) tier_until è NULL.
// Torna ['until' => ?string] oppure ['error' => messaggio]: livello sconosciuto, free con una data,
// data non valida o già passata.
function tierSetUntil(string $tier, ?string $lastDay, string $now): array
{
    if (!in_array($tier, TIER_LEVELS, true)) {
        return ['error' => "Livello non valido: $tier (free, plus o pro)."];
    }
    if ($lastDay === null) {
        return ['until' => null];
    }
    if ($tier === 'free') {
        return ['error' => "Il livello free non ha scadenza: togli la data."];
    }
    $day = DateTimeImmutable::createFromFormat('!Y-m-d', $lastDay, new DateTimeZone(TIER_TIME_ZONE));
    if ($day === false || $day->format('Y-m-d') !== $lastDay) {
        return ['error' => "Data non valida: $lastDay (formato AAAA-MM-GG)."];
    }
    if ($day->format('Y-m-d') === '9999-12-31') {
        // limite voluto: così il giorno dopo resta entro l'anno 9999 anche in ora italiana
        return ['error' => "Data non valida: $lastDay (oltre il massimo, 9999-12-30)."];
    }
    $until = $day->modify('+1 day')->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
    if ($until <= $now) {
        return ['error' => "La data $lastDay è già passata (ora italiana)."];
    }
    return ['until' => $until];
}

// Inverso di tierSetUntil: ultimo giorno valido (AAAA-MM-GG, ora italiana) di un tier_until (UTC), o null
// se non scade. tier_until è il primo istante senza livello: l'ultimo giorno è quello del secondo prima.
function tierLastDay(?string $until): ?string
{
    if ($until === null) {
        return null;
    }
    return (new DateTimeImmutable($until, new DateTimeZone('UTC')))
        ->setTimezone(new DateTimeZone(TIER_TIME_ZONE))->modify('-1 second')->format('Y-m-d');
}
