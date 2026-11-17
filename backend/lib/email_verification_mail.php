<?php
// Email della verifica dell'email, nella lingua dell'account ($lang già normalizzata: 'it' o 'en'), tutte con
// mail_footer(). Chi chiama le manda in after_response(): l'invio non deve rallentare né far fallire la risposta.
// Le email di avviso non portano codici: dicono quando l'account verrà eliminato e di chiederne uno.
include_once __DIR__ . '/mailer.php';
require_once __DIR__ . '/email_verification_rules.php';

// Email con il codice. $is_change: il codice va a un indirizzo nuovo scelto dall'utente.
function email_verification_send_code($to, $username, $lang, $code, $is_change = false)
{
    $prefix = $is_change ? 'email.change_code_' : 'email.code_';
    $text = t_server($prefix . 'body', array('username' => $username, 'code' => $code), $lang) . mail_footer($lang);
    return mail_send($to, t_server($prefix . 'subject', array(), $lang), $text);
}

// Dagli endpoint, dopo la risposta: manda il codice nella lingua dell'account ($locale grezza dal database)
function email_verification_send_code_later($to, $username, $locale, $code, $is_change = false)
{
    $lang = normalize_locale($locale) ?? 'it';
    after_response(function () use ($to, $username, $lang, $code, $is_change) {
        email_verification_send_code($to, $username, $lang, $code, $is_change);
    });
}

// Al VECCHIO indirizzo: l'indirizzo dell'account è cambiato in $new_email
function email_verification_send_changed_notice($old_email, $username, $lang, $new_email)
{
    $text = t_server('email.changed_body', array('username' => $username, 'new_email' => $new_email), $lang) . mail_footer($lang);
    return mail_send($old_email, t_server('email.changed_subject', array(), $lang), $text);
}

// Avviso di eliminazione (1 o 2): la data è quella prima della quale la pulizia non elimina l'account (vedi
// emailNoticeEarliestDelete); $now è l'istante dell'invio (l'ora del database, la stessa della regola della pulizia)
function email_verification_send_deletion_notice($stage, $to, $username, $lang, $created_at, $now)
{
    $date = emailNoticeDateText(emailNoticeEarliestDelete($created_at, $stage, $now), $lang);
    $key = 'email.notice' . ($stage === 2 ? '2' : '1') . '_';
    $text = t_server($key . 'body', array('username' => $username, 'date' => $date), $lang) . mail_footer($lang);
    return mail_send($to, t_server($key . 'subject', array(), $lang), $text);
}
