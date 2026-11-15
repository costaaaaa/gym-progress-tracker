<?php

// Valori plausibili delle misure corporee: numeri finiti, non negativi, con un tetto ragionevole.
// L'ordine è quello dei campi nel modulo (il primo errore trovato è il primo campo sbagliato).
const STATS_LIMITS = array(
    'weight' => 500, 'body_fat_percentage' => 100, 'muscle_mass_percentage' => 100,
    'chest_size' => 300, 'arm_size' => 150, 'waist_size' => 300, 'leg_size' => 200,
);

// Primo campo di $data (oggetto del JSON) con un valore fuori dai limiti, o null. Vuoto e null si ignorano.
function stats_invalid_field($data)
{
    foreach (STATS_LIMITS as $field => $max) {
        if (isset($data->$field) && $data->$field !== '' && $data->$field !== null) {
            if (!is_numeric($data->$field) || $data->$field < 0 || $data->$field > $max) {
                return $field;
            }
        }
    }
    return null;
}

// Corpo della risposta 400 per un valore non valido: "message" nomina il campo nella lingua dell'utente,
// "field" (nome tecnico) e "max" servono ai client per segnare il campo giusto.
function stats_invalid_value($field, $locale = null)
{
    $max = STATS_LIMITS[$field];
    // La chiave dipende dal campo: ce n'è una per ogni campo di STATS_LIMITS, in entrambe le lingue (lo controlla
    // tests/stats_rules_test.php). Sta in una variabile perché scripts/i18n-check.mjs legge come chiave intera la stringa
    // scritta dentro la chiamata a t_server: il solo prefisso risulterebbe una chiave mancante.
    $label_key = 'stats.field.' . $field;
    return array(
        'message' => t_server('stats.value_invalid', array(
            'field' => t_server($label_key, array(), $locale),
            'max' => $max,
        ), $locale),
        'field' => $field,
        'max' => $max,
    );
}
