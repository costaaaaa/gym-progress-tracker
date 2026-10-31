<?php
// Serie pianificate di un esercizio in scheda (#77): validazione e forma canonica di `planned_sets`.
// Zero dipendenze DB: usata da add_exercise.php e update_exercise.php tramite exercise_params_error().

const PLAN_SET_FIELDS = array('set_number', 'kind', 'reps_min', 'reps_max', 'to_failure', 'intensity_technique');
const PLAN_SET_NO_TECHNIQUE = 'Nessuna (Normale)';
const PLAN_SET_MAX_WARMUP = 10;
const PLAN_SET_MAX_WORKING = 20;
const PLAN_SET_REPS_MAX = 250;
const PLAN_SET_TECHNIQUE_MAX_LENGTH = 100; // colonna intensity_technique varchar(100)

// Tecnica come si salva: senza spazi ai bordi; vuota o "Nessuna (Normale)" vale null.
function planned_set_technique($value)
{
    if ($value === null) {
        return null;
    }
    $value = trim($value);
    return ($value === '' || $value === PLAN_SET_NO_TECHNIQUE) ? null : $value;
}

function planned_set_reps_ok($value)
{
    return is_int($value) && $value >= 1 && $value <= PLAN_SET_REPS_MAX;
}

// Ritorna null se `planned_sets` (lista di serie dal JSON del client) e' valido, altrimenti il
// messaggio d'errore. I campi facoltativi assenti valgono null (to_failure: false).
function planned_sets_error($planned_sets)
{
    $invalid = t_server('exercise.planned_sets_invalid');
    if (!is_array($planned_sets) || $planned_sets === array() || !array_is_list($planned_sets)) {
        return $invalid;
    }
    $rows = array();
    foreach ($planned_sets as $index => $set) {
        if (!is_object($set) && !is_array($set)) {
            return $invalid;
        }
        $row = (array)$set;
        if (array_diff_key($row, array_flip(PLAN_SET_FIELDS))) {
            return $invalid;
        }
        if (!isset($row['set_number']) || $row['set_number'] !== $index + 1) {
            return $invalid;
        }
        if (!isset($row['kind']) || !in_array($row['kind'], array('warmup', 'working'), true)) {
            return $invalid;
        }
        foreach (array('reps_min', 'reps_max') as $field) {
            if (isset($row[$field]) && !is_int($row[$field])) {
                return $invalid;
            }
        }
        if (isset($row['to_failure']) && !is_bool($row['to_failure'])) {
            return $invalid;
        }
        $rows[] = $row;
    }

    foreach ($rows as $row) {
        $technique = $row['intensity_technique'] ?? null;
        if ($technique !== null && !is_string($technique)) {
            return t_server('exercise.planned_sets_technique');
        }
        if ($technique !== null && mb_strlen(trim($technique)) > PLAN_SET_TECHNIQUE_MAX_LENGTH) {
            return t_server('exercise.planned_sets_technique');
        }
    }

    $kinds = array_column($rows, 'kind');
    $warmups = count(array_keys($kinds, 'warmup', true));
    $workings = count($rows) - $warmups;
    if ($warmups > PLAN_SET_MAX_WARMUP || $workings < 1 || $workings > PLAN_SET_MAX_WORKING) {
        return t_server('exercise.planned_sets_count');
    }
    if ($kinds !== array_merge(array_fill(0, $warmups, 'warmup'), array_fill(0, $workings, 'working'))) {
        return t_server('exercise.planned_sets_order');
    }

    foreach ($rows as $row) {
        $min = $row['reps_min'] ?? null;
        $max = $row['reps_max'] ?? null;
        $to_failure = $row['to_failure'] ?? false;
        if ($row['kind'] === 'warmup') {
            $ok = $min === null && $max === null && !$to_failure && planned_set_technique($row['intensity_technique'] ?? null) === null;
        } elseif ($to_failure) {
            $ok = $max === null && ($min === null || planned_set_reps_ok($min));
        } else {
            $ok = planned_set_reps_ok($min) && planned_set_reps_ok($max) && $min <= $max;
        }
        if (!$ok) {
            return t_server('exercise.planned_sets_target');
        }
    }
    return null;
}

// Le serie nella forma che si salva e si restituisce: tutti i campi presenti, tecnica normalizzata.
// Da chiamare solo dopo planned_sets_error() senza errori.
function planned_sets_normalize($planned_sets)
{
    $normalized = array();
    foreach ($planned_sets as $set) {
        $row = (array)$set;
        $normalized[] = array(
            'set_number' => $row['set_number'],
            'kind' => $row['kind'],
            'reps_min' => $row['reps_min'] ?? null,
            'reps_max' => $row['reps_max'] ?? null,
            'to_failure' => $row['to_failure'] ?? false,
            'intensity_technique' => planned_set_technique($row['intensity_technique'] ?? null),
        );
    }
    return $normalized;
}

// Una riga di gym_workout_plan_sets nella forma della risposta (interi come interi, to_failure booleano).
function planned_set_from_row($row)
{
    return array(
        'set_number' => (int)$row['set_number'],
        'kind' => $row['kind'],
        'reps_min' => $row['reps_min'] === null ? null : (int)$row['reps_min'],
        'reps_max' => $row['reps_max'] === null ? null : (int)$row['reps_max'],
        'to_failure' => (bool)$row['to_failure'],
        'intensity_technique' => $row['intensity_technique'],
    );
}
