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

// Query for workout frequency (count workouts per week in the last 12 weeks)
$query = "SELECT 
            YEARWEEK(date, 1) as year_week,
            DATE_FORMAT(MIN(date), '%Y-%m-%d') as week_start,
            COUNT(*) as workout_count
          FROM gym_workout_history
          WHERE user_id = ? AND date >= DATE_SUB(NOW(), INTERVAL 12 WEEK)
          GROUP BY year_week
          ORDER BY year_week ASC";

$stmt = $db->prepare($query);
$stmt->execute([$user_id]);

$results = array();
while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    $results[] = $row;
}

http_response_code(200);
echo json_encode(array("records" => $results));
