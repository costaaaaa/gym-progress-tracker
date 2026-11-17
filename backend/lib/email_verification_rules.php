<?php
// Regole pure della verifica dell'email (nessun database, nessun fuso): codice di 6 cifre, limiti di
// reinvio, scadenza dei 7 giorni e pulizia degli account mai confermati. Gli istanti sono unix
// timestamp (UTC), quindi il fuso di PHP non cambia nulla. Provate da tests/email_verify_rules_test.php.

const EMAIL_CODE_TTL_SECONDS = 1800;          // il codice vale 30 minuti
const EMAIL_CODE_MAX_ATTEMPTS = 5;            // dopo 5 tentativi sbagliati non vale più
const EMAIL_RESEND_MIN_SECONDS = 120;         // un invio ogni 2 minuti...
const EMAIL_RESEND_PER_HOUR = 5;              // ...e 5 all'ora, per utente
const EMAIL_VERIFY_DEADLINE_SECONDS = 604800; // 7 × 24 ore dalla registrazione

const UNVERIFIED_NOTICE1_SECONDS = 2592000;   // 30 giorni: primo avviso
const UNVERIFIED_NOTICE2_SECONDS = 3024000;   // 35 giorni: secondo avviso
const UNVERIFIED_DELETE_SECONDS = 3196800;    // 37 giorni: eliminazione possibile
const UNVERIFIED_DELETE_AFTER_NOTICE_SECONDS = 169200; // 47 ore dal secondo avviso

// Codice di 6 cifre, anche con zeri iniziali
function emailCodeGenerate()
{
    return str_pad((string)random_int(0, 999999), 6, '0', STR_PAD_LEFT);
}

function emailCodeIsWellFormed($code)
{
    return is_string($code) && preg_match('/^[0-9]{6}$/', $code) === 1;
}

// Nel database solo questo: sha256("<id utente>:<codice>")
function emailCodeHash($user_id, $code)
{
    return hash('sha256', (int)$user_id . ':' . $code);
}

// Stato di un codice: 'used' (usato o annullato), 'exhausted' (tentativi finiti), 'expired' o 'active'.
// $used_at e $expires_at sono timestamp (o null per $used_at).
function emailCodeState($attempts, $expires_at, $used_at, $now)
{
    if ($used_at !== null) {
        return 'used';
    }
    if ((int)$attempts >= EMAIL_CODE_MAX_ATTEMPTS) {
        return 'exhausted';
    }
    if ($now >= $expires_at) {
        return 'expired';
    }
    return 'active';
}

// Secondi da aspettare prima di poter mandare un altro codice, 0 se si può. $sent: timestamp di tutti
// i codici mandati all'utente (di qualunque indirizzo e anche se annullati), in qualunque ordine.
function emailCodeResendWait(array $sent, $now)
{
    $wait = 0;
    $recent = array();
    foreach ($sent as $t) {
        if ($t <= $now && $now - $t < 3600) {
            $recent[] = $t;
        }
    }
    rsort($recent);
    if ($recent) {
        $wait = max($wait, $recent[0] + EMAIL_RESEND_MIN_SECONDS - $now);
    }
    if (count($recent) >= EMAIL_RESEND_PER_HOUR) {
        // il più vecchio dei più recenti 5 esce dalla finestra di un'ora
        $wait = max($wait, $recent[EMAIL_RESEND_PER_HOUR - 1] + 3600 - $now);
    }
    return max(0, (int)$wait);
}

// Fine dei 7 giorni: registrazione + 7 × 24 ore (timestamp)
function emailVerificationDeadline($created_at)
{
    return $created_at + EMAIL_VERIFY_DEADLINE_SECONDS;
}

// Stato per user/read.php: null se l'email è confermata, altrimenti
// ['deadline' => ISO 8601 UTC, 'blocked' => bool, 'days_left' => giorni interi rimasti per eccesso, 0 se bloccato]
function emailVerificationStatus($created_at, $verified, $now)
{
    if ($verified) {
        return null;
    }
    $deadline = emailVerificationDeadline($created_at);
    $blocked = $now >= $deadline;
    return array(
        'deadline' => gmdate('Y-m-d\TH:i:s\Z', $deadline),
        'blocked' => $blocked,
        'days_left' => $blocked ? 0 : (int)ceil(($deadline - $now) / 86400),
    );
}

// Cosa fa la pulizia notturna di un account: 'none', 'notice1', 'notice2' o 'delete'. Un solo passo
// per notte: chi ha saltato più soglie riceve un avviso per notte, in ordine, e non è mai eliminato
// senza i due avvisi. $notice_at: timestamp del secondo avviso (o null). Mai gli admin, mai i confermati.
function unverifiedAccountAction($created_at, $stage, $notice_at, $now, $is_admin, $verified)
{
    if ($is_admin || $verified) {
        return 'none';
    }
    $age = $now - $created_at;
    $stage = (int)$stage;
    if ($stage === 0) {
        return $age >= UNVERIFIED_NOTICE1_SECONDS ? 'notice1' : 'none';
    }
    if ($stage === 1) {
        return $age >= UNVERIFIED_NOTICE2_SECONDS ? 'notice2' : 'none';
    }
    if ($age >= UNVERIFIED_DELETE_SECONDS && $notice_at !== null
        && $now - $notice_at >= UNVERIFIED_DELETE_AFTER_NOTICE_SECONDS) {
        return 'delete';
    }
    return 'none';
}
