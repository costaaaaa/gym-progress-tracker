<?php
// Regole di planned_sets (#77): funzioni pure, nessun database. Il traduttore è sostituito da uno
// che restituisce la chiave, così i test non dipendono dal testo dei messaggi.
function t_server($key)
{
    return $key;
}
// Come in config/api_helpers.php (qui non si carica, serve solo questo limite)
const FREE_TEXT_MAX_LENGTH = array('notes' => 5000, 'intensity_technique' => 100);
require __DIR__ . '/../backend/lib/plan_sets_rules.php';

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

// $json è il corpo come arriva dal client: json_decode senza flag, quindi gli oggetti sono stdClass
function err($json)
{
    return planned_sets_error(json_decode($json));
}

const W = '{"set_number":%d,"kind":"working","reps_min":8,"reps_max":10}';
function working($n)
{
    return sprintf(W, $n);
}
function warmup($n)
{
    return '{"set_number":' . $n . ',"kind":"warmup"}';
}

echo "Forma\n";
check('null (campo mancante)', 'exercise.planned_sets_invalid', planned_sets_error(null));
check('stringa', 'exercise.planned_sets_invalid', err('"8-10"'));
check('oggetto al posto della lista', 'exercise.planned_sets_invalid', err('{"0":' . working(1) . '}'));
check('lista vuota', 'exercise.planned_sets_invalid', err('[]'));
check('elemento non oggetto', 'exercise.planned_sets_invalid', err('[8]'));
check('campo in più', 'exercise.planned_sets_invalid', err('[{"set_number":1,"kind":"working","reps_min":8,"reps_max":10,"peso":50}]'));
check('kind mancante', 'exercise.planned_sets_invalid', err('[{"set_number":1,"reps_min":8,"reps_max":10}]'));
check('kind sconosciuto', 'exercise.planned_sets_invalid', err('[{"set_number":1,"kind":"cooldown","reps_min":8,"reps_max":10}]'));
check('set_number mancante', 'exercise.planned_sets_invalid', err('[{"kind":"working","reps_min":8,"reps_max":10}]'));
check('set_number stringa', 'exercise.planned_sets_invalid', err('[{"set_number":"1","kind":"working","reps_min":8,"reps_max":10}]'));
check('set_number che non parte da 1', 'exercise.planned_sets_invalid', err('[' . working(2) . ']'));
check('set_number con un buco', 'exercise.planned_sets_invalid', err('[' . working(1) . ',' . working(3) . ']'));
check('set_number ripetuto', 'exercise.planned_sets_invalid', err('[' . working(1) . ',' . working(1) . ']'));
check('set_number fuori ordine', 'exercise.planned_sets_invalid', err('[' . working(2) . ',' . working(1) . ']'));
check('reps_min stringa', 'exercise.planned_sets_invalid', err('[{"set_number":1,"kind":"working","reps_min":"8","reps_max":10}]'));
check('reps_min decimale', 'exercise.planned_sets_invalid', err('[{"set_number":1,"kind":"working","reps_min":8.5,"reps_max":10}]'));
check('to_failure numero', 'exercise.planned_sets_invalid', err('[{"set_number":1,"kind":"working","to_failure":1}]'));

echo "\nValidi\n";
check('una serie 8-10', null, err('[' . working(1) . ']'));
check('numero (min = max)', null, err('[{"set_number":1,"kind":"working","reps_min":12,"reps_max":12}]'));
check('a cedimento senza minimo', null, err('[{"set_number":1,"kind":"working","to_failure":true}]'));
check('a cedimento con reps_min e reps_max null espliciti', null, err('[{"set_number":1,"kind":"working","reps_min":null,"reps_max":null,"to_failure":true}]'));
check('a cedimento con minimo', null, err('[{"set_number":1,"kind":"working","reps_min":5,"to_failure":true}]'));
check('riscaldamento e poi allenante', null, err('[' . warmup(1) . ',' . working(2) . ']'));
check('riscaldamento con campi null espliciti', null, err('[{"set_number":1,"kind":"warmup","reps_min":null,"reps_max":null,"to_failure":false,"intensity_technique":null},' . working(2) . ']'));
check('lo stesso corpo come array associativi', null, planned_sets_error([
    ['set_number' => 1, 'kind' => 'warmup'],
    ['set_number' => 2, 'kind' => 'working', 'reps_min' => 8, 'reps_max' => 10],
]));

echo "\nNumero di serie\n";
function repeatSets($count, $makeSet, $start = 1)
{
    $items = array();
    for ($n = $start; $n < $start + $count; $n++) {
        $items[] = $makeSet($n);
    }
    return $items;
}
check('20 allenanti', null, err('[' . implode(',', repeatSets(20, 'working')) . ']'));
check('21 allenanti', 'exercise.planned_sets_count', err('[' . implode(',', repeatSets(21, 'working')) . ']'));
check('10 riscaldamento + 1 allenante', null, err('[' . implode(',', array_merge(repeatSets(10, 'warmup'), repeatSets(1, 'working', 11))) . ']'));
check('11 riscaldamento + 1 allenante', 'exercise.planned_sets_count', err('[' . implode(',', array_merge(repeatSets(11, 'warmup'), repeatSets(1, 'working', 12))) . ']'));
check('solo riscaldamento (nessuna allenante)', 'exercise.planned_sets_count', err('[' . warmup(1) . ']'));

echo "\nOrdine\n";
check('riscaldamento dopo un\'allenante', 'exercise.planned_sets_order', err('[' . working(1) . ',' . warmup(2) . ']'));
check('riscaldamento in mezzo alle allenanti', 'exercise.planned_sets_order', err('[' . working(1) . ',' . warmup(2) . ',' . working(3) . ']'));

echo "\nTarget delle allenanti\n";
function workingWith($fields)
{
    return '[{"set_number":1,"kind":"working",' . $fields . '}]';
}
check('reps_min 1 e reps_max 250', null, err(workingWith('"reps_min":1,"reps_max":250')));
check('reps_min 0', 'exercise.planned_sets_target', err(workingWith('"reps_min":0,"reps_max":10')));
check('reps_max 251', 'exercise.planned_sets_target', err(workingWith('"reps_min":8,"reps_max":251')));
check('reps_min negativo', 'exercise.planned_sets_target', err(workingWith('"reps_min":-1,"reps_max":10')));
check('minimo maggiore del massimo', 'exercise.planned_sets_target', err(workingWith('"reps_min":10,"reps_max":8')));
check('nessun target e non a cedimento', 'exercise.planned_sets_target', err(workingWith('"to_failure":false')));
check('solo il minimo', 'exercise.planned_sets_target', err(workingWith('"reps_min":8')));
check('solo il massimo', 'exercise.planned_sets_target', err(workingWith('"reps_max":8')));
check('a cedimento con il massimo', 'exercise.planned_sets_target', err(workingWith('"reps_min":5,"reps_max":8,"to_failure":true')));
check('a cedimento con minimo 0', 'exercise.planned_sets_target', err(workingWith('"reps_min":0,"to_failure":true')));
check('a cedimento con minimo 251', 'exercise.planned_sets_target', err(workingWith('"reps_min":251,"to_failure":true')));

echo "\nTarget e tecnica del riscaldamento\n";
function warmupWith($fields)
{
    return '[{"set_number":1,"kind":"warmup",' . $fields . '},' . working(2) . ']';
}
check('con reps_min', 'exercise.planned_sets_target', err(warmupWith('"reps_min":8')));
check('con reps_max', 'exercise.planned_sets_target', err(warmupWith('"reps_max":8')));
check('a cedimento', 'exercise.planned_sets_target', err(warmupWith('"to_failure":true')));
check('con una tecnica', 'exercise.planned_sets_target', err(warmupWith('"intensity_technique":"Rest Pause"')));
check('con tecnica vuota (vale nessuna)', null, err(warmupWith('"intensity_technique":""')));
check('con "Nessuna (Normale)" (vale nessuna)', null, err(warmupWith('"intensity_technique":"Nessuna (Normale)"')));

echo "\nTecnica di intensità\n";
function techWith($value)
{
    return '[{"set_number":1,"kind":"working","reps_min":8,"reps_max":10,"intensity_technique":' . json_encode($value) . '}]';
}
check('una tecnica', null, err(techWith('Drop Set (Stripping)')));
check('null', null, err(techWith(null)));
check('stringa vuota', null, err(techWith('')));
check('Nessuna (Normale)', null, err(techWith('Nessuna (Normale)')));
check('100 caratteri', null, err(techWith(str_repeat('a', 100))));
check('101 caratteri', 'exercise.planned_sets_technique', err(techWith(str_repeat('a', 101))));
check('100 caratteri multibyte', null, err(techWith(str_repeat('è', 100))));
check('101 caratteri multibyte', 'exercise.planned_sets_technique', err(techWith(str_repeat('è', 101))));
check('numero', 'exercise.planned_sets_technique', err('[{"set_number":1,"kind":"working","reps_min":8,"reps_max":10,"intensity_technique":5}]'));
check('array', 'exercise.planned_sets_technique', err('[{"set_number":1,"kind":"working","reps_min":8,"reps_max":10,"intensity_technique":["a"]}]'));

echo "\nForma canonica\n";
check(
    'completa i campi assenti, toglie gli spazi e porta "Nessuna (Normale)" e il vuoto a null',
    array(
        array('set_number' => 1, 'kind' => 'warmup', 'reps_min' => null, 'reps_max' => null, 'to_failure' => false, 'intensity_technique' => null),
        array('set_number' => 2, 'kind' => 'working', 'reps_min' => 8, 'reps_max' => 10, 'to_failure' => false, 'intensity_technique' => 'Rest Pause'),
        array('set_number' => 3, 'kind' => 'working', 'reps_min' => 5, 'reps_max' => null, 'to_failure' => true, 'intensity_technique' => null),
        array('set_number' => 4, 'kind' => 'working', 'reps_min' => null, 'reps_max' => null, 'to_failure' => true, 'intensity_technique' => null),
        array('set_number' => 5, 'kind' => 'working', 'reps_min' => 12, 'reps_max' => 12, 'to_failure' => false, 'intensity_technique' => null),
    ),
    planned_sets_normalize(json_decode('[
        {"set_number":1,"kind":"warmup","intensity_technique":""},
        {"set_number":2,"kind":"working","reps_min":8,"reps_max":10,"intensity_technique":"  Rest Pause "},
        {"set_number":3,"kind":"working","reps_min":5,"to_failure":true,"intensity_technique":"Nessuna (Normale)"},
        {"set_number":4,"kind":"working","to_failure":true},
        {"set_number":5,"kind":"working","reps_min":12,"reps_max":12,"to_failure":false}
    ]'))
);
check('una tecnica di soli spazi è valida e diventa null', null, err(techWith("   ")));

echo "\nDa riga del database a risposta\n";
check(
    'interi come interi, to_failure come booleano, null che restano null',
    array(
        array('set_number' => 1, 'kind' => 'warmup', 'reps_min' => null, 'reps_max' => null, 'to_failure' => false, 'intensity_technique' => null),
        array('set_number' => 2, 'kind' => 'working', 'reps_min' => 8, 'reps_max' => 10, 'to_failure' => false, 'intensity_technique' => null),
        array('set_number' => 3, 'kind' => 'working', 'reps_min' => 5, 'reps_max' => null, 'to_failure' => true, 'intensity_technique' => 'Rest Pause'),
    ),
    array_map('planned_set_from_row', array(
        array('workout_exercise_id' => '9', 'set_number' => '1', 'kind' => 'warmup', 'reps_min' => null, 'reps_max' => null, 'to_failure' => '0', 'intensity_technique' => null),
        array('workout_exercise_id' => 9, 'set_number' => 2, 'kind' => 'working', 'reps_min' => '8', 'reps_max' => '10', 'to_failure' => 0, 'intensity_technique' => null),
        array('workout_exercise_id' => 9, 'set_number' => 3, 'kind' => 'working', 'reps_min' => 5, 'reps_max' => null, 'to_failure' => 1, 'intensity_technique' => 'Rest Pause'),
    ))
);

echo "\n";
if ($fails === 0) {
    echo "$checks controlli, 0 falliti\n";
} else {
    echo "$checks controlli, $fails falliti\n";
    exit(1);
}
