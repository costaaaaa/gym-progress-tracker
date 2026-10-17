<?php
// Email agli utenti per le segnalazioni (DSA art. 16-17), nella lingua dell'account:
// ricevuta ed esito a chi segnala, motivazione a chi subisce la modifica (proprietario del
// gruppo rinominato, utente rinominato). Account cancellato o senza email: non parte niente.
require_once __DIR__ . '/mailer.php';
require_once __DIR__ . '/../models/Group.php';

function report_mail_to_user($db, $user_id, $key, array $vars)
{
    if ($user_id === null) return false;
    $stmt = $db->prepare("SELECT email, username, locale FROM gym_users WHERE id = ? LIMIT 1");
    $stmt->execute([(int)$user_id]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$user || !$user['email']) return false;
    $lang = normalize_locale($user['locale'] ?? null) ?? 'it';
    $vars += array('username' => $user['username']);
    return mail_send($user['email'], t_server("report.mail.{$key}_subject", array(), $lang), t_server("report.mail.{$key}_body", $vars, $lang));
}

// $report: riga di gym_reports
function report_mail_received($db, array $report)
{
    return report_mail_to_user($db, $report['reporter_user_id'], 'received',
        array('id' => (int)$report['id'], 'label' => $report['target_label']));
}

// $status: resolved | dismissed
function report_mail_outcome($db, array $report, $status, $note)
{
    return report_mail_to_user($db, $report['reporter_user_id'], $status,
        array('id' => (int)$report['id'], 'label' => $report['target_label'], 'note' => $note));
}

// $forever: dalla seconda rinomina d'ufficio il nome non si può più cambiare (Group::nameLock)
function report_mail_group_renamed($db, $owner_id, $old_name, $new_name, $note, $forever)
{
    $vars = array('old' => $old_name, 'new' => $new_name, 'note' => $note, 'days' => Group::NAME_LOCK_DAYS);
    return report_mail_to_user($db, $owner_id, $forever ? 'group_renamed_forever' : 'group_renamed', $vars);
}

// Rinomina dalla pagina admin senza segnalazione (admin/groups.php)
function report_mail_group_renamed_by_admin($db, $owner_id, $old_name, $new_name, $note)
{
    return report_mail_to_user($db, $owner_id, 'group_renamed_admin', array('old' => $old_name, 'new' => $new_name, 'note' => $note));
}

function report_mail_user_renamed($db, $user_id, $old_name, $new_name, $note)
{
    return report_mail_to_user($db, $user_id, 'user_renamed', array('old' => $old_name, 'new' => $new_name, 'note' => $note));
}
