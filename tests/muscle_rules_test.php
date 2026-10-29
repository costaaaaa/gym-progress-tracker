<?php
// Regole del muscolo principale (backend/lib/muscle_rules.php), senza database.
// Si lancia con tests/muscle_rules.sh. Esce con 1 se un controllo fallisce.

require __DIR__ . '/../backend/lib/muscle_rules.php';

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

echo "Muscoli contati (ordine del corpo)\n";
check('12 muscoli, adduttori e abduttori dopo glutei', COUNTED_MUSCLES === [
    'petto', 'schiena', 'spalle', 'bicipiti', 'tricipiti', 'addome',
    'quadricipiti', 'femorali', 'glutei', 'adduttori', 'abduttori', 'polpacci',
]);

echo "Normalizzazione del gruppo (muscleNormalizeGroup)\n";
check('petto resta petto', muscleNormalizeGroup('petto') === 'petto');
check('dorsali → schiena', muscleNormalizeGroup('dorsali') === 'schiena');
check('lat → schiena', muscleNormalizeGroup('lat') === 'schiena');
check('tricipite → tricipiti', muscleNormalizeGroup('tricipite') === 'tricipiti');
check('bicipite → bicipiti', muscleNormalizeGroup('bicipite') === 'bicipiti');
check('quadricipite → quadricipiti', muscleNormalizeGroup('quadricipite') === 'quadricipiti');
check('femorale → femorali', muscleNormalizeGroup('femorale') === 'femorali');
check('gluteo → glutei', muscleNormalizeGroup('gluteo') === 'glutei');
check('polpaccio → polpacci', muscleNormalizeGroup('polpaccio') === 'polpacci');
check('addominali → addome', muscleNormalizeGroup('addominali') === 'addome');
check('gambe non si normalizza da solo (null)', muscleNormalizeGroup('gambe') === null);
check('gruppo sconosciuto → null', muscleNormalizeGroup('boh') === null);
check('maiuscole indifferenti', muscleNormalizeGroup('ADDOMINALI') === 'addome');

echo "Opzioni ammesse per gruppo (muscleAllowedOptions)\n";
check('gambe: 5 opzioni, nessun default', muscleAllowedOptions('gambe') === ['quadricipiti', 'femorali', 'glutei', 'adduttori', 'abduttori']);
check('glutei: glutei (default) o abduttori', muscleAllowedOptions('glutei') === ['glutei', 'abduttori']);
check('petto: solo petto', muscleAllowedOptions('petto') === ['petto']);
check('addominali: solo addome (normalizzato)', muscleAllowedOptions('addominali') === ['addome']);
check('quadricipiti (gruppo, non gambe): solo quadricipiti', muscleAllowedOptions('quadricipiti') === ['quadricipiti']);
check('femorali: solo femorali', muscleAllowedOptions('femorali') === ['femorali']);

echo "Risoluzione/validazione del primary_muscle (muscleResolvePrimary)\n";
check('gambe senza scelta → null (obbligatorio)', muscleResolvePrimary('gambe', null) === null);
check('gambe con scelta valida → quella scelta', muscleResolvePrimary('gambe', 'adduttori') === 'adduttori');
check('gambe, maiuscole indifferenti', muscleResolvePrimary('gambe', 'ADDUTTORI') === 'adduttori');
check('gambe con scelta non ammessa → null', muscleResolvePrimary('gambe', 'polpacci') === null);
check('glutei senza scelta → glutei (default)', muscleResolvePrimary('glutei', null) === 'glutei');
check('glutei con abduttori → abduttori', muscleResolvePrimary('glutei', 'abduttori') === 'abduttori');
check('glutei con valore non ammesso → null', muscleResolvePrimary('glutei', 'quadricipiti') === null);
check('petto senza scelta → derivato dal gruppo', muscleResolvePrimary('petto', null) === 'petto');
check('petto con scelta esplicita coerente → accettata', muscleResolvePrimary('petto', 'petto') === 'petto');
check('petto con scelta diversa dal gruppo → null', muscleResolvePrimary('petto', 'schiena') === null);
check('addominali senza scelta → addome (via normalizzazione)', muscleResolvePrimary('addominali', null) === 'addome');
check('stringa vuota equivale a nessuna scelta', muscleResolvePrimary('glutei', '') === 'glutei');

echo "Muscolo contato di una riga (muscleCountedOf)\n";
check('primary_muscle null → non contato', muscleCountedOf(null) === null);
check('primary_muscle vuoto → non contato', muscleCountedOf('') === null);
check('quadricipiti → contato', muscleCountedOf('quadricipiti') === 'quadricipiti');
check('adduttori → contato', muscleCountedOf('adduttori') === 'adduttori');
check('maiuscole indifferenti', muscleCountedOf('ADDUTTORI') === 'adduttori');
check('valore non tra i muscoli contati → null', muscleCountedOf('boh') === null);

echo "Catalogo \"gambe\" (12 esercizi, Decisioni dell'issue #64)\n";
$gambe_catalog = [
    'quadricipiti' => ['Squat (Bilanciere)', 'Box Squat', 'Goblet Squat', 'Hack Squat 45', 'Leg Press 45', 'Pendulum Squat', 'Bulgarian Split Squat', 'Affondi'],
    'glutei' => ['Sumo Squat', 'Stacco da Terra (Bilanciere)', 'Stacco da Terra (Manubri)'],
    'adduttori' => ['Adductor Machine'],
];
$total_gambe = 0;
foreach ($gambe_catalog as $muscle => $names) {
    check("\"$muscle\" è un'opzione ammessa per gambe", muscleIsValidPrimary('gambe', $muscle));
    $total_gambe += count($names);
}
check('i 12 esercizi "gambe" del catalogo sono coperti', $total_gambe === 12);
check('Abductor Machine (gruppo glutei) → abduttori è ammesso', muscleIsValidPrimary('glutei', 'abduttori'));
check('Stacco Rumeno (gruppo femorali) resta femorali', muscleResolvePrimary('femorali', null) === 'femorali');

echo "\n$checks controlli, $fails falliti\n";
exit($fails > 0 ? 1 : 0);
