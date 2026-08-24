<?php
// Include common CORS headers
include_once '../../config/cors_headers.php';

// Include database
include_once '../../config/database.php';
include_once '../../config/api_helpers.php';

// Connessione creata prima del check di autenticazione: resolve_authenticated_user_id()
// ne ha bisogno per validare sia la sessione web sia il token Bearer mobile.
$database = new Database();
$db = $database->getConnection();

$user_id = resolve_authenticated_user_id($db);
if (!$user_id) {
    http_response_code(401);
    echo json_encode(array("message" => "Accesso non autorizzato."));
    exit;
}

// Query for total volume per workout in the last 3 months
$query = "SELECT 
            DATE(h.date) as workout_date,
            SUM(s.weight * s.reps) as total_volume
          FROM gym_workout_history h
          JOIN gym_workout_sets s ON h.id = s.workout_history_id
          WHERE h.user_id = ? AND h.date >= DATE_SUB(NOW(), INTERVAL 3 MONTH)
          GROUP BY h.id, workout_date
          ORDER BY workout_date ASC";

$stmt = $db->prepare($query);
$stmt->execute([$user_id]);

$results = array();
while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    $results[] = $row;
}

http_response_code(200);
echo json_encode(array("records" => $results));
