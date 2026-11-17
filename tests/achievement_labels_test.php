<?php
// Nomi dei traguardi (backend/lib/gamification_rules.php + backend/lang): ogni chiave del catalogo ha
// il nome in italiano e in inglese, i nomi sono quelli approvati e il catalogo non li ripete.
// Si lancia con tests/achievement_labels.sh. Esce con 1 se un controllo fallisce.

require __DIR__ . '/../backend/config/api_helpers.php';
require __DIR__ . '/../backend/lib/gamification_rules.php';

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

$it = [
    'sessions_10' => 'Prime 10 sessioni', 'sessions_50' => '50 sessioni', 'sessions_100' => 'Centurione', 'sessions_250' => '250 sessioni',
    'tonnage_auto' => '1,5 t — automobile', 'tonnage_elephant' => '6 t — elefante', 'tonnage_bus' => '15 t — autobus',
    'tonnage_tank' => '60 t — carro armato', 'tonnage_whale' => '150 t — balenottera azzurra', 'tonnage_iss' => '420 t — Stazione Spaziale',
    'tonnage_shuttle' => '2.000 t — Space Shuttle', 'tonnage_eiffel' => '7.300 t — Torre Eiffel',
    'strength_60' => '60 kg in un esercizio', 'strength_100' => '100 kg in un esercizio', 'strength_140' => '140 kg in un esercizio',
    'streak_4' => '4 settimane consecutive', 'streak_8' => '8 settimane consecutive', 'streak_12' => '12 settimane consecutive', 'streak_24' => '24 settimane consecutive',
];
$en = [
    'sessions_10' => 'First 10 sessions', 'sessions_50' => '50 sessions', 'sessions_100' => 'Centurion', 'sessions_250' => '250 sessions',
    'tonnage_auto' => '1.5 t — a car', 'tonnage_elephant' => '6 t — an elephant', 'tonnage_bus' => '15 t — a city bus',
    'tonnage_tank' => '60 t — a battle tank', 'tonnage_whale' => '150 t — a blue whale', 'tonnage_iss' => '420 t — the Space Station',
    'tonnage_shuttle' => '2,000 t — a Space Shuttle', 'tonnage_eiffel' => '7,300 t — the Eiffel Tower',
    'strength_60' => '60 kg on one exercise', 'strength_100' => '100 kg on one exercise', 'strength_140' => '140 kg on one exercise',
    'streak_4' => '4 weeks in a row', 'streak_8' => '8 weeks in a row', 'streak_12' => '12 weeks in a row', 'streak_24' => '24 weeks in a row',
];

$keys = array_column(achievementCatalog(), 'key');
echo "Catalogo\n";
check('il catalogo ha 19 traguardi', count($keys) === 19);
check('le chiavi sono quelle di sempre', $keys === array_keys($it));
check('il catalogo non ha più le etichette scritte dentro', array_filter(achievementCatalog(), fn($e) => array_key_exists('label', $e)) === []);

echo "Nomi\n";
foreach (['it' => $it, 'en' => $en] as $lang => $expected) {
    $strings = require __DIR__ . '/../backend/lang/' . $lang . '.php';
    $own = array_keys(array_filter($strings, fn($k) => str_starts_with($k, 'achievement.'), ARRAY_FILTER_USE_KEY));
    check("$lang: nessuna chiave achievement.* oltre al catalogo", $own === array_map(fn($k) => "achievement.$k", $keys));
    $got = [];
    foreach ($keys as $key) {
        $got[$key] = achievementLabel($key, $lang);
    }
    check("$lang: i 19 nomi sono quelli approvati", $got === $expected);
}
check('lingua sconosciuta: ripiego in italiano', achievementLabel('sessions_100', 'fr') === 'Centurione');
check('chiave sconosciuta: ritorna la chiave', achievementLabel('nope_1', 'en') === 'nope_1');

echo "\nCONTROLLI $checks FALLITI $fails\n";
exit($fails > 0 ? 1 : 0);
