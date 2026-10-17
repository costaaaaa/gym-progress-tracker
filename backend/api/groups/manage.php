<?php
// POST {group_id, action, ...} → gestione del gruppo.
//   rename {name}             owner, admin (403 name_locked dopo una rinomina d'ufficio, vedi Group::nameLock)
//   regenerate_code           owner, admin (il vecchio codice smette di funzionare)
//   toggle_invites {enabled}  owner, admin
//   remove_member {ref}       owner (chiunque tranne sé), admin (solo i member)
//   delete                    solo owner
require_once __DIR__ . '/_common.php';

try {
    list($db, $user_id) = groups_bootstrap('POST');
    $data = groups_json_body();
    $group_id = groups_group_id($data['group_id'] ?? null);
    $membership = require_group_role($db, $group_id, $user_id, array('owner', 'admin'));
    $is_owner = $membership['role'] === 'owner';
    $group = new Group($db);
    $action = $data['action'] ?? '';

    switch ($action) {
        case 'rename':
            $lock = Group::nameLock($group->find($group_id));
            if ($lock !== null && $lock['until'] === null) {
                api_error(403, 'name_locked', t_server('groups.name_locked'));
            }
            if ($lock !== null) {
                $format = request_locale() === 'en' ? 'M j, Y g:i A' : 'd/m/Y H:i';
                api_error(403, 'name_locked', t_server('groups.name_locked_until', array('date' => date($format, strtotime($lock['until'])))));
            }
            $name = Group::cleanName($data['name'] ?? null);
            if ($name === null) {
                api_error(400, 'invalid_name', t_server('groups.name_invalid'));
            }
            $group->rename($group_id, $name);
            api_json_response(array('success' => true, 'name' => $name));

        case 'regenerate_code':
            api_json_response(array('success' => true, 'invite_code' => $group->regenerateCode($group_id)));

        case 'toggle_invites':
            $enabled = (bool)($data['enabled'] ?? false);
            $group->setInvitesEnabled($group_id, $enabled);
            api_json_response(array('success' => true, 'invite_enabled' => $enabled));

        case 'remove_member':
            $target = $group->memberByRef($group_id, $data['ref'] ?? null);
            if (!$target) {
                api_error(404, 'member_not_found', t_server('groups.member_not_found'));
            }
            if ($target['user_id'] === $user_id || $target['role'] === 'owner') {
                api_error(403, 'forbidden', t_server('groups.cannot_remove_member'));
            }
            if (!$is_owner && $target['role'] !== 'member') {
                api_error(403, 'forbidden', t_server('groups.owner_removes_admin'));
            }
            $group->removeMember($group_id, $target['user_id']);
            api_json_response(array('success' => true));

        case 'delete':
            if (!$is_owner) {
                api_error(403, 'forbidden', t_server('groups.owner_deletes'));
            }
            $group->delete($group_id);
            api_json_response(array('success' => true));

        default:
            api_error(400, 'invalid_action', t_server('groups.action_invalid'));
    }
} catch (Throwable $e) {
    groups_fail('groups/manage.php', $e);
}
