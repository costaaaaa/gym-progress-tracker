<?php
// POST {group_id, target: group_name|member, username?, reason, good_faith: true}
// → segnala il nome del gruppo o lo username di un membro (DSA art. 16). Solo per i membri.
require_once __DIR__ . '/_common.php';
include_once __DIR__ . '/../../models/Report.php';
include_once __DIR__ . '/../../lib/admin_notify.php';
include_once __DIR__ . '/../../lib/report_mail.php';

try {
    list($db, $user_id) = groups_bootstrap('POST');
    $data = groups_json_body();
    $group_id = groups_group_id($data['group_id'] ?? null);
    require_group_member($db, $group_id, $user_id);

    $target = $data['target'] ?? null;
    if (!in_array($target, Report::TARGETS, true)) {
        api_error(400, 'invalid_target', t_server('report.target_invalid'));
    }
    $reason = is_string($data['reason'] ?? null) ? trim($data['reason']) : '';
    $length = mb_strlen($reason, 'UTF-8');
    if ($length < Report::REASON_MIN || $length > Report::REASON_MAX) {
        $limits = array('min' => Report::REASON_MIN, 'max' => Report::REASON_MAX);
        api_error(400, 'invalid_reason', t_server('report.reason_invalid', $limits));
    }
    if (($data['good_faith'] ?? null) !== true) {
        api_error(400, 'good_faith_required', t_server('report.good_faith_required'));
    }

    $group = new Group($db);
    $target_user_id = null;
    if ($target === 'member') {
        $member = $group->memberByUsername($group_id, $data['username'] ?? null);
        if (!$member) {
            api_error(400, 'invalid_member', t_server('report.member_invalid'));
        }
        if ((int)$member['user_id'] === $user_id) {
            api_error(400, 'self_report', t_server('report.self'));
        }
        $target_user_id = (int)$member['user_id'];
        $label = $member['username'];
    } else {
        $label = $group->find($group_id)['name'];
    }

    enforce_rate_limit($db, 'report_user', 'report:user:' . $user_id);
    $reports = new Report($db);
    $report_id = $reports->create($user_id, $group_id, $target, $target_user_id, $label, $reason);
    $row = $reports->find($report_id);
    after_response(function () use ($db, $row) {
        admin_notify_report($row);
        report_mail_received($db, $row);
    });

    api_json_response(array('success' => true, 'report_id' => $report_id), 201);
} catch (Throwable $e) {
    groups_fail('groups/report.php', $e);
}
