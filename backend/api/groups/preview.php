<?php
// GET ?code= → nome, tipo e numero di membri del gruppo, per decidere se entrare.
// Non elenca i membri. Conta nel limite di tentativi insieme a join.php.
require_once __DIR__ . '/_common.php';

try {
    list($db, $user_id) = groups_bootstrap('GET');
    enforce_rate_limit($db, 'group_join_ip', client_ip_key('group:join'));

    $code = normalize_invite_code($_GET['code'] ?? null);
    $group = new Group($db);
    $found = $code ? $group->findByCode($code) : null;
    if (!$found || !(int)$found['invite_enabled']) {
        api_error(404, 'invalid_code', 'Codice invito non valido o scaduto.');
    }

    $is_member = group_membership($db, $found['id'], $user_id) !== null;
    api_json_response(array(
        'success' => true,
        'group' => array(
            'name' => $found['name'],
            'type' => $found['type'],
            'members_count' => (int)$found['members_count'],
            'is_full' => (int)$found['members_count'] >= (int)$found['max_members'],
            'already_member' => $is_member,
            // L'id serve solo a chi è già dentro, per aprire il gruppo
            'id' => $is_member ? (int)$found['id'] : null,
        ),
    ));
} catch (Throwable $e) {
    groups_fail('groups/preview.php', $e);
}
