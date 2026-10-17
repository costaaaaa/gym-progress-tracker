<?php
// Gruppi, solo per admin (gli altri ricevono 404): ricerca e rinomina senza segnalazione, per
// esempio quando il proprietario chiede un nome nuovo e il suo è bloccato per sempre.
//
//   GET  ?q=testo                            gruppi con quell'id o quel testo nel nome (al massimo 20)
//   POST {action: rename, id, name, note}    rinomina; la nota è la motivazione che arriva per email al
//                                            proprietario. Non conta per il blocco del nome (Group::nameLock)
//                                            e non lo toglie: per quello ci sono le segnalazioni.
include_once __DIR__ . '/../../config/cors_headers.php';
include_once __DIR__ . '/../../config/database.php';
include_once __DIR__ . '/../../config/api_helpers.php';
include_once __DIR__ . '/../../models/Group.php';
include_once __DIR__ . '/../../models/Report.php';
include_once __DIR__ . '/../../lib/report_mail.php';

header('Content-Type: application/json');

try {
    $database = new Database();
    $db = $database->getConnection();
    require_admin($db);
    $group = new Group($db);

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        api_json_response(array('success' => true, 'groups' => $group->adminSearch($_GET['q'] ?? '')));
    }
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        api_error(405, 'method_not_allowed', 'Metodo non consentito');
    }

    $data = json_decode(file_get_contents('php://input'), true);
    $data = is_array($data) ? $data : array();
    if (($data['action'] ?? '') !== 'rename') {
        api_error(400, 'invalid_action', 'Azione non valida.');
    }
    $found = $group->find((int)($data['id'] ?? 0));
    if (!$found) {
        api_error(404, 'group_not_found', 'Gruppo non trovato.');
    }
    $name = Group::cleanName($data['name'] ?? null);
    if ($name === null) {
        api_error(400, 'invalid_name', 'Il nome deve avere da 1 a 60 caratteri e non può contenere link.');
    }
    $note = is_string($data['note'] ?? null) ? trim($data['note']) : '';
    if ($note === '' || mb_strlen($note, 'UTF-8') > Report::NOTE_MAX) {
        api_error(400, 'invalid_note', 'Scrivi la motivazione (al massimo ' . Report::NOTE_MAX . ' caratteri).');
    }

    $group->rename($found['id'], $name);
    after_response(function () use ($db, $found, $name, $note) {
        report_mail_group_renamed_by_admin($db, $found['owner_user_id'], $found['name'], $name, $note);
    });
    api_json_response(array('success' => true, 'name' => $name));
} catch (Throwable $e) {
    api_log_exception('admin/groups.php', $e);
    if (ob_get_length()) ob_clean();
    api_error(500, 'server_error', 'Errore interno del server.');
}
