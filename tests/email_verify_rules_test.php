<?php
require __DIR__ . '/../backend/lib/email_verification_rules.php';

$fails = 0;
$checks = 0;
function check($desc, $cond)
{
    global $fails, $checks;
    $checks++;
    if ($cond) {
        echo "  \033[32m✓\033[0m $desc\n";
    } else {
        $fails++;
        echo "  \033[31m✗\033[0m $desc\n";
    }
}

echo "Regole della verifica dell'email (fuso " . date_default_timezone_get() . ")\n";
if (isset($argv[1])) {
    check("il fuso di PHP è quello atteso ({$argv[1]})", date_default_timezone_get() === $argv[1]);
}
const DAY = 86400;
$t0 = gmmktime(12, 0, 0, 3, 20, 2027); // la registrazione; a cavallo dell'ora legale (28 marzo)

echo "Codice\n";
$codes = array();
for ($i = 0; $i < 200; $i++) {
    $codes[] = emailCodeGenerate();
}
check('il codice generato ha sempre 6 cifre', count(array_filter($codes, 'emailCodeIsWellFormed')) === 200);
check('il codice non è sempre lo stesso', count(array_unique($codes)) > 100);
check('"000042" è ben formato', emailCodeIsWellFormed('000042'));
check('5 cifre: no', !emailCodeIsWellFormed('12345'));
check('7 cifre: no', !emailCodeIsWellFormed('1234567'));
check('lettere: no', !emailCodeIsWellFormed('12345a'));
check('numero intero (non stringa): no', !emailCodeIsWellFormed(123456));
check('con spazi: no', !emailCodeIsWellFormed(' 123456'));
check('hash = sha256("<id>:<codice>")', emailCodeHash(7, '123456') === hash('sha256', '7:123456'));
check('lo stesso codice di un altro utente ha un altro hash', emailCodeHash(7, '123456') !== emailCodeHash(8, '123456'));

echo "Stato del codice\n";
check('attivo', emailCodeState(0, $t0 + 1800, null, $t0) === 'active');
check('4 tentativi: ancora attivo', emailCodeState(4, $t0 + 1800, null, $t0) === 'active');
check('5 tentativi: esaurito', emailCodeState(5, $t0 + 1800, null, $t0) === 'exhausted');
check('un secondo prima della scadenza: attivo', emailCodeState(0, $t0 + 1800, null, $t0 + 1799) === 'active');
check('all\'istante della scadenza: scaduto', emailCodeState(0, $t0 + 1800, null, $t0 + 1800) === 'expired');
check('usato o annullato: used', emailCodeState(0, $t0 + 1800, $t0 + 5, $t0 + 10) === 'used');

echo "Limiti di reinvio\n";
check('nessun invio: si può', emailCodeResendWait(array(), $t0) === 0);
check('un invio un secondo fa: attesa 119 s', emailCodeResendWait(array($t0 - 1), $t0) === 119);
check('un invio 120 s fa: si può', emailCodeResendWait(array($t0 - 120), $t0) === 0);
check('un invio 119 s fa: attesa 1 s', emailCodeResendWait(array($t0 - 119), $t0) === 1);
$five = array($t0 - 3000, $t0 - 2500, $t0 - 2000, $t0 - 1500, $t0 - 1000);
check('5 invii nell\'ultima ora: si aspetta che il più vecchio esca (600 s)', emailCodeResendWait($five, $t0) === 600);
check('4 invii nell\'ultima ora, l\'ultimo da 1000 s: si può', emailCodeResendWait(array_slice($five, 1), $t0) === 0);
check('599 s dopo: il più vecchio non è ancora uscito dall\'ora (1 s)', emailCodeResendWait($five, $t0 + 599) === 1);
check('600 s dopo: il più vecchio è uscito dall\'ora, si può', emailCodeResendWait($five, $t0 + 600) === 0);
check('invii più vecchi di un\'ora non contano', emailCodeResendWait(array($t0 - 3600, $t0 - 4000, $t0 - 5000, $t0 - 6000, $t0 - 7000), $t0) === 0);
check('6 invii in un\'ora: si aspetta che esca il quinto più recente', emailCodeResendWait(array($t0 - 3500, $t0 - 3000, $t0 - 2500, $t0 - 2000, $t0 - 1500, $t0 - 1000), $t0) === 600);
check('limite orario e minimo insieme: vale il più lungo', emailCodeResendWait(array($t0 - 3599, $t0 - 1200, $t0 - 900, $t0 - 600, $t0 - 10), $t0) === 110);
check('ordine degli invii irrilevante', emailCodeResendWait(array_reverse($five), $t0) === 600);

echo "Scadenza dei 7 giorni\n";
check('scadenza = registrazione + 7 × 24 ore (anche a cavallo dell\'ora legale)', emailVerificationDeadline($t0) === $t0 + 7 * 24 * 3600);
check('account confermato: nessuno stato', emailVerificationStatus($t0, true, $t0 + 100 * DAY) === null);
$s = emailVerificationStatus($t0, false, $t0);
check('appena registrato: 7 giorni, non bloccato', $s['days_left'] === 7 && $s['blocked'] === false);
check('deadline in ISO UTC', $s['deadline'] === gmdate('Y-m-d\TH:i:s\Z', $t0 + 7 * DAY) && substr($s['deadline'], -1) === 'Z');
$s = emailVerificationStatus($t0, false, $t0 + 1);
check('un secondo dopo: ancora 7 (per eccesso)', $s['days_left'] === 7);
$s = emailVerificationStatus($t0, false, $t0 + DAY);
check('dopo un giorno esatto: 6', $s['days_left'] === 6);
$s = emailVerificationStatus($t0, false, $t0 + 6 * DAY + 1);
check('6 giorni e un secondo: 1 giorno', $s['days_left'] === 1 && !$s['blocked']);
$s = emailVerificationStatus($t0, false, $t0 + 7 * DAY - 1);
check('un secondo prima della scadenza: 1 giorno, non bloccato', $s['days_left'] === 1 && !$s['blocked']);
$s = emailVerificationStatus($t0, false, $t0 + 7 * DAY);
check('alla scadenza: bloccato, 0 giorni', $s['blocked'] === true && $s['days_left'] === 0);
$s = emailVerificationStatus($t0, false, $t0 + 30 * DAY);
check('molto dopo: bloccato, 0 giorni', $s['blocked'] === true && $s['days_left'] === 0);

echo "Pulizia degli account non confermati\n";
function act($ageSeconds, $stage, $noticeAgo, $admin = false, $verified = false)
{
    global $t0;
    $now = $t0 + $ageSeconds;
    return unverifiedAccountAction($t0, $stage, $noticeAgo === null ? null : $now - $noticeAgo, $now, $admin, $verified);
}
check('giorno 29: niente', act(29 * DAY + 86399, 0, null) === 'none');
check('giorno 30 esatto: primo avviso', act(30 * DAY, 0, null) === 'notice1');
check('dopo il primo avviso, giorno 31: niente', act(31 * DAY, 1, null) === 'none');
check('giorno 34: niente', act(34 * DAY + 86399, 1, null) === 'none');
check('giorno 35 esatto: secondo avviso', act(35 * DAY, 1, null) === 'notice2');
check('secondo avviso partito da poco, giorno 36: niente', act(36 * DAY, 2, DAY) === 'none');
check('giorno 37 con avviso da 12 ore: niente', act(37 * DAY, 2, 12 * 3600) === 'none');
check('giorno 37 con avviso da 46 ore 59 minuti: niente', act(37 * DAY, 2, 47 * 3600 - 60) === 'none');
check('giorno 37 con avviso da 47 ore: elimina', act(37 * DAY, 2, 47 * 3600) === 'delete');
check('giorno 36 con avviso da 3 giorni (impossibile ma sicuro): niente prima del giorno 37', act(36 * DAY, 2, 3 * DAY) === 'none');
check('giorno 38 con avviso da 3 giorni: elimina', act(38 * DAY, 2, 3 * DAY) === 'delete');
check('stage 2 senza data dell\'avviso: mai elimina', act(60 * DAY, 2, null) === 'none');
check('notte saltata: a 40 giorni con stage 0 solo il primo avviso', act(40 * DAY, 0, null) === 'notice1');
check('notte saltata: a 40 giorni con stage 1 solo il secondo avviso', act(40 * DAY, 1, null) === 'notice2');
check('notte saltata: a 100 giorni con stage 0 non elimina', act(100 * DAY, 0, null) === 'notice1');
check('admin: mai', act(100 * DAY, 2, 10 * DAY, true) === 'none' && act(31 * DAY, 0, null, true) === 'none');
check('confermato: mai', act(100 * DAY, 2, 10 * DAY, false, true) === 'none' && act(31 * DAY, 0, null, false, true) === 'none');
check('percorso completo senza mai saltare notti: notice1, notice2, delete', (function () {
    global $t0;
    $stage = 0; $noticeAt = null; $out = array();
    for ($night = 0; $night < 60; $night++) {
        $now = $t0 + $night * DAY + 15 * 3600; // 03:30 circa, un'ora diversa dalla registrazione
        $a = unverifiedAccountAction($t0, $stage, $noticeAt, $now, false, false);
        if ($a === 'notice1') { $stage = 1; $out[] = "$night:1"; }
        elseif ($a === 'notice2') { $stage = 2; $noticeAt = $now; $out[] = "$night:2"; }
        elseif ($a === 'delete') { $out[] = "$night:d"; break; }
    }
    return $out === array('30:1', '35:2', '37:d');
})());

echo "\nCONTROLLI $checks FALLITI $fails\n";
exit($fails > 0 ? 1 : 0);
