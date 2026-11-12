<?php
// Identificatore numerico come arriva dal client: un intero JSON positivo oppure una stringa di sole
// cifre. Ritorna l'intero (al massimo 2147483647, il limite di una colonna int(11)) o null.
// Chi lo usa controlla e salva il valore ritornato, mai quello grezzo.
function parse_positive_id($value)
{
    // /D: senza, il $ ammette un a capo dopo le cifre
    if (is_string($value) && preg_match('/^[0-9]{1,10}$/D', $value) === 1) {
        $value = (int) $value;
    }
    return is_int($value) && $value >= 1 && $value <= 2147483647 ? $value : null;
}
