<?php
// Conversioni di peso e lunghezza dell'export (backend/lib/units.php) contro la fixture generata dai moduli JS
// (tests/fixtures/units_cases.json, da src/utils/unitsFixture.test.js): stessi numeri, confronto esatto.
// Nessun database. Si lancia con tests/units.sh. Esce con 1 se un controllo fallisce.

require __DIR__ . '/../backend/lib/units.php';

$fails = 0;
$checks = 0;
function eq($desc, $expected, $got)
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
eq(count($fixture['points']) . ' valori noti uguali al JS', array(), $bad);

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
    eq("$name: " . count($expected) . ' valori uguali al JS', array(), $bad);
}

echo "Griglie rade oltre i 300\n";
foreach (array('weight_quarter', 'weight_tenth') as $name) {
    $g = $fixture['sparse'][$name];
    $bad = array();
    foreach ($g['expected'] as $i => $want) {
        $cents = $g['from_cents'] + $i * $g['step_cents'];
        $got = $converters[$name]((float)db_text($cents));
        if ($got !== (float)$want) {
            $bad[] = db_text($cents) . ': atteso ' . $want . ', ottenuto ' . var_export($got, true);
            if (count($bad) >= 5) break;
        }
    }
    eq("$name oltre 300: " . count($g['expected']) . ' valori uguali al JS (da ' . db_text($g['from_cents']) . ')', array(), $bad);
}

echo "Arrotondamento come Math.round\n";
eq('mezzi per eccesso', array(3.0, 1.0, 0.0, 2.0), array(units_js_round(2.5), units_js_round(0.5), units_js_round(0.49999999999999994), units_js_round(1.5)));

echo "Testo d'uscita\n";
// kg: il testo del database com'è (stesso tipo e formato di prima)
eq('kg: peso invariato', '80.00', units_export_weight('80.00', 'kg'));
eq('kg: peso corporeo invariato', '82.50', units_export_weight('82.50', 'kg', 10));
eq('kg: lunghezza invariata', '83.25', units_export_length('83.25', 'kg'));
eq('kg: nullo resta nullo', null, units_export_weight(null, 'kg'));
// lb: testo con due decimali, come le colonne decimal(5,2)
eq('lb: 100 kg → 220.50', '220.50', units_export_weight('100.00', 'lb'));
eq('lb: 80 kg → 176.25', '176.25', units_export_weight('80.00', 'lb'));
eq('lb: 83.25 kg corporeo → 183.50', '183.50', units_export_weight('83.25', 'lb', 10));
eq('lb: 0 resta 0.00', '0.00', units_export_weight('0.00', 'lb'));
eq('lb: nullo resta nullo', null, units_export_weight(null, 'lb'));
eq('in: 83.25 cm → 32.80', '32.80', units_export_length('83.25', 'lb'));
eq('in: nullo resta nullo', null, units_export_length(null, 'lb'));
eq('intestazione kg', array('weight' => 'kg', 'length' => 'cm'), units_export_header('kg'));
eq('intestazione lb', array('weight' => 'lb', 'length' => 'in'), units_export_header('lb'));
eq('unità non valida vale kg', array('weight' => 'kg', 'length' => 'cm'), units_export_header('st'));
eq('unità non valida: valori invariati', '80.00', units_export_weight('80.00', 'st'));

echo "\nCONTROLLI $checks FALLITI $fails\n";
exit($fails > 0 ? 1 : 0);
