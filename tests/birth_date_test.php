<?php
// Data di nascita lato server: birth_date_error() rifiuta formato sbagliato, date future, meno di 14 anni
// e più di 100 anni (stesso limite del selettore del client). Il "giorno di oggi" è quello dell'utente
// (header X-Timezone, vedi user_today()): i controlli di confine si ripetono per sei fusi utente, tra
// cui i due estremi Pacific/Kiritimati (+14) e Pacific/Pago_Pago (-11). Il fuso del server è quello di
// PHP (date.timezone), passato come argomento e controllato.
// Si lancia con tests/birth_date.sh. Esce con 1 se un controllo fallisce.

require __DIR__ . '/../backend/config/api_helpers.php';

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

// Senza argomento il controllo sul fuso del server si salta (tests/birth_date.sh lo passa).
$server_tz = $argv[1] ?? date_default_timezone_get();
if (isset($argv[1])) {
    check("il fuso di PHP è $server_tz", date_default_timezone_get() === $server_tz);
}

$invalid = t_server('birth.invalid');
$young = t_server('birth.too_young');

// Data di $n anni prima di $today (DateTime), calcolata a mano senza modify() sugli anni. Un 29 febbraio
// in un anno non bisestile diventa 28 febbraio.
function years_ago_date($today, $n)
{
    $year = (int) $today->format('Y') - $n;
    $md = $today->format('m-d');
    if ($md === '02-29' && !checkdate(2, 29, $year)) {
        $md = '02-28';
    }
    return sprintf('%04d-%s', $year, $md);
}

$day = function ($date, $delta) {
    return (new DateTime($date))->modify($delta . ' day')->format('Y-m-d');
};

echo "\nyears_ago_date con oggi 2028-02-29\n";
$leap_day = new DateTime('2028-02-29');
check('14 anni: 2014-02-28', years_ago_date($leap_day, 14) === '2014-02-28');
check('13 anni: 2015-02-28', years_ago_date($leap_day, 13) === '2015-02-28');
check('100 anni: 1928-02-29', years_ago_date($leap_day, 100) === '1928-02-29');
check('30 anni: 1998-02-28', years_ago_date($leap_day, 30) === '1998-02-28');

foreach (array('UTC', 'Europe/Rome', 'America/Los_Angeles', 'Asia/Tokyo', 'Pacific/Kiritimati', 'Pacific/Pago_Pago') as $user_tz) {
    $_SERVER['HTTP_X_TIMEZONE'] = $user_tz;
    request_time_zone(true);
    $today = user_today();
    // Date attese calcolate a mano dal giorno dell'utente, senza passare da modify() sugli anni.
    $tomorrow = (new DateTime((new DateTime('now', new DateTimeZone($user_tz)))->format('Y-m-d')))->modify('+1 day')->format('Y-m-d');
    $hundred = years_ago_date($today, 100);

    echo "\nbirth_date_error, fuso server $server_tz, fuso utente $user_tz (oggi " . $today->format('Y-m-d') . ")\n";
    check('il giorno dell\'utente segue il suo fuso', $today->format('Y-m-d') === (new DateTime('now', new DateTimeZone($user_tz)))->format('Y-m-d'));
    check('30 anni fa: valida', birth_date_error(years_ago_date($today, 30)) === null);
    check('esattamente 100 anni fa: valida', birth_date_error($hundred) === null);
    check('100 anni e un giorno fa: non valida', birth_date_error($day($hundred, -1)) === $invalid);
    check('99 anni e 364 giorni fa: valida', birth_date_error($day($hundred, 1)) === null);
    check('0085-07-21 (anno a due cifre): non valida', birth_date_error('0085-07-21') === $invalid);
    check('14 anni fa: valida', birth_date_error(years_ago_date($today, 14)) === null);
    check('13 anni fa: troppo giovane', birth_date_error(years_ago_date($today, 13)) === $young);
    check('oggi: troppo giovane', birth_date_error($today->format('Y-m-d')) === $young);
    check('domani: non valida', birth_date_error($tomorrow) === $invalid);
    check('formato sbagliato: non valida', birth_date_error('21/07/1990') === $invalid);
    check('data inesistente: non valida', birth_date_error('1990-02-30') === $invalid);
    check('non stringa: non valida', birth_date_error(null) === $invalid);
}

echo "\n$checks controlli, $fails falliti\n";
exit($fails ? 1 : 0);
