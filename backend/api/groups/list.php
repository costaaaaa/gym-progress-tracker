<?php
// GET → i gruppi dell'utente, con ruolo e numero di membri
require_once __DIR__ . '/_common.php';

try {
    list($db, $user_id) = groups_bootstrap('GET');
    $group = new Group($db);
    api_json_response(array('success' => true, 'groups' => $group->listForUser($user_id)));
} catch (Throwable $e) {
    groups_fail('groups/list.php', $e);
}
