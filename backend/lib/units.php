<?php
// Conversioni di unità dell'export dei dati (api/user/export.php): l'unico posto con i fattori e gli arrotondamenti.
// A specchio di src/utils/weightUnit.js e src/utils/lengthUnit.js, che sono la fonte delle regole; la fixture
// tests/fixtures/units_cases.json (generata da quei moduli) è riletta da tests/units_test.php con confronto esatto.
// I dati restano in kg e cm (database, API): si converte solo l'uscita dell'export di chi ha scelto 'lb'.
//
// Pesi di serie e massimali: quarto di libbra (4 divisioni). Peso corporeo: decimo di libbra (10). Circonferenze:
// decimo di pollice. Percentuali, ripetizioni, tempi e i campi che hanno l'unità nel nome non si toccano.

const UNITS_LB_IN_KG = 0.45359237;
const UNITS_CM_PER_IN = 2.54;
const UNITS_QUARTER_LB = 4;
const UNITS_TENTH_LB = 10;

// Math.round di JavaScript: i mezzi vanno verso +infinito (PHP round() va via dallo zero e, prima della 8.4,
// pre-arrotonda). floor() e la differenza sono esatti sui double. Vale per x >= 0, l'unico caso possibile (pesi e
// lunghezze non sono negativi): per un x negativo i mezzi non sono garantiti.
function units_js_round($x)
{
    $floor = floor($x);
    return ($x - $floor >= 0.5) ? $floor + 1.0 : $floor;
}

// kgToDisplay(kg, 'lb', divisioni): libbre arrotondate a 1/divisioni di libbra
function units_kg_to_lb($kg, $divisions = UNITS_QUARTER_LB)
{
    return units_js_round(((float)$kg / UNITS_LB_IN_KG) * $divisions) / $divisions;
}

// cmToDisplay(cm, 'lb'): pollici al decimo, passando per i centesimi interi (cm / 0,254 = centesimi × 5 / 127)
function units_cm_to_in($cm)
{
    $tenths = (units_js_round((float)$cm * 100) * 5) / 127;
    return units_js_round($tenths) / 10;
}

// Le funzioni di conversione si aspettano null o una stringa decimale come la restituisce PDO (decimal(5,2)): non
// validano altro.

// Un'unità sconosciuta vale kg, come nell'app
function units_normalize($unit)
{
    return $unit === 'lb' ? 'lb' : 'kg';
}

// Intestazione dell'export: le unità di tutti i pesi e le lunghezze del file
function units_export_header($unit)
{
    return units_normalize($unit) === 'lb' ? array('weight' => 'lb', 'length' => 'in') : array('weight' => 'kg', 'length' => 'cm');
}

// Peso da esportare. In kg il valore com'è (il testo del database, stesso tipo e formato di sempre); in lb un testo
// con due decimali, come le colonne decimal(5,2), così il tipo non cambia con l'unità. I due decimali sono solo il
// formato (stessa forma delle stringhe decimali dei kg), non la precisione: quella è il quarto o il decimo di libbra
// di units_kg_to_lb(). Nullo resta nullo.
function units_export_weight($kg, $unit, $divisions = UNITS_QUARTER_LB)
{
    if ($kg === null || units_normalize($unit) !== 'lb') return $kg;
    return number_format(units_kg_to_lb($kg, $divisions), 2, '.', '');
}

// Circonferenza da esportare: come units_export_weight, cm → pollici al decimo (due decimali in uscita: solo formato)
function units_export_length($cm, $unit)
{
    if ($cm === null || units_normalize($unit) !== 'lb') return $cm;
    return number_format(units_cm_to_in($cm), 2, '.', '');
}
