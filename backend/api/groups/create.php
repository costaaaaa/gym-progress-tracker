<?php
// POST {name, type: friends|gym} → crea un gruppo e ne diventa owner
require_once __DIR__ . '/_common.php';

try {
    list($db, $user_id) = groups_bootstrap('POST');
    require_group_age($db, $user_id);

    $data = groups_json_body();
    $name = Group::cleanName($data['name'] ?? null);
    if ($name === null) {
        api_error(400, 'invalid_name', 'Il nome deve avere da 1 a 60 caratteri e non può contenere link.');
    }
    $type = $data['type'] ?? 'friends';
    if (!in_array($type, Group::TYPES, true)) {
        api_error(400, 'invalid_type', 'Tipo di gruppo non valido.');
    }

    enforce_rate_limit($db, 'group_create_user', 'group:create:user:' . $user_id);

    $group = new Group($db);
    if ($group->countOwned($user_id) >= Group::MAX_OWNED) {
        api_error(409, 'too_many_groups', 'Puoi creare al massimo ' . Group::MAX_OWNED . ' gruppi.');
    }
    $group_id = $group->create($user_id, $name, $type);
    $created = $group->find($group_id);

    api_json_response(array(
        'success' => true,
        'group' => array(
            'id' => $group_id,
            'name' => $created['name'],
            'type' => $created['type'],
            'my_role' => 'owner',
            'members_count' => 1,
            'invite_code' => $created['invite_code'],
            'invite_enabled' => true,
        ),
    ), 201);
} catch (Throwable $e) {
    groups_fail('groups/create.php', $e);
}
