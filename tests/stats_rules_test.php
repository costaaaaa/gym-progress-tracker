<?php
// Valori delle misure corporee (backend/lib/stats_rules.php): limiti, primo campo non valido e
// messaggio d'errore che nomina il campo nella lingua dell'utente. Nessun database.
// Si lancia con tests/stats_rules.sh. Esce con 1 se un controllo fallisce.

require __DIR__ . '/../backend/config/api_helpers.php';
require __DIR__ . '/../backend/lib/stats_rules.php';

$fails = 0;
$checks = 0;
function check($desc, $expected, $got)
{
    global $fails, $checks;
    $checks++;
    if ($expected === $got) {
        echo "  \033[32m✓\033[0m $desc\n";
    } else {
        $fails++;
        echo "  \033[31m✗\033[0m $desc\n";
        echo '      atteso:   ' . var_export($expected, true) . "\n";
        echo '      ottenuto: ' . var_export($got, true) . "\n";
    }
}
function body($json)
{
    return json_decode($json);
}

echo "Limiti\n";
check('i campi sono quelli del modulo, nell\'ordine', array(
    'weight', 'body_fat_percentage', 'muscle_mass_percentage', 'chest_size', 'arm_size', 'waist_size', 'leg_size',
), array_keys(STATS_LIMITS));
foreach (STATS_LIMITS as $field => $max) {
    $at = (object) array($field => $max);
    $over = (object) array($field => $max + 0.1);
    check("$field: il tetto ($max) è incluso", null, stats_invalid_field($at));
    check("$field: appena oltre il tetto non va", $field, stats_invalid_field($over));
    check("$field: zero è ammesso", null, stats_invalid_field((object) array($field => 0)));
}

echo "Primo campo non valido\n";
check('niente di strano: nessun errore', null, stats_invalid_field(body('{"date":"2026-11-01","weight":80.5,"waist_size":"90"}')));
check('campi vuoti o null sono ignorati', null, stats_invalid_field(body('{"weight":"","body_fat_percentage":null}')));
check('i tetti sono inclusi', null, stats_invalid_field(body('{"weight":500,"leg_size":200,"chest_size":0}')));
check('peso oltre il tetto', 'weight', stats_invalid_field(body('{"weight":500.1}')));
check('numero negativo', 'arm_size', stats_invalid_field(body('{"arm_size":-1}')));
check('testo al posto del numero', 'waist_size', stats_invalid_field(body('{"waist_size":"abc"}')));
check('con due campi sbagliati vale il primo dell\'elenco', 'weight', stats_invalid_field(body('{"leg_size":999,"weight":999}')));

echo "Messaggio nella lingua dell'utente\n";
$it = stats_invalid_value('weight', 'it');
check('italiano: nomina il campo tradotto e i limiti', 'Peso: il valore deve essere tra 0 e 500, estremi inclusi.', $it['message']);
check('italiano: il nome tecnico del campo viaggia a parte', 'weight', $it['field']);
check('il tetto viaggia a parte', 500, $it['max']);
$en = stats_invalid_value('body_fat_percentage', 'en');
check('inglese: campo tradotto', 'Body fat: the value must be between 0 and 100, inclusive.', $en['message']);
foreach (array_keys(STATS_LIMITS) as $field) {
    foreach (array('it', 'en') as $lang) {
        $msg = stats_invalid_value($field, $lang)['message'];
        check("$field in $lang: il nome del campo non compare grezzo", false, str_contains($msg, $field) && str_contains($field, '_'));
        check("$field in $lang: nessuna chiave senza traduzione", false, str_contains($msg, 'stats.'));
    }
}

echo "\n$checks controlli, $fails falliti\n";
exit($fails ? 1 : 0);
