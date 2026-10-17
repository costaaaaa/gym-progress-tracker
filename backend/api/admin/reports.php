<?php
// Segnalazioni dei contenuti nei gruppi (DSA art. 16), solo per admin (gli altri ricevono 404).
//
//   GET  ?status=open|resolved|dismissed      elenco (default open)
//   POST {action, id, note, ...}               solo su segnalazioni aperte (altrimenti 409); la nota
//                                              è la motivazione della decisione (DSA art. 17)
//     resolve                                  accolta
//     dismiss                                  respinta
//     rename_group {name}                      rinomina il gruppo segnalato e la chiude come accolta; il
//                                              proprietario non può cambiare il nome per 14 giorni, dalla
//                                              seconda volta mai più (Group::nameLock)
//     rename_user {username}                   cambia lo username del membro segnalato e la chiude come accolta
include_once __DIR__ . '/../../config/cors_headers.php';
include_once __DIR__ . '/../../config/database.php';
include_once __DIR__ . '/../../config/api_helpers.php';
include_once __DIR__ . '/../../models/Report.php';
include_once __DIR__ . '/../../models/Group.php';
include_once __DIR__ . '/../../models/User.php';
include_once __DIR__ . '/../../lib/report_mail.php';

header('Content-Type: application/json');

// Segnalazione aperta, o esce con 404/409
function admin_open_report($report, $id)
{
    $row = $report->find($id);
    if (!$row) {
        api_error(404, 'report_not_found', 'Segnalazione non trovata.');
    }
    if ($row['status'] !== 'open') {
        api_error(409, 'already_closed', 'Segnalazione già chiusa.');
    }
    return $row;
}

// Motivazione della decisione, o esce con 400
function admin_report_note($data)
{
    $note = is_string($data['note'] ?? null) ? trim($data['note']) : '';
    if ($note === '' || mb_strlen($note, 'UTF-8') > Report::NOTE_MAX) {
        api_error(400, 'invalid_note', 'Scrivi la motivazione (al massimo ' . Report::NOTE_MAX . ' caratteri).');
    }
    return $note;
}

function admin_close_report($report, $id, $status, $note)
{
    if (!$report->close($id, $status, $note)) {
        api_error(409, 'already_closed', 'Segnalazione già chiusa.');
    }
}

try {
    $database = new Database();
    $db = $database->getConnection();
    require_admin($db);
    $report = new Report($db);

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $status = $_GET['status'] ?? 'open';
        if (!in_array($status, Report::STATUSES, true)) {
            api_error(400, 'invalid_status', 'Stato non valido.');
        }
        api_json_response(array('success' => true, 'reports' => $report->adminList($status)));
    }
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        api_error(405, 'method_not_allowed', 'Metodo non consentito');
    }

    $data = json_decode(file_get_contents('php://input'), true);
    $data = is_array($data) ? $data : array();
    $id = (int)($data['id'] ?? 0);

    switch ($data['action'] ?? '') {
        case 'resolve':
        case 'dismiss':
            $row = admin_open_report($report, $id);
            $note = admin_report_note($data);
            $status = $data['action'] === 'resolve' ? 'resolved' : 'dismissed';
            admin_close_report($report, $id, $status, $note);
            after_response(function () use ($db, $row, $status, $note) {
                report_mail_outcome($db, $row, $status, $note);
            });
            api_json_response(array('success' => true, 'status' => $status));

        case 'rename_group':
            $row = admin_open_report($report, $id);
            if ($row['target'] !== 'group_name') {
                api_error(400, 'wrong_target', 'Questa segnalazione riguarda un membro, non il nome del gruppo.');
            }
            $name = Group::cleanName($data['name'] ?? null);
            if ($name === null) {
                api_error(400, 'invalid_name', 'Il nome deve avere da 1 a 60 caratteri e non può contenere link.');
            }
            $note = admin_report_note($data);
            $group = new Group($db);
            $found = $row['group_id'] === null ? null : $group->find($row['group_id']);
            if (!$found) {
                api_error(409, 'group_gone', 'Il gruppo non esiste più.');
            }
            // Chiusura e rinomina insieme: se la segnalazione è stata chiusa nel frattempo, il nome non cambia
            $db->beginTransaction();
            admin_close_report($report, $id, 'resolved', $note);
            $group->adminRename($row['group_id'], $name);
            $db->commit();
            $forever = (int)$found['admin_renames'] + 1 >= Group::NAME_LOCK_FOREVER_AFTER;
            after_response(function () use ($db, $row, $found, $name, $note, $forever) {
                report_mail_outcome($db, $row, 'resolved', $note);
                report_mail_group_renamed($db, $found['owner_user_id'], $found['name'], $name, $note, $forever);
            });
            api_json_response(array('success' => true, 'status' => 'resolved', 'name' => $name));

        case 'rename_user':
            $row = admin_open_report($report, $id);
            if ($row['target'] !== 'member') {
                api_error(400, 'wrong_target', 'Questa segnalazione riguarda il nome del gruppo, non un membro.');
            }
            $note = admin_report_note($data);
            if ($row['target_user_id'] === null) {
                api_error(409, 'user_gone', 'L\'account segnalato non esiste più.');
            }
            $username = is_string($data['username'] ?? null) ? trim($data['username']) : null;
            $old = $db->prepare("SELECT username FROM gym_users WHERE id = ? LIMIT 1");
            $old->execute([(int)$row['target_user_id']]);
            $old_username = $old->fetchColumn();
            $db->beginTransaction();
            admin_close_report($report, $id, 'resolved', $note);
            $result = (new User($db))->changeUsername($row['target_user_id'], $username);
            if ($result !== 'ok') {
                $db->rollBack();
                if ($result === 'taken') {
                    api_error(409, 'username_taken', 'Questo nome utente è già in uso.');
                }
                api_error(400, 'invalid_username', 'Il nome utente deve avere da 3 a 50 lettere o numeri.');
            }
            $db->commit();
            after_response(function () use ($db, $row, $old_username, $username, $note) {
                report_mail_outcome($db, $row, 'resolved', $note);
                report_mail_user_renamed($db, $row['target_user_id'], $old_username, $username, $note);
            });
            api_json_response(array('success' => true, 'status' => 'resolved', 'username' => $username));

        default:
            api_error(400, 'invalid_action', 'Azione non valida.');
    }
} catch (Throwable $e) {
    api_log_exception('admin/reports.php', $e);
    if (ob_get_length()) ob_clean();
    api_error(500, 'server_error', 'Errore interno del server.');
}
