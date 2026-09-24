<?php
// POST {group_id, action, ...} → gestione del gruppo.
//   rename {name}             owner, admin
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
            $name = Group::cleanName($data['name'] ?? null);
            if ($name === null) {
                api_error(400, 'invalid_name', 'Il nome deve avere da 1 a 60 caratteri e non può contenere link.');
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
                api_error(404, 'member_not_found', 'Membro non trovato.');
            }
            if ($target['user_id'] === $user_id || $target['role'] === 'owner') {
                api_error(403, 'forbidden', 'Non puoi rimuovere questo membro.');
            }
            if (!$is_owner && $target['role'] !== 'member') {
                api_error(403, 'forbidden', 'Solo il proprietario può rimuovere un amministratore.');
            }
            $group->removeMember($group_id, $target['user_id']);
            api_json_response(array('success' => true));

        case 'delete':
            if (!$is_owner) {
                api_error(403, 'forbidden', 'Solo il proprietario può eliminare il gruppo.');
            }
            $group->delete($group_id);
            api_json_response(array('success' => true));

        default:
            api_error(400, 'invalid_action', 'Azione non valida.');
    }
} catch (Throwable $e) {
    groups_fail('groups/manage.php', $e);
}
