<?php
// Livello dell'account (free, plus, pro; cumulativi). Zero dipendenze DB: sono le regole pure usate da
// user_tier() in config/api_helpers.php, da tools/tier.php e da api/admin/tiers.php.
// Gli istanti sono stringhe UTC 'Y-m-d H:i:s'.

const TIER_LEVELS = ['free', 'plus', 'pro'];

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

// tier_until da salvare per "set <livello> [data]". $lastDay (AAAA-MM-GG, UTC) è l'ultimo giorno valido
// compreso: tier_until è il giorno dopo alle 00:00:00. Senza data (o con free) tier_until è NULL.
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
    $utc = new DateTimeZone('UTC');
    $day = DateTimeImmutable::createFromFormat('!Y-m-d', $lastDay, $utc);
    if ($day === false || $day->format('Y-m-d') !== $lastDay) {
        return ['error' => "Data non valida: $lastDay (formato AAAA-MM-GG)."];
    }
    if ($day->format('Y-m-d') === '9999-12-31') {
        // il giorno dopo (anno 10000) non entra in un DATETIME
        return ['error' => "Data non valida: $lastDay (oltre il massimo, 9999-12-30)."];
    }
    $until = $day->modify('+1 day')->format('Y-m-d H:i:s');
    if ($until <= $now) {
        return ['error' => "La data $lastDay è già passata (UTC)."];
    }
    return ['until' => $until];
}

// Inverso di tierSetUntil: ultimo giorno valido (AAAA-MM-GG, UTC) di un tier_until, o null se non scade.
// tier_until è il primo istante senza livello, quindi l'ultimo giorno è quello del secondo precedente.
function tierLastDay(?string $until): ?string
{
    if ($until === null) {
        return null;
    }
    return (new DateTimeImmutable($until, new DateTimeZone('UTC')))->modify('-1 second')->format('Y-m-d');
}
