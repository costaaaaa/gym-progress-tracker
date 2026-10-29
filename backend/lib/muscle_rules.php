<?php
// Funzioni pure per le regole del muscolo principale (gym_exercises.primary_muscle), usate per
// il conteggio delle serie e il recupero muscolare (muscle_group resta per cercare e raggruppare).
// Zero dipendenze DB: usate da workout_stats/dashboard.php, exercise/create.php e admin/exercises.php.

// Muscoli contati, nell'ordine del corpo (stesse chiavi di $tempi_base in dashboard.php e di
// MUSCLE_GROUPS in src/utils/recoveryGroups.js).
const COUNTED_MUSCLES = [
    'petto', 'schiena', 'spalle', 'bicipiti', 'tricipiti', 'addome',
    'quadricipiti', 'femorali', 'glutei', 'adduttori', 'abduttori', 'polpacci',
];

// Normalizza un gruppo muscolare (muscle_group, comprese le vecchie varianti di nome) nel
// muscolo contato corrispondente, o null se non si può normalizzare da solo. "gambe" è l'unico
// caso: raggruppa più muscoli (quadricipiti, femorali, glutei, adduttori, abduttori) e quindi
// non ha una normalizzazione automatica (vedi muscleAllowedOptions).
function muscleNormalizeGroup(string $group): ?string
{
    $map = [
        'dorsali' => 'schiena',
        'lat' => 'schiena',
        'tricipite' => 'tricipiti',
        'bicipite' => 'bicipiti',
        'quadricipite' => 'quadricipiti',
        'femorale' => 'femorali',
        'gluteo' => 'glutei',
        'polpaccio' => 'polpacci',
        'addominali' => 'addome',
    ];
    $g = strtolower($group);
    if ($g === 'gambe') return null;
    if (isset($map[$g])) return $map[$g];
    return in_array($g, COUNTED_MUSCLES, true) ? $g : null;
}

// Valori ammessi per primary_muscle secondo il gruppo (muscle_group) dell'esercizio, nell'ordine
// in cui li propone la UI. "gambe" non ha un default: la scelta è obbligatoria. "glutei" ha un
// default (glutei) più abduttori (es. Abductor Machine). Ogni altro gruppo ha solo la sua
// normalizzazione, che è anche il default.
function muscleAllowedOptions(string $group): array
{
    $g = strtolower($group);
    if ($g === 'gambe') return ['quadricipiti', 'femorali', 'glutei', 'adduttori', 'abduttori'];
    if ($g === 'glutei') return ['glutei', 'abduttori'];
    $norm = muscleNormalizeGroup($g);
    return $norm !== null ? [$norm] : [];
}

// True se $value è un primary_muscle ammesso per $group
function muscleIsValidPrimary(string $group, string $value): bool
{
    return in_array(strtolower($value), muscleAllowedOptions($group), true);
}

// Risolve il primary_muscle di un esercizio del gruppo $group, dato un valore esplicito
// (facoltativo, dal form di creazione o dell'admin). Con un valore esplicito valido lo usa
// (anche se diverso dal default, es. glutei → abduttori); senza, usa il default del gruppo.
// Ritorna null se il valore esplicito non è ammesso, o se manca e il gruppo non ha un default
// (oggi solo "gambe": la scelta lì è obbligatoria) — il chiamante lo traduce in un errore 400.
function muscleResolvePrimary(string $group, ?string $explicit): ?string
{
    $group = strtolower($group);
    $options = muscleAllowedOptions($group);
    if ($explicit !== null && $explicit !== '') {
        $value = strtolower($explicit);
        return in_array($value, $options, true) ? $value : null;
    }
    if ($group === 'gambe') return null;
    return $options[0] ?? null;
}

// Muscolo contato di una riga di gym_exercises (serie e recupero): il suo primary_muscle, se
// valorizzato e tra i muscoli contati; altrimenti null (l'esercizio non conta, es. una "gambe"
// personale senza scelta).
function muscleCountedOf(?string $primaryMuscle): ?string
{
    if ($primaryMuscle === null || $primaryMuscle === '') return null;
    $m = strtolower($primaryMuscle);
    return in_array($m, COUNTED_MUSCLES, true) ? $m : null;
}
