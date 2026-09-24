<?php
// POST {code, consent: true} → entra nel gruppo come membro. Il consenso copre cosa vedono
// gli altri membri (username, livello, streak, allenamenti e volume della settimana).
require_once __DIR__ . '/_common.php';

try {
    list($db, $user_id) = groups_bootstrap('POST');
    enforce_rate_limit($db, 'group_join_ip', client_ip_key('group:join'));

    $data = groups_json_body();
    if (($data['consent'] ?? false) !== true) {
        api_error(400, 'consent_required', 'Per entrare nel gruppo devi accettare cosa vedranno gli altri membri.');
    }
    require_group_age($db, $user_id);

    $code = normalize_invite_code($data['code'] ?? null);
    $group = new Group($db);
    $found = $code ? $group->findByCode($code) : null;
    if (!$found) {
        api_error(404, 'invalid_code', 'Codice invito non valido o scaduto.');
    }

    $result = $group->join($found['id'], $user_id);
    if ($result === 'closed') {
        api_error(404, 'invalid_code', 'Codice invito non valido o scaduto.');
    }
    if ($result === 'full') {
        api_error(409, 'group_full', 'Il gruppo ha raggiunto il numero massimo di membri.');
    }

    api_json_response(array(
        'success' => true,
        'group_id' => (int)$found['id'],
        'already_member' => $result === 'already_member',
    ));
} catch (Throwable $e) {
    groups_fail('groups/join.php', $e);
}
