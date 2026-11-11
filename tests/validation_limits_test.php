<?php
// Regole pure di validazione e limiti: identificatore intero positivo. Nessun database. Si lancia con tests/validation_limits.sh.

require __DIR__ . '/../backend/lib/id_rules.php';

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

echo "Identificatore intero positivo\n";
$accepted = array(
    'intero' => array(12, 12),
    'stringa di cifre' => array('12', 12),
    'stringa con zeri iniziali' => array('012', 12),
    'massimo di int(11)' => array(2147483647, 2147483647),
);
foreach ($accepted as $desc => list($value, $want)) {
    check("$desc: accettato", $want, parse_positive_id($value));
}
$rejected = array(
    'cifre seguite da lettere' => '12abc',
    'decimale in stringa' => '12.7',
    'decimale' => 12.7,
    'decimale intero' => 12.0,
    'negativo' => -3,
    'negativo in stringa' => '-3',
    'zero' => 0,
    'zero in stringa' => '0',
    'vuoto' => '',
    'spazi attorno' => ' 12 ',
    'a capo finale' => "12\n",
    'booleano' => true,
    'array' => array(12),
    'oggetto' => (object) array('id' => 12),
    'null' => null,
    'oltre int(11)' => 2147483648,
    'oltre int(11) in stringa' => '99999999999999999999',
);
foreach ($rejected as $desc => $value) {
    check("$desc: rifiutato", null, parse_positive_id($value));
}

echo $fails === 0 ? "\nTUTTO OK ($checks controlli)\n" : "\nFALLITI $fails su $checks\n";
exit($fails === 0 ? 0 : 1);
