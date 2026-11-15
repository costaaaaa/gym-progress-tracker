<?php
// Data di nascita lato server: birth_date_error() rifiuta formato sbagliato, date future, meno di 14 anni
// e più di 100 anni (stesso limite del selettore del client). Il fuso si sceglie con la variabile TZ.
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

date_default_timezone_set(getenv('TZ') ?: 'Europe/Rome');

$invalid = t_server('birth.invalid');
$young = t_server('birth.too_young');
$today = user_today();
$ago = function ($modifier) use ($today) {
    return (clone $today)->modify($modifier)->format('Y-m-d');
};

echo "birth_date_error (fuso " . date_default_timezone_get() . ")\n";
check('30 anni fa: valida', birth_date_error($ago('-30 years')) === null);
check('esattamente 100 anni fa: valida', birth_date_error($ago('-100 years')) === null);
check('100 anni e un giorno fa: non valida', birth_date_error($ago('-100 years -1 day')) === $invalid);
check('0085-07-21 (anno a due cifre): non valida', birth_date_error('0085-07-21') === $invalid);
check('14 anni fa: valida', birth_date_error($ago('-14 years')) === null);
check('13 anni fa: troppo giovane', birth_date_error($ago('-13 years')) === $young);
check('domani: non valida', birth_date_error($ago('+1 day')) === $invalid);
check('formato sbagliato: non valida', birth_date_error('21/07/1990') === $invalid);
check('data inesistente: non valida', birth_date_error('1990-02-30') === $invalid);
check('non stringa: non valida', birth_date_error(null) === $invalid);

echo "\n$checks controlli, $fails falliti\n";
exit($fails ? 1 : 0);
