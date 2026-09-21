<?php
// Regole della password, uniche per registrazione, cambio e reset.
// Stesse regole dei client (web e mobile); il "carattere speciale" e' qualsiasi carattere
// non alfanumerico, un po' piu' permissivo dei client per non rifiutare password valide.

/**
 * Ritorna null se la password rispetta le regole, altrimenti il messaggio da mostrare.
 */
function password_policy_error($password)
{
    if (!is_string($password) || strlen($password) < 8) {
        return 'La password deve contenere almeno 8 caratteri.';
    }
    // bcrypt legge solo i primi 72 byte: oltre quel limite si rifiuta invece di troncare in silenzio
    if (strlen($password) > 72) {
        return 'La password non può superare i 72 caratteri.';
    }
    if (!preg_match('/[A-Z]/', $password)) {
        return 'La password deve contenere almeno una lettera maiuscola.';
    }
    if (!preg_match('/[a-z]/', $password)) {
        return 'La password deve contenere almeno una lettera minuscola.';
    }
    if (!preg_match('/[0-9]/', $password)) {
        return 'La password deve contenere almeno un numero.';
    }
    if (!preg_match('/[^A-Za-z0-9]/', $password)) {
        return 'La password deve contenere almeno un carattere speciale (!@#$%^&*).';
    }
    return null;
}
