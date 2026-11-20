<?php
// Regole della Home (funzioni pure, provate da tests/home_rules_test.php): giorno proposto, giorni della
// settimana, layout dei blocchi e proposta di un modulo. Servono le costanti di models/User.php.

// Giorni di pausa fra la scelta dei moduli e la prima proposta, e fra una risposta e la successiva
const MODULE_OFFER_PAUSE_DAYS = 7;

// Il giorno della scheda da proporre ora: $days è l'elenco dei giorni della scheda attiva in ordine
// ({id, name, exercises}), $last_day_id il giorno dell'ultimo allenamento (null se non c'è). Dopo il giorno
// dell'ultimo allenamento viene il successivo, dopo l'ultimo si ricomincia dal primo; se $last_day_id non è
// un giorno di questa scheda vale il primo. null se la scheda non ha giorni.
function next_plan_day(array $days, ?int $last_day_id): ?array {
    if (empty($days)) return null;
    $days = array_values($days);
    foreach ($days as $i => $day) {
        if ($last_day_id !== null && (int) $day['id'] === $last_day_id) {
            return $days[($i + 1) % count($days)];
        }
    }
    return $days[0];
}

// Sette booleani, da lunedì a domenica: il giorno ha almeno un allenamento. $dates = date degli allenamenti
// ('Y-m-d H:i:s', ora locale del luogo), $monday = lunedì della settimana ('Y-m-d'). Si confrontano i giorni
// di calendario, quindi un cambio d'ora non sposta nulla.
function week_day_flags(array $dates, string $monday): array {
    $flags = array_fill(0, 7, false);
    $days = array();
    for ($i = 0; $i < 7; $i++) {
        $days[(new DateTimeImmutable($monday))->modify("+$i days")->format('Y-m-d')] = $i;
    }
    foreach ($dates as $date) {
        $day = substr($date, 0, 10);
        if (isset($days[$day])) $flags[$days[$day]] = true;
    }
    return $flags;
}

// Layout della Home da salvare: elenco di al massimo count(User::HOME_BLOCKS) elementi {key, hidden, large},
// ogni chiave di User::HOME_BLOCKS al massimo una volta, hidden e large booleani veri. Ritorna l'elenco con soli
// quei tre campi, o false se qualcosa non va (null, cioè «torna al predefinito», lo gestisce il chiamante).
function home_layout_valid($value) {
    if (!is_array($value) || count($value) > count(User::HOME_BLOCKS) || array_keys($value) !== array_keys(array_values($value))) {
        return false;
    }
    $clean = array();
    $seen = array();
    foreach ($value as $item) {
        if (is_object($item)) $item = (array) $item;
        if (!is_array($item)
            || !isset($item['key']) || !is_string($item['key']) || !in_array($item['key'], User::HOME_BLOCKS, true)
            || isset($seen[$item['key']])
            || !isset($item['hidden']) || !is_bool($item['hidden'])
            || !isset($item['large']) || !is_bool($item['large'])) {
            return false;
        }
        $seen[$item['key']] = true;
        $clean[] = array('key' => $item['key'], 'hidden' => $item['hidden'], 'large' => $item['large']);
    }
    return $clean;
}

// Layout letto dal database (testo JSON o NULL): l'elenco, oppure null se manca o non è valido
function home_layout_stored(?string $json): ?array {
    if ($json === null) return null;
    $layout = home_layout_valid(json_decode($json, true));
    return $layout === false ? null : $layout;
}

// Il modulo da proporre adesso, o null. Il primo di User::MODULE_OFFERS che non è attivo ($modules: chiave =>
// attivo) e non è tra i rifiutati; solo se la scelta dei moduli è fatta ($chosen_at non null) e sono passati
// almeno MODULE_OFFER_PAUSE_DAYS giorni sia da $chosen_at sia da $offer_at (l'ultima risposta, se c'è). Le date
// sono quelle del database ('Y-m-d H:i:s'), $now è «adesso».
function module_to_offer(array $modules, ?string $chosen_at, array $declined, ?string $offer_at, DateTimeInterface $now): ?string {
    if ($chosen_at === null) return null;
    $limit = $now->getTimestamp() - MODULE_OFFER_PAUSE_DAYS * 86400;
    if ((new DateTimeImmutable($chosen_at))->getTimestamp() > $limit) return null;
    if ($offer_at !== null && (new DateTimeImmutable($offer_at))->getTimestamp() > $limit) return null;
    foreach (User::MODULE_OFFERS as $key) {
        if (empty($modules[$key]) && !in_array($key, $declined, true)) return $key;
    }
    return null;
}
