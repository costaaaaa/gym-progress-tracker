<?php
/**
 * Endpoint per la sincronizzazione del peso da Apple Health (via iOS Shortcuts)
 * Supporta sia il caricamento singolo che il caricamento massivo (bulk).
 */

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

include_once '../../config/database.php';
include_once '../../models/UserStat.php';

define('SYNC_TOKEN', 'FH6OysawMh524rjD6x9R');

$data = json_decode(file_get_contents("php://input"));

// 1. Validazione Token
if (empty($data->sync_token) || $data->sync_token !== SYNC_TOKEN) {
    http_response_code(401);
    echo json_encode(array("message" => "Token non valido o mancante."));
    exit;
}

// Inizializzazione DB e Modello
$database = new Database();
$db = $database->getConnection();
$user_stat = new UserStat($db);
$user_stat->user_id = 1; // Utente predefinito

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
    echo json_encode(array("message" => "Nessun dato valido ricevuto."));
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
        $summary['errors']++;
    }
}

// Risposta finale
http_response_code(200);
echo json_encode(array(
    "message" => "Sincronizzazione completata.",
    "summary" => $summary
));
