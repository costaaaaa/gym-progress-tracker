<?php
/**
 * Endpoint per la sincronizzazione del peso da Apple Health (via iOS Shortcuts)
 * Supporta sia il caricamento singolo che il caricamento massivo (bulk).
 */

include_once '../../config/cors_headers.php';
include_once '../../config/database.php';
include_once '../../models/UserStat.php';

$data = json_decode(file_get_contents("php://input"));

if (empty($data->user_id) || empty($data->sync_token)) {
    http_response_code(400);
    echo json_encode(array("success" => false, "message" => "user_id e sync_token sono obbligatori."));
    exit;
}

$user_id = filter_var($data->user_id, FILTER_VALIDATE_INT);
if (!$user_id) {
    http_response_code(400);
    echo json_encode(array("success" => false, "message" => "user_id non valido."));
    exit;
}

$APPLE_HEALTH_SYNC_TOKENS = [];
$config_path = __DIR__ . '/../../config/apple_health.php';
if (file_exists($config_path)) {
    include $config_path;
}

$expected_token = isset($APPLE_HEALTH_SYNC_TOKENS[$user_id]) ? $APPLE_HEALTH_SYNC_TOKENS[$user_id] : null;

if (!$expected_token) {
    error_log("Apple Health sync token missing for user_id {$user_id}");
    http_response_code(503);
    echo json_encode(array("success" => false, "message" => "Sincronizzazione non configurata."));
    exit;
}

if (!is_string($data->sync_token) || !hash_equals((string)$expected_token, $data->sync_token)) {
    http_response_code(401);
    echo json_encode(array("success" => false, "message" => "Token non valido o mancante."));
    exit;
}

// Inizializzazione DB e Modello
$database = new Database();
$db = $database->getConnection();
$user_stat = new UserStat($db);
$user_stat->user_id = $user_id;

// Determina se è un caricamento massivo o singolo
$records = [];
if (!empty($data->records) && is_array($data->records)) {
    $records = $data->records;
} elseif (!empty($data->weight) && !empty($data->date)) {
    $records[] = (object)[
        'weight' => $data->weight,
        'date' => $data->date
    ];
}

if (empty($records)) {
    http_response_code(400);
    echo json_encode(array("success" => false, "message" => "Nessun dato valido ricevuto."));
    exit;
}

$summary = [
    'total' => count($records),
    'created' => 0,
    'updated' => 0,
    'skipped' => 0,
    'errors' => 0
];

foreach ($records as $item) {
    if (empty($item->weight) || empty($item->date)) {
        $summary['errors']++;
        continue;
    }

    $user_stat->date = $item->date;
    $user_stat->weight = $item->weight;

    try {
        if ($user_stat->readByDate()) {
            // Se il peso è diverso, aggiorniamo
            if (floatval($user_stat->weight) !== floatval($item->weight)) {
                if ($user_stat->updateWeight()) {
                    $summary['updated']++;
                } else {
                    $summary['errors']++;
                }
            } else {
                $summary['skipped']++;
            }
        } else {
            // Creazione nuovo record
            if ($user_stat->create()) {
                $summary['created']++;
            } else {
                $summary['errors']++;
            }
        }
    } catch (Exception $e) {
        error_log("Apple Health sync error for user_id {$user_id}: " . $e->getMessage());
        $summary['errors']++;
    }
}

// Risposta finale
http_response_code(200);
echo json_encode(array(
    "success" => true,
    "message" => "Sincronizzazione completata.",
    "summary" => $summary
));
