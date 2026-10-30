<?php
/**
 * Calcoli del calcolatore 1RM, comuni alla pagina italiana (calcolatore-1rm/)
 * e a quella inglese (en/1rm-calculator/, pubblicata su /en/blog/1rm-calculator/).
 *
 * Formula e arrotondamento sono gli stessi dell'app (estimateOneRepMax in
 * src/utils/workoutMetrics.js): se cambiano li', vanno cambiati qui e in
 * assets/calcolatore-1rm.js, che rifa' gli stessi conti mentre si digita.
 */

const CALC_MAX_REPS = 20;

/** Percentuali del massimale nella tabella dei carichi. */
const CALC_PERCENTS = array(100, 95, 90, 85, 80, 75, 70, 65, 60);

/**
 * Per unita': peso massimo accettato e salto a cui si arrotondano i carichi
 * (il minimo con due dischi da 1,25 kg o da 2,5 lb). Gli stessi valori sono
 * in assets/calcolatore-1rm.js.
 */
const CALC_UNITS = array(
    'kg' => array('max' => 500, 'step' => 2.5),
    'lb' => array('max' => 1100, 'step' => 5),
);

/** Le due versioni della pagina, per hreflang e per il link all'altra lingua. */
function calc_alternates()
{
    $it = BLOG_BASE_URL . '/calcolatore-1rm/';
    return array(
        'it' => $it,
        'en' => BLOG_APP_URL . 'en/blog/1rm-calculator/',
        'x-default' => $it,
    );
}

/** 1RM stimato con Epley, arrotondato a un decimale come nell'app. */
function calc_one_rep_max($weight, $reps)
{
    return round($weight * (1 + $reps / 30), 1);
}

/** Carico arrotondato al salto dell'unita' (2,5 kg o 5 lb). */
function calc_round_load($load, $unit)
{
    $step = CALC_UNITS[$unit]['step'];
    return round($load / $step) * $step;
}

/** Ripetizioni indicative a una data percentuale del massimale (Epley inversa). */
function calc_reps_at($percent)
{
    if ($percent >= 100) {
        return 1;
    }
    return max(1, (int) round(30 * (100 / $percent - 1)));
}

/** Numero con al piu' un decimale, senza zeri finali, col separatore decimale dato. */
function calc_format($value, $decimal)
{
    return str_replace('.', $decimal, rtrim(rtrim(number_format($value, 1, '.', ''), '0'), '.'));
}

/** Legge un parametro numerico in GET (accetta la virgola decimale). */
function calc_param($name, $default, $min, $max)
{
    if (!isset($_GET[$name]) || !is_string($_GET[$name])) {
        return $default;
    }
    $value = str_replace(',', '.', trim($_GET[$name]));
    if (!is_numeric($value)) {
        return $default;
    }
    return min($max, max($min, (float) $value));
}

/** Legge l'unita' in GET: kg se manca o non e' una di CALC_UNITS. */
function calc_unit_param($name)
{
    if (isset($_GET[$name]) && is_string($_GET[$name]) && isset(CALC_UNITS[$_GET[$name]])) {
        return $_GET[$name];
    }
    return 'kg';
}
