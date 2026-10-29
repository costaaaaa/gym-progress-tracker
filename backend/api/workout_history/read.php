<?php
/**
 * Workout History Read API
 */

// Include common CORS headers (this also starts the session and output buffering)
include_once '../../config/cors_headers.php';

// Disable error display only after CORS headers to ensure clean JSON
error_reporting(0);
ini_set('display_errors', 0);

include_once '../../config/database.php';
include_once '../../config/api_helpers.php';
include_once '../../models/WorkoutHistory.php';
include_once '../../models/WorkoutSet.php';
include_once '../../models/Exercise.php';

try {
    $database = new Database();
    $db = $database->getConnection();

    $user_id = require_authenticated_user($db);

    // Initialize object
    $workout_history = new WorkoutHistory($db);
    $workout_history->user_id = $user_id;

    // Workout history query
    $stmt = $workout_history->readAllByUser();
    $num = $stmt->rowCount();

    $records_arr = array();
    $records_arr["records"] = array();

    if ($num > 0) {
        $workouts = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $workout_set = new WorkoutSet($db);
        $sets_stmt = $workout_set->readAllByUserId($user_id);
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
                    "intensity_technique" => $set['intensity_technique'],
                    "is_warmup" => (bool) $set['is_warmup']
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
                        "intensity_technique" => $set['intensity_technique'],
                        "is_warmup" => (bool) $set['is_warmup']
                    ]]
                ];
            }
        }

        foreach ($workouts as $row) {
            $record_item = array(
                "id" => $row['id'],
                "date" => $row['date'],
                "time_zone" => $row['time_zone'],
                "started_at" => workout_started_at($row['date'], $row['time_zone']),
                "duration_seconds" => $row['duration_seconds'] !== null ? (int) $row['duration_seconds'] : null,
                "notes" => $row['notes'],
                "health_written" => $row['health_written_at'] !== null,
                "exercises" => isset($sets_by_workout[$row['id']]) ? $sets_by_workout[$row['id']] : []
            );
            array_push($records_arr["records"], $record_item);
        }

        http_response_code(200);
    } else {
        http_response_code(404);
        $records_arr["message"] = t_server('history.none_found');
    }

    if (ob_get_length()) ob_clean();
    header('Content-Type: application/json');
    echo json_encode($records_arr);

} catch (Exception $e) {
    http_response_code(500);
    if (ob_get_length()) ob_clean();
    header('Content-Type: application/json');
    error_log("Errore in workout_history/read.php: " . $e->getMessage());
    echo json_encode(array("message" => t_server('common.server_error')));
}
ob_end_flush();
