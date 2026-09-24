<?php
// POST {group_id} → esce dal gruppo. I suoi dati spariscono subito dalla classifica.
// L'owner non può uscire: deve eliminare il gruppo.
require_once __DIR__ . '/_common.php';

try {
    list($db, $user_id) = groups_bootstrap('POST');
    $data = groups_json_body();
    $group_id = groups_group_id($data['group_id'] ?? null);
    $membership = require_group_member($db, $group_id, $user_id);
    if ($membership['role'] === 'owner') {
        api_error(409, 'owner_cannot_leave', 'Sei il proprietario: per uscire elimina il gruppo.');
    }
    $group = new Group($db);
    $group->removeMember($group_id, $user_id);
    api_json_response(array('success' => true));
} catch (Throwable $e) {
    groups_fail('groups/leave.php', $e);
}
