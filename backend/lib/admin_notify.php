<?php
// Avvisi email all'admin: nuova segnalazione, nuovo esercizio da approvare. Vanno a
// ADMIN_NOTIFY_EMAIL (env sul server, come MAIL_*); se è vuota non parte niente.
// Dicono solo cosa c'è da guardare e dove: motivo e nomi segnalati si leggono nella pagina admin.
// Non lanciano mai eccezioni: un avviso che non parte non deve far fallire la richiesta.
require_once __DIR__ . '/mailer.php';

function admin_notify($subject, $text)
{
    $to = trim((string)getenv('ADMIN_NOTIFY_EMAIL'));
    if ($to === '') {
        return false;
    }
    $baseUrl = rtrim(getenv('APP_PUBLIC_URL') ?: 'http://localhost:3000', '/');
    return mail_send($to, $subject, $text . "\n\n" . $baseUrl . "/admin\n");
}

// $report: riga di gym_reports (servono id e group_id)
function admin_notify_report(array $report)
{
    $what = ($report['target'] ?? '') === 'member' ? 'uno username' : 'il nome del gruppo';
    return admin_notify(
        'Nuova segnalazione #' . (int)$report['id'],
        'Nel gruppo #' . (int)$report['group_id'] . ' è stato segnalato ' . $what . '.'
    );
}

function admin_notify_exercise($name)
{
    return admin_notify('Nuovo esercizio da controllare', 'Esercizio in attesa di approvazione: ' . $name);
}
