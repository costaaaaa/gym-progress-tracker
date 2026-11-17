<?php
// Pulizia periodica dei dati che non servono piu' (limitazione della conservazione, art. 5.1.e GDPR).
// Da lanciare una volta al giorno dal cron del server (vedi il repo dell'infrastruttura):
//
//   php backend/tools/purge.php             esegue
//   php backend/tools/purge.php --dry-run   conta soltanto
//
// Cancella:
//   - token mobile scaduti o revocati da piu' di 30 giorni
//   - link di reset password scaduti o gia' usati da piu' di 7 giorni
//   - codici di conferma dell'email scaduti da piu' di 7 giorni
//   - account mai confermati (regola in lib/email_verification_rules.php, unverifiedAccountAction): email di avviso
//     al giorno 30 e al giorno 35 dalla registrazione, eliminazione dopo 37 giorni e almeno 47 ore dal secondo
//     avviso. Un solo passo per account a ogni notte; mai gli admin. Un account che fallisce non ferma gli altri:
//     l'errore finisce nel riepilogo e l'esito del comando e' 1.
//   - contatori del rate limiter scaduti
//   - segnalazioni nei gruppi chiuse da piu' di 5 anni (le aperte restano finche' l'admin decide)
//   - (solo se impostata la variabile LEGACY_STATS_PURGE_FROM=AAAA-MM-GG e la data e' passata)
//     le misure corporee di chi non ha mai dato il consenso per i dati sulla salute: sono i dati
//     inseriti prima che il consenso esistesse. Spenta di proposito finche' non la si imposta.

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/api_helpers.php';
require_once __DIR__ . '/../models/User.php';
require_once __DIR__ . '/../lib/email_verification_mail.php';

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

purge($db, 'codici di conferma email scaduti (>7 gg)', 'gym_email_codes',
    "expires_at < DATE_SUB(NOW(), INTERVAL 7 DAY)", $dryRun);

// Account mai confermati: un passo per notte (avviso 1, avviso 2, eliminazione). Un account per volta;
// se uno fallisce gli altri proseguono. L'avviso che non parte non fa avanzare l'account: si riprova domani.
$counts = array('notice1' => 0, 'notice2' => 0, 'delete' => 0);
$errors = array();
$unverified = $db->query(
    "SELECT id, username, email, locale, is_admin, unverified_notice_stage AS stage,
            UNIX_TIMESTAMP(created_at) AS created_ts, UNIX_TIMESTAMP(unverified_notice_at) AS notice_ts,
            UNIX_TIMESTAMP() AS now_ts
     FROM gym_users WHERE email_verified_at IS NULL AND is_admin = 0 ORDER BY id"
)->fetchAll(PDO::FETCH_ASSOC);
foreach ($unverified as $u) {
    try {
        $action = unverifiedAccountAction((int)$u['created_ts'], (int)$u['stage'],
            $u['notice_ts'] === null ? null : (int)$u['notice_ts'], (int)$u['now_ts'], (int)$u['is_admin'] === 1, false);
        if ($action === 'none') {
            continue;
        }
        if ($dryRun) {
            $counts[$action]++;
            continue;
        }
        if ($action === 'delete') {
            // Ricontrollo ed eliminazione nella stessa transazione, con la riga utente bloccata: chi ha confermato
            // l'email nel frattempo non viene eliminato
            $account = new User($db);
            $account->id = (int)$u['id'];
            $deleted = $account->deleteRecords(true);
            if ($deleted === null) {
                continue;
            }
            if (!$deleted) {
                throw new Exception('eliminazione non riuscita');
            }
            $counts['delete']++;
            continue;
        }
        $stage = $action === 'notice1' ? 1 : 2;
        $lang = normalize_locale($u['locale']) ?? 'it';
        if (!email_verification_send_deletion_notice($stage, $u['email'], $u['username'], $lang, (int)$u['created_ts'])) {
            throw new Exception('email di avviso non partita');
        }
        $upd = $db->prepare("UPDATE gym_users SET unverified_notice_stage = ?, unverified_notice_at = NOW()
                             WHERE id = ? AND unverified_notice_stage = ? AND email_verified_at IS NULL");
        $upd->execute([$stage, $u['id'], $stage - 1]);
        $counts[$action]++;
    } catch (Throwable $e) {
        $errors[] = 'account ' . $u['id'] . ': ' . $e->getMessage();
    }
}
echo str_pad('account non confermati: avviso 1 (30 gg)', 48) . $counts['notice1'] . "\n";
echo str_pad('account non confermati: avviso 2 (35 gg)', 48) . $counts['notice2'] . "\n";
echo str_pad('account non confermati eliminati (37 gg)', 48) . $counts['delete'] . "\n";
foreach ($errors as $error) {
    echo "ERRORE $error\n";
}

purge($db, 'contatori rate limiter scaduti', 'gym_rate_limits', "expires_at < NOW()", $dryRun);

purge($db, 'segnalazioni chiuse (>5 anni)', 'gym_reports',
    "status <> 'open' AND decided_at < DATE_SUB(NOW(), INTERVAL 5 YEAR)", $dryRun);

$from = getenv('LEGACY_STATS_PURGE_FROM');
if ($from && preg_match('/^\d{4}-\d{2}-\d{2}$/', $from) && date('Y-m-d') >= $from) {
    purge($db, "misure senza consenso (da $from)", 'gym_user_stats',
        "user_id NOT IN (SELECT user_id FROM gym_consents WHERE purpose = 'health_data' AND revoked_at IS NULL)", $dryRun);
} else {
    echo str_pad('misure senza consenso', 48) . "saltata (LEGACY_STATS_PURGE_FROM non impostata o non raggiunta)\n";
}

exit($errors ? 1 : 0);
