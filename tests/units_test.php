<?php
// Conversioni di peso e lunghezza dell'export (backend/lib/units.php) contro la fixture generata dai moduli JS
// (tests/fixtures/units_cases.json, da src/utils/unitsFixture.test.js): stessi numeri, confronto esatto.
// Nessun database. Si lancia con tests/units.sh. Esce con 1 se un controllo fallisce.

require __DIR__ . '/../backend/lib/units.php';

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

$fixture = json_decode(file_get_contents(__DIR__ . '/fixtures/units_cases.json'), true);

// Il valore come arriva da PDO (decimal(5,2) → testo) e poi come numero
function db_text($cents)
{
    return number_format($cents / 100, 2, '.', '');
}
$converters = array(
    'weight_quarter' => function ($kg) { return units_kg_to_lb($kg, 4); },
    'weight_tenth' => function ($kg) { return units_kg_to_lb($kg, 10); },
    'length_tenth' => function ($cm) { return units_cm_to_in($cm); },
);

echo "Valori noti (dal JS)\n";
$bad = array();
foreach ($fixture['points'] as $p) {
    $got = $converters[$p['kind']]((float)$p['input']);
    if ($got !== (float)$p['expected']) $bad[] = $p['kind'] . ' ' . $p['input'] . ': atteso ' . $p['expected'] . ', ottenuto ' . var_export($got, true);
}
check(count($fixture['points']) . ' valori noti uguali al JS', array(), $bad);

echo "Griglie (dal JS)\n";
foreach ($converters as $name => $convert) {
    $expected = $fixture['grids'][$name];
    $bad = array();
    foreach ($expected as $cents => $want) {
        $got = $convert((float)db_text($cents));
        if ($got !== (float)$want) {
            $bad[] = db_text($cents) . ': atteso ' . $want . ', ottenuto ' . var_export($got, true);
            if (count($bad) >= 5) break;
        }
    }
    check("$name: " . count($expected) . ' valori uguali al JS', array(), $bad);
}

echo "Arrotondamento come Math.round\n";
check('mezzi per eccesso', array(3.0, 1.0, 0.0, -2.0, 2.0), array(units_js_round(2.5), units_js_round(0.5), units_js_round(0.49999999999999994), units_js_round(-2.5), units_js_round(1.5)));

echo "Testo d'uscita\n";
// kg: il testo del database com'è (stesso tipo e formato di prima)
check('kg: peso invariato', '80.00', units_export_weight('80.00', 'kg'));
check('kg: peso corporeo invariato', '82.50', units_export_weight('82.50', 'kg', 10));
check('kg: lunghezza invariata', '83.25', units_export_length('83.25', 'kg'));
check('kg: nullo resta nullo', null, units_export_weight(null, 'kg'));
// lb: testo con due decimali, come le colonne decimal(5,2)
check('lb: 100 kg → 220.50', '220.50', units_export_weight('100.00', 'lb'));
check('lb: 80 kg → 176.25', '176.25', units_export_weight('80.00', 'lb'));
check('lb: 83.25 kg corporeo → 183.50', '183.50', units_export_weight('83.25', 'lb', 10));
check('lb: 0 resta 0.00', '0.00', units_export_weight('0.00', 'lb'));
check('lb: nullo resta nullo', null, units_export_weight(null, 'lb'));
check('in: 83.25 cm → 32.80', '32.80', units_export_length('83.25', 'lb'));
check('in: nullo resta nullo', null, units_export_length(null, 'lb'));
check('intestazione kg', array('weight' => 'kg', 'length' => 'cm'), units_export_header('kg'));
check('intestazione lb', array('weight' => 'lb', 'length' => 'in'), units_export_header('lb'));
check('unità non valida vale kg', array('weight' => 'kg', 'length' => 'cm'), units_export_header('st'));
check('unità non valida: valori invariati', '80.00', units_export_weight('80.00', 'st'));

echo "\nCONTROLLI $checks FALLITI $fails\n";
exit($fails > 0 ? 1 : 0);
