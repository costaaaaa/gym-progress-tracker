<?php

// Valori plausibili delle misure corporee: numeri finiti, non negativi, con un tetto ragionevole.
// L'ordine è quello dei campi nel modulo (il primo errore trovato è il primo campo sbagliato).
const STATS_LIMITS = array(
    'weight' => 500, 'body_fat_percentage' => 100, 'muscle_mass_percentage' => 100,
    'chest_size' => 300, 'arm_size' => 150, 'waist_size' => 300, 'leg_size' => 200,
);

// Chiave (in backend/lang) del nome del campo da mostrare nel messaggio
const STATS_FIELD_LABELS = array(
    'weight' => 'stats.field.weight', 'body_fat_percentage' => 'stats.field.body_fat_percentage',
    'muscle_mass_percentage' => 'stats.field.muscle_mass_percentage', 'chest_size' => 'stats.field.chest_size',
    'arm_size' => 'stats.field.arm_size', 'waist_size' => 'stats.field.waist_size', 'leg_size' => 'stats.field.leg_size',
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
    return array(
        'message' => t_server('stats.value_invalid', array(
            'field' => t_server(STATS_FIELD_LABELS[$field], array(), $locale),
            'max' => $max,
        ), $locale),
        'field' => $field,
        'max' => $max,
    );
}
