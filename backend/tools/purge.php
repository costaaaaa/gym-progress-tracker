<?php
// Pulizia periodica dei dati che non servono piu' (limitazione della conservazione, art. 5.1.e GDPR).
// Da lanciare una volta al giorno dal cron del server (vedi gym-infra):
//
//   php backend/tools/purge.php             esegue
//   php backend/tools/purge.php --dry-run   conta soltanto
//
// Cancella:
//   - token mobile scaduti o revocati da piu' di 30 giorni
//   - link di reset password scaduti o gia' usati da piu' di 7 giorni
//   - contatori del rate limiter scaduti
//   - (solo se impostata la variabile LEGACY_STATS_PURGE_FROM=AAAA-MM-GG e la data e' passata)
//     le misure corporee di chi non ha mai dato il consenso per i dati sulla salute: sono i dati
//     inseriti prima che il consenso esistesse. Spenta di proposito finche' non la si imposta.

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once __DIR__ . '/../config/database.php';

$dryRun = in_array('--dry-run', $argv, true);
$db = (new Database())->getConnection();

// Conta le righe che la condizione seleziona; le cancella solo se non e' un dry-run
function purge($db, $label, $table, $where, $dryRun, $params = array())
{
    $count = $db->prepare("SELECT COUNT(*) FROM $table WHERE $where");
    $count->execute($params);
    $n = (int)$count->fetchColumn();
    if (!$dryRun && $n > 0) {
        $del = $db->prepare("DELETE FROM $table WHERE $where");
        $del->execute($params);
    }
    echo str_pad($label, 48) . $n . "\n";
    return $n;
}

echo ($dryRun ? "[dry-run] " : "") . "pulizia " . date('c') . "\n";

purge($db, 'token mobile scaduti o revocati (>30 gg)', 'gym_api_tokens',
    "(revoked_at IS NOT NULL AND revoked_at < DATE_SUB(NOW(), INTERVAL 30 DAY))
     OR expires_at < DATE_SUB(NOW(), INTERVAL 30 DAY)", $dryRun);

purge($db, 'link di reset scaduti o usati (>7 gg)', 'gym_password_resets',
    "expires_at < DATE_SUB(NOW(), INTERVAL 7 DAY)", $dryRun);

purge($db, 'contatori rate limiter scaduti', 'gym_rate_limits', "expires_at < NOW()", $dryRun);

$from = getenv('LEGACY_STATS_PURGE_FROM');
if ($from && preg_match('/^\d{4}-\d{2}-\d{2}$/', $from) && date('Y-m-d') >= $from) {
    purge($db, "misure senza consenso (da $from)", 'gym_user_stats',
        "user_id NOT IN (SELECT user_id FROM gym_consents WHERE purpose = 'health_data' AND revoked_at IS NULL)", $dryRun);
} else {
    echo str_pad('misure senza consenso', 48) . "saltata (LEGACY_STATS_PURGE_FROM non impostata o non raggiunta)\n";
}
