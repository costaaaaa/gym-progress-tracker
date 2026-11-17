<?php
require __DIR__ . '/../backend/lib/tier_rules.php';
require __DIR__ . '/../backend/lib/email_verification_rules.php';
require __DIR__ . '/../backend/lib/signup_code_rules.php';

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

echo "Regole dei codici di registrazione (fuso " . date_default_timezone_get() . ")\n";
if (isset($argv[1])) {
    check("il fuso di PHP è quello atteso ({$argv[1]})", date_default_timezone_get() === $argv[1]);
}
const DAY = 86400;
$t0 = gmmktime(12, 0, 0, 3, 20, 2027); // la registrazione, a cavallo dell'ora legale italiana (28 marzo)
$nowUtc = function ($ts) { return gmdate('Y-m-d H:i:s', $ts); };

echo "Normalizzazione\n";
check('minuscole e maiuscole sono lo stesso codice', signupCodeNormalize('mario-plus') === 'MARIO-PLUS');
check('spazi ai bordi via', signupCodeNormalize(' Mario-Plus ') === 'MARIO-PLUS');
check('già maiuscolo resta uguale', signupCodeNormalize('MARIO-PLUS') === 'MARIO-PLUS');
check('tab e a capo ai bordi via', signupCodeNormalize("\tmario-plus\n") === 'MARIO-PLUS');
check('cifre ammesse', signupCodeNormalize('amici2027') === 'AMICI2027');
check('4 caratteri: ammesso', signupCodeNormalize('abcd') === 'ABCD');
check('3 caratteri: no', signupCodeNormalize('abc') === null);
check('40 caratteri: ammesso', signupCodeNormalize(str_repeat('a', 40)) === str_repeat('A', 40));
check('41 caratteri: no', signupCodeNormalize(str_repeat('a', 41)) === null);
check('spazio in mezzo: no', signupCodeNormalize('mario plus') === null);
check('underscore: no', signupCodeNormalize('mario_plus') === null);
check('lettera accentata: no', signupCodeNormalize('perché') === null);
check('stringa vuota: no', signupCodeNormalize('') === null);
check('non stringa (numero): no', signupCodeNormalize(12345) === null);
check('null: no', signupCodeNormalize(null) === null);
check('array: no', signupCodeNormalize(array('abcd')) === null);
check('solo spazi: no', signupCodeNormalize('     ') === null);

echo "Codice generato dal server\n";
$gen = array();
for ($i = 0; $i < 300; $i++) {
    $gen[] = signupCodeGenerate();
}
check('10 caratteri', count(array_filter($gen, function ($c) { return strlen($c) === 10; })) === 300);
check('mai 0, O, 1, I', count(array_filter($gen, function ($c) { return preg_match('/[01OI]/', $c) === 1; })) === 0);
check('solo lettere maiuscole e cifre', count(array_filter($gen, function ($c) { return preg_match('/^[A-Z2-9]{10}$/', $c) === 1; })) === 300);
check('un codice generato è già normalizzato', count(array_filter($gen, function ($c) { return signupCodeNormalize($c) === $c; })) === 300);
check('i codici non sono sempre gli stessi', count(array_unique($gen)) > 250);

echo "Posti occupati\n";
$use = function ($status, $userExists, $createdTs) {
    return array('status' => $status, 'user_exists' => $userExists, 'user_created_ts' => $createdTs);
};
check('nessun uso: 0', signupCodeSeatsTaken(array(), $t0) === 0);
check('applied conta', signupCodeSeatsTaken(array($use('applied', true, $t0 - 30 * DAY)), $t0) === 1);
check('applied con account eliminato conta ancora', signupCodeSeatsTaken(array($use('applied', false, null)), $t0) === 1);
check('pending recente con utente conta', signupCodeSeatsTaken(array($use('pending', true, $t0 - DAY)), $t0) === 1);
check('pending a 7 giorni meno un secondo conta', signupCodeSeatsTaken(array($use('pending', true, $t0 - 7 * DAY + 1)), $t0) === 1);
check('pending a 7 giorni esatti non conta più', signupCodeSeatsTaken(array($use('pending', true, $t0 - 7 * DAY)), $t0) === 0);
check('pending vecchio non conta', signupCodeSeatsTaken(array($use('pending', true, $t0 - 20 * DAY)), $t0) === 0);
check('pending con account eliminato non conta', signupCodeSeatsTaken(array($use('pending', false, null)), $t0) === 0);
check('missed non conta', signupCodeSeatsTaken(array($use('missed', true, $t0 - DAY)), $t0) === 0);
check('somma di più usi', signupCodeSeatsTaken(array(
    $use('applied', true, $t0 - 40 * DAY), $use('applied', false, null), $use('pending', true, $t0 - 2 * DAY),
    $use('pending', true, $t0 - 9 * DAY), $use('pending', false, null), $use('missed', true, $t0 - 8 * DAY),
), $t0) === 3);

echo "Si può usare in registrazione?\n";
$code = array('enabled' => 1, 'max_uses' => 2, 'expires_at' => null);
check('codice buono con posti liberi: ok', signupCodeRegistrationCheck($code, 1, $nowUtc($t0)) === 'ok');
check('inesistente: invalid', signupCodeRegistrationCheck(null, 0, $nowUtc($t0)) === 'invalid');
check('spento: invalid (come inesistente)', signupCodeRegistrationCheck(array('enabled' => 0) + $code, 0, $nowUtc($t0)) === 'invalid');
check('esaurito: exhausted', signupCodeRegistrationCheck($code, 2, $nowUtc($t0)) === 'exhausted');
check('più usi dei posti (posti ridotti dopo): exhausted', signupCodeRegistrationCheck($code, 5, $nowUtc($t0)) === 'exhausted');
$exp = array('expires_at' => $nowUtc($t0 + DAY)) + $code;
check('scadenza domani: ok', signupCodeRegistrationCheck($exp, 0, $nowUtc($t0)) === 'ok');
check('un secondo prima della scadenza: ok', signupCodeRegistrationCheck($exp, 0, $nowUtc($t0 + DAY - 1)) === 'ok');
check('alla scadenza: expired', signupCodeRegistrationCheck($exp, 0, $nowUtc($t0 + DAY)) === 'expired');
check('scaduto ed esaurito: expired', signupCodeRegistrationCheck($exp, 2, $nowUtc($t0 + 2 * DAY)) === 'expired');
check('spento e scaduto: invalid', signupCodeRegistrationCheck(array('enabled' => 0) + $exp, 0, $nowUtc($t0 + 2 * DAY)) === 'invalid');

echo "Alla conferma dell'email\n";
$created = $t0;
check('entro i 7 giorni, codice acceso: applied', signupCodeConfirmOutcome($code, 99, $created, $t0 + 2 * DAY) === 'applied');
check('entro i 7 giorni, posti ora tutti occupati: applied (il posto è garantito)', signupCodeConfirmOutcome($code, 2, $created, $t0 + 2 * DAY) === 'applied');
check('entro i 7 giorni, codice scaduto nel frattempo: applied', signupCodeConfirmOutcome($exp, 0, $created, $t0 + 3 * DAY) === 'applied');
check('entro i 7 giorni, codice spento nel frattempo: missed', signupCodeConfirmOutcome(array('enabled' => 0) + $code, 0, $created, $t0 + 2 * DAY) === 'missed');
check('codice sparito: missed', signupCodeConfirmOutcome(null, 0, $created, $t0 + 2 * DAY) === 'missed');
check('un secondo prima dei 7 giorni, posti pieni: applied', signupCodeConfirmOutcome($code, 2, $created, $t0 + 7 * DAY - 1) === 'applied');
check('a 7 giorni esatti, posto libero: applied', signupCodeConfirmOutcome($code, 1, $created, $t0 + 7 * DAY) === 'applied');
check('a 7 giorni esatti, senza posto: missed', signupCodeConfirmOutcome($code, 2, $created, $t0 + 7 * DAY) === 'missed');
check('dopo 7 giorni, posto libero ma codice scaduto: missed', signupCodeConfirmOutcome($exp, 0, $created, $t0 + 8 * DAY) === 'missed');
check('dopo 7 giorni, posto libero ma codice spento: missed', signupCodeConfirmOutcome(array('enabled' => 0) + $code, 0, $created, $t0 + 8 * DAY) === 'missed');
check('dopo 7 giorni, codice buono e posto libero: applied', signupCodeConfirmOutcome($code, 0, $created, $t0 + 30 * DAY) === 'applied');

echo "Ultimo giorno del livello\n";
// Conferma a mezzogiorno UTC del 20 marzo 2027 = 13:00 a Roma: giorno italiano 20 marzo
check('90 giorni dal 20 marzo: 18 giugno', signupCodeLastDay(90, $t0) === '2027-06-18');
check('1 giorno: 21 marzo', signupCodeLastDay(1, $t0) === '2027-03-21');
// 23:30 UTC del 20 marzo = 00:30 italiano del 21: il giorno italiano è il 21
check('il giorno è quello italiano (23:30 UTC = 00:30 del giorno dopo a Roma)', signupCodeLastDay(1, gmmktime(23, 30, 0, 3, 20, 2027)) === '2027-03-22');
// 22:30 UTC del 20 marzo (ora solare, +1) = 23:30 italiano del 20
check('22:30 UTC di gennaio = 23:30 italiano, stesso giorno', signupCodeLastDay(0, gmmktime(22, 30, 0, 1, 20, 2027)) === '2027-01-20');
check('23:30 UTC di gennaio = 00:30 italiano, giorno dopo', signupCodeLastDay(0, gmmktime(23, 30, 0, 1, 20, 2027)) === '2027-01-21');
check('22:30 UTC d\'estate = 00:30 italiano, giorno dopo', signupCodeLastDay(0, gmmktime(22, 30, 0, 7, 20, 2027)) === '2027-07-21');

echo "Livello dato dal codice (regola di dominanza: il codice non peggiora mai l'account)\n";
$now = $t0;
$nowS = $nowUtc($now);
$r = signupCodeTierOutcome('plus', 90, 'free', null, $now);
check('account Gratis, Plus 90 giorni: assegnato', $r['changed'] === true && $r['tier'] === 'plus');
check('  scadenza = giorno dopo l\'ultimo giorno, 00:00 italiane (UTC)', $r['until'] === '2027-06-18 22:00:00');
check('  ultimo giorno 18 giugno', tierLastDay($r['until']) === '2027-06-18');
$r = signupCodeTierOutcome('pro', null, 'free', null, $now);
check('Gratis, Pro per sempre: assegnato senza scadenza', $r['changed'] === true && $r['tier'] === 'pro' && $r['until'] === null);
$r = signupCodeTierOutcome('plus', 90, 'plus', $nowUtc($now + 10 * DAY), $now);
check('Plus che scade tra 10 giorni + codice Plus 90: Plus 90 (stesso livello, scadenza più lontana)', $r['changed'] === true && $r['tier'] === 'plus' && tierLastDay($r['until']) === '2027-06-18');
$r = signupCodeTierOutcome('pro', 30, 'plus', null, $now);
check('Plus per sempre + codice Pro 30: resta Plus per sempre (la scadenza del codice è meno lontana)', $r['changed'] === false && $r['tier'] === 'plus' && $r['until'] === null);
$r = signupCodeTierOutcome('plus', 30, 'pro', $nowUtc($now + 5 * DAY), $now);
check('Pro che scade tra 5 giorni + codice Plus 30: resta Pro 5 giorni (livello inferiore)', $r['changed'] === false && $r['tier'] === 'pro' && $r['until'] === $nowUtc($now + 5 * DAY));
$until30 = signupCodeTierOutcome('pro', 30, 'free', null, $now)['until'];
$r = signupCodeTierOutcome('pro', 30, 'plus', $until30, $now);
check('Plus che scade come il codice + codice Pro 30: Pro 30 (livello superiore, stessa scadenza)', $r['changed'] === true && $r['tier'] === 'pro' && $r['until'] === $until30);
$r = signupCodeTierOutcome('pro', 30, 'plus', $nowUtc($now + 10 * DAY), $now);
check('Plus 10 giorni + codice Pro 30: Pro 30', $r['changed'] === true && $r['tier'] === 'pro' && tierLastDay($r['until']) === '2027-04-19');
$r = signupCodeTierOutcome('plus', 30, 'pro', null, $now);
check('Pro per sempre + codice Plus: resta', $r['changed'] === false && $r['tier'] === 'pro');
$r = signupCodeTierOutcome('pro', null, 'pro', null, $now);
check('identico (Pro per sempre + codice Pro per sempre): non cambia nulla', $r['changed'] === false);
$r = signupCodeTierOutcome('plus', 30, 'plus', $until30, $now);
check('identico (stesso livello, stessa scadenza): non cambia nulla', $r['changed'] === false && $r['until'] === $until30);
$r = signupCodeTierOutcome('plus', null, 'plus', $nowUtc($now + 10 * DAY), $now);
check('Plus che scade + codice Plus per sempre: diventa senza scadenza', $r['changed'] === true && $r['until'] === null);
$r = signupCodeTierOutcome('plus', 30, 'plus', $nowUtc($now - DAY), $now);
check('Plus scaduto ieri conta come Gratis: assegnato il codice', $r['changed'] === true && $r['tier'] === 'plus');
$r = signupCodeTierOutcome('plus', 30, 'pro', $nowUtc($now - DAY), $now);
check('Pro scaduto + codice Plus: assegnato il codice', $r['changed'] === true && $r['tier'] === 'plus');
$r = signupCodeTierOutcome('plus', 30, 'free', $nowUtc($now + 3 * DAY), $now);
check('free con tier_until residuo: assegnato', $r['changed'] === true && $r['tier'] === 'plus');
$r = signupCodeTierOutcome('plus', 30, 'valore-strano', null, $now);
check('livello salvato non valido conta come Gratis: assegnato', $r['changed'] === true);
$r = signupCodeTierOutcome('plus', 10, 'free', null, gmmktime(10, 0, 0, 3, 20, 2027));
check('10 giorni da marzo (ora solare): scade alla mezzanotte italiana (ora legale)', $r['until'] === '2027-03-30 22:00:00');

echo "Giorno -> istante di fine (tierUntilFromDay, estratta da tierSetUntil)\n";
$r = tierUntilFromDay('2027-06-18', $nowS);
check('18 giugno: 22:00 UTC (00:00 italiane del 19)', $r === ['until' => '2027-06-18 22:00:00']);
check('giorno malformato: errore', isset(tierUntilFromDay('2027-13-45', $nowS)['error']));
check('giorno passato: errore', isset(tierUntilFromDay('2020-01-01', $nowS)['error']));
check('tierSetUntil dà lo stesso istante', tierSetUntil('plus', '2027-06-18', $nowS) === ['until' => '2027-06-18 22:00:00']);

echo "\nCONTROLLI $checks FALLITI $fails\n";
exit($fails > 0 ? 1 : 0);
