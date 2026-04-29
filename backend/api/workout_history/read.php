<?php
/**
 * Workout History Read API
 */

// Include common CORS headers (this also starts the session and output buffering)
include_once '../../config/cors_headers.php';

// Disable error display only after CORS headers to ensure clean JSON
error_reporting(0);
ini_set('display_errors', 0);

// Include database and object files
include_once '../../config/database.php';
include_once '../../models/WorkoutHistory.php';
include_once '../../models/WorkoutSet.php';
include_once '../../models/Exercise.php';

// Check if user is logged in
if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    if (ob_get_length()) ob_clean();
    header('Content-Type: application/json');
    echo json_encode(array("message" => "Accesso non autorizzato. Effettua il login."));
    exit;
}

try {
    // Instantiate database and workout_history object
    $database = new Database();
    $db = $database->getConnection();

    // Initialize object
    $workout_history = new WorkoutHistory($db);
    $workout_history->user_id = $_SESSION['user_id'];

    // Workout history query
    $stmt = $workout_history->readAllByUser();
    $num = $stmt->rowCount();

    $records_arr = array();
    $records_arr["records"] = array();

    if ($num > 0) {
        $workouts = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $workout_set = new WorkoutSet($db);
        $sets_stmt = $workout_set->readAllByUserId($_SESSION['user_id']);
        $all_sets = $sets_stmt->fetchAll(PDO::FETCH_ASSOC);

        $sets_by_workout = [];
        foreach ($all_sets as $set) {
            $wh_id = $set['workout_history_id'];
            if (!isset($sets_by_workout[$wh_id])) {
                $sets_by_workout[$wh_id] = [];
            }

            $exercise_id = $set['exercise_id'];
            $last_idx = count($sets_by_workout[$wh_id]) - 1;

            if ($last_idx >= 0 && $sets_by_workout[$wh_id][$last_idx]['exercise_id'] == $exercise_id) {
                $sets_by_workout[$wh_id][$last_idx]['sets'][] = [
                    "set_number" => $set['set_number'],
                    "weight" => $set['weight'],
                    "reps" => $set['reps'],
                    "intensity_technique" => $set['intensity_technique']
                ];
            } else {
                $sets_by_workout[$wh_id][] = [
                    "exercise_id" => $exercise_id,
                    "name" => $set['exercise_name'],
                    "muscle_group" => $set['muscle_group'],
                    "sets" => [[
                        "set_number" => $set['set_number'],
                        "weight" => $set['weight'],
                        "reps" => $set['reps'],
                        "intensity_technique" => $set['intensity_technique']
                    ]]
                ];
            }
        }

        foreach ($workouts as $row) {
            $record_item = array(
                "id" => $row['id'],
                "date" => $row['date'],
                "notes" => $row['notes'],
                "exercises" => isset($sets_by_workout[$row['id']]) ? $sets_by_workout[$row['id']] : []
            );
            array_push($records_arr["records"], $record_item);
        }

        http_response_code(200);
    } else {
        http_response_code(404);
        $records_arr["message"] = "Nessun allenamento trovato.";
    }

    if (ob_get_length()) ob_clean();
    header('Content-Type: application/json');
    echo json_encode($records_arr);

} catch (Exception $e) {
    http_response_code(500);
    if (ob_get_length()) ob_clean();
    header('Content-Type: application/json');
    echo json_encode(array("message" => "Errore del server: " . $e->getMessage()));
}
ob_end_flush();
