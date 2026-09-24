<?php
// GET ?group_id=&board=week|streak|level → dati del gruppo, membri e classifica.
// Solo per i membri (404 agli altri). Codice invito e riferimenti dei membri solo a owner e admin.
require_once __DIR__ . '/_common.php';

try {
    list($db, $user_id) = groups_bootstrap('GET');
    $group_id = groups_group_id($_GET['group_id'] ?? null);
    $membership = require_group_member($db, $group_id, $user_id);

    $board = $_GET['board'] ?? 'week';
    if (!in_array($board, Group::BOARDS, true)) $board = 'week';

    $group = new Group($db);
    $info = $group->find($group_id);
    $can_manage = in_array($membership['role'], array('owner', 'admin'), true);
    $now = new DateTime();
    list($monday, $sunday) = isoWeekBounds($now);

    $payload = array(
        'id' => (int)$info['id'],
        'name' => $info['name'],
        'type' => $info['type'],
        'my_role' => $membership['role'],
        'members_count' => (int)$info['members_count'],
        'max_members' => (int)$info['max_members'],
        'created_at' => $info['created_at'],
    );
    if ($can_manage) {
        $payload['invite_code'] = $info['invite_code'];
        $payload['invite_enabled'] = (bool)(int)$info['invite_enabled'];
    }

    api_json_response(array(
        'success' => true,
        'group' => $payload,
        'week' => array(
            'iso' => $now->format('o-\WW'),
            'from' => $monday->format('Y-m-d'),
            'to' => $sunday->format('Y-m-d'),
        ),
        'board_type' => $board,
        'board' => $group->leaderboard($group_id, $user_id, $board, $now),
        'members' => $group->members($group_id, $user_id, $can_manage),
    ));
} catch (Throwable $e) {
    groups_fail('groups/read.php', $e);
}
