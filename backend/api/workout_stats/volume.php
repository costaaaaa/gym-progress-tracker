<?php
include_once '../../config/cors_headers.php';

include_once '../../config/database.php';
include_once '../../config/api_helpers.php';

$database = new Database();
$db = $database->getConnection();

$user_id = require_authenticated_user($db);

// Query for total volume per workout in the last 3 months. Le serie di riscaldamento (#66)
// non sono allenanti: escluse dal volume.
$query = "SELECT
            DATE(h.date) as workout_date,
            SUM(s.weight * s.reps) as total_volume
          FROM gym_workout_history h
          JOIN gym_workout_sets s ON h.id = s.workout_history_id
          WHERE h.user_id = ? AND h.date >= ? AND s.is_warmup = 0
          GROUP BY h.id, workout_date
          ORDER BY workout_date ASC";

$stmt = $db->prepare($query);
$stmt->execute([$user_id, user_now()->modify('-3 months')->format('Y-m-d H:i:s')]);

$results = array();
while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    $results[] = $row;
}

http_response_code(200);
echo json_encode(array("records" => $results));
