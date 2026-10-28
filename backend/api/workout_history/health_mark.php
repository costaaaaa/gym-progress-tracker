<?php
// Il telefono segnala quali allenamenti ha scritto nell'app Salute (written) e quali ne ha tolto (removed).
include_once '../../config/cors_headers.php';

include_once '../../config/database.php';
include_once '../../config/api_helpers.php';

const HEALTH_MARK_MAX_IDS = 500;

$database = new Database();
$db = $database->getConnection();
$user_id = require_authenticated_user($db);

// Lista di ID positivi (interi o stringhe di sole cifre), oppure null se il campo manca; false se non è valida
function health_mark_ids($value)
{
    if ($value === null) {
        return null;
    }
    if (!is_array($value)) {
        return false;
    }
    $ids = [];
    foreach ($value as $id) {
        if (is_string($id) && ctype_digit($id)) {
            $id = (int) $id;
        }
        if (!is_int($id) || $id <= 0) {
            return false;
        }
        $ids[] = $id;
    }
    return array_values(array_unique($ids));
}

$data = json_decode(file_get_contents("php://input"), true);
$written = is_array($data) ? health_mark_ids($data['written'] ?? null) : false;
$removed = is_array($data) ? health_mark_ids($data['removed'] ?? null) : false;

if (
    $written === false || $removed === false ||
    ($written === null && $removed === null) ||
    count($written ?? []) + count($removed ?? []) > HEALTH_MARK_MAX_IDS
) {
    api_error(400, 'invalid_data', t_server('history.health_invalid'));
}

try {
    $db->beginTransaction();
    // Se un ID è in entrambe le liste vince removed, che viene applicata per ultima
    foreach ([[$written, 'NOW()'], [$removed, 'NULL']] as [$ids, $sql_value]) {
        if (empty($ids)) {
            continue;
        }
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $stmt = $db->prepare("UPDATE gym_workout_history SET health_written_at = $sql_value WHERE user_id = ? AND id IN ($placeholders)");
        $stmt->execute(array_merge([$user_id], $ids));
    }
    $db->commit();
} catch (Exception $e) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    error_log('health_mark: ' . $e->getMessage());
    api_error(500, 'server_error', t_server('history.health_failed'));
}

api_json_response(['success' => true]);
