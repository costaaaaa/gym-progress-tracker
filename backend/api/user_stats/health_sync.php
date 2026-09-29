<?php
// Misure lette dall'app mobile da Apple Salute (iOS) o Health Connect (Android).
//
// POST {"days": [{"date": "2026-09-29", "weight": 81.4, "body_fat_percentage": null}, ...]}
//   Un valore per campo e per giorno, già scelto dal telefono (l'ultimo del giorno locale).
//   Campo assente = non cambiato; null = in Salute non c'è più. Campi: weight (kg),
//   body_fat_percentage (%), waist_size (cm). Al massimo 1000 giorni per chiamata.
//   → {created, updated, cleared, skipped, errors: [{date, message}]}
//
// POST {"action": "unlink"}
//   Salute scollegata: svuota i valori importati, quelli inseriti a mano restano.
//   → {cleared_rows}
//
// Le regole (il manuale vince, null svuota solo i campi importati) stanno in UserStat.

include_once '../../config/cors_headers.php';

include_once '../../config/database.php';
include_once '../../config/api_helpers.php';
include_once '../../models/Consent.php';
include_once '../../models/UserStat.php';

$database = new Database();
$db = $database->getConnection();

$user_id = resolve_authenticated_user_id($db);
if (!$user_id) {
    http_response_code(401);
    echo json_encode(array("message" => "Accesso non autorizzato. Effettua il login."));
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(array("message" => "Metodo non consentito."));
    exit;
}

$data = json_decode(file_get_contents("php://input"), true);
if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(array("message" => "Richiesta non valida."));
    exit;
}

$user_stat = new UserStat($db);

// Scollegare si può anche senza consenso: toglie solo dati
if (isset($data['action']) && $data['action'] === 'unlink') {
    $cleared = $user_stat->clearHealthValues($user_id);
    http_response_code(200);
    echo json_encode(array("cleared_rows" => $cleared));
    exit;
}

if (!(new Consent($db))->isActive($user_id, 'health_data')) {
    http_response_code(403);
    echo json_encode(array(
        "success" => false,
        "code" => "consent_required",
        "message" => "Per importare le misure da Salute serve il tuo consenso."
    ));
    exit;
}

$days = isset($data['days']) ? $data['days'] : null;
if (!is_array($days) || !array_is_list($days)) {
    http_response_code(400);
    echo json_encode(array("message" => "Elenco dei giorni mancante."));
    exit;
}
if (count($days) > 1000) {
    http_response_code(413);
    echo json_encode(array("message" => "Troppi giorni in una volta: al massimo 1000."));
    exit;
}

// Stessi tetti di create.php
$limits = array('weight' => 500, 'body_fat_percentage' => 100, 'waist_size' => 300);
// Il telefono conta i giorni nel suo fuso: accanto al nostro può già essere domani
$maxDate = new DateTime('tomorrow');

$counts = array('created' => 0, 'updated' => 0, 'cleared' => 0, 'skipped' => 0);
$errors = array();

try {
    $db->beginTransaction();
    foreach ($days as $day) {
        $date = (is_array($day) && isset($day['date']) && is_string($day['date'])) ? $day['date'] : null;
        $dateObj = $date !== null ? DateTime::createFromFormat('!Y-m-d', $date) : false;
        if (!$dateObj || $dateObj->format('Y-m-d') !== $date || $dateObj > $maxDate || $dateObj->format('Y') < 1900) {
            $errors[] = array("date" => $date, "message" => "Data non valida.");
            continue;
        }

        $values = array();
        $invalid = null;
        foreach ($limits as $field => $max) {
            if (!array_key_exists($field, $day)) {
                continue;
            }
            $value = $day[$field];
            if ($value === null) {
                $values[$field] = null;
            } elseif ((is_int($value) || is_float($value)) && $value >= 0 && $value <= $max) {
                $values[$field] = round((float) $value, 2);
            } else {
                $invalid = $field;
                break;
            }
        }
        // Un campione assurdo (una bilancia che segna 900 kg) non deve bloccare gli altri giorni
        if ($invalid !== null) {
            $errors[] = array("date" => $date, "message" => "Valore non valido per $invalid.");
            continue;
        }
        if (!$values) {
            $counts['skipped']++;
            continue;
        }

        $counts[$user_stat->upsertFromHealth($user_id, $date, $values)]++;
    }
    $db->commit();
} catch (Exception $e) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    error_log("health_sync user $user_id: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(array("message" => "Impossibile salvare le misure. Riprova più tardi."));
    exit;
}

http_response_code(200);
echo json_encode(array_merge($counts, array("errors" => $errors)));
