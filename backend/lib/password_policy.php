<?php
// Regole della password, uniche per registrazione, cambio e reset.
// Stesse regole dei client (web e mobile); il "carattere speciale" e' qualsiasi carattere
// non alfanumerico, un po' piu' permissivo dei client per non rifiutare password valide.

include_once __DIR__ . '/../config/api_helpers.php';

/**
 * Ritorna null se la password rispetta le regole, altrimenti il messaggio da mostrare.
 */
function password_policy_error($password)
{
    if (!is_string($password) || strlen($password) < 8) {
        return t_server('password.min_length');
    }
    // bcrypt legge solo i primi 72 byte: oltre quel limite si rifiuta invece di troncare in silenzio
    if (strlen($password) > 72) {
        return t_server('password.max_length');
    }
    if (!preg_match('/[A-Z]/', $password)) {
        return t_server('password.uppercase');
    }
    if (!preg_match('/[a-z]/', $password)) {
        return t_server('password.lowercase');
    }
    if (!preg_match('/[0-9]/', $password)) {
        return t_server('password.number');
    }
    if (!preg_match('/[^A-Za-z0-9]/', $password)) {
        return t_server('password.special');
    }
    return null;
}
