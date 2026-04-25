<?php
// Include common CORS headers
include_once '../../config/cors_headers.php';

// Include database and object files
include_once '../../config/database.php';
include_once '../../models/WorkoutHistory.php';
include_once '../../models/WorkoutSet.php'; // Includo il nuovo modello
include_once '../../models/Exercise.php'; // Per ottenere dettagli degli esercizi

// Start session
session_start();

// Check if user is logged in
if (!isset($_SESSION['user_id'])) {
    // Set response code - 401 Unauthorized
    http_response_code(401);
    
    // Tell the user
    echo json_encode(array("message" => "Accesso non autorizzato. Effettua il login."));
    exit;
}

// Instantiate database and workout_history object
$database = new Database();
$db = $database->getConnection();

// Initialize object
$workout_history = new WorkoutHistory($db);

// Set user ID from the session
$workout_history->user_id = $_SESSION['user_id'];

// Workout history query
$stmt = $workout_history->readAllByUser();
$num = $stmt->rowCount();

// Check if more than 0 record found
if ($num > 0) {
    // 1. Recupera tutti gli allenamenti
    $workouts = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // 2. Recupera tutti i set per questi allenamenti in una singola query
    $workout_set = new WorkoutSet($db);
    $sets_stmt = $workout_set->readAllByUserId($_SESSION['user_id']);
    $all_sets = $sets_stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // 3. Organizza i set per workout_history_id per un accesso rapido
    $sets_by_workout = [];
    foreach ($all_sets as $set) {
        $wh_id = $set['workout_history_id'];
        if (!isset($sets_by_workout[$wh_id])) {
            $sets_by_workout[$wh_id] = [];
        }
        
        $exercise_id = $set['exercise_id'];
        
        // Raggruppamento per blocchi contigui di esercizi (come in getExerciseSetsForWorkout)
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

    // 4. Costruisci la risposta finale
    $records_arr = array();
    $records_arr["records"] = array();

    foreach ($workouts as $row) {
        $record_item = array(
            "id" => $row['id'],
            "date" => $row['date'],
            "notes" => $row['notes'],
            "exercises" => []
        );

        if (isset($sets_by_workout[$row['id']])) {
            $record_item["exercises"] = $sets_by_workout[$row['id']];
        } else {
            // Fallback legacy (solo se non ci sono dati nella nuova tabella)
            if (isset($row['exercises']) && !empty($row['exercises'])) {
                // ... logica legacy mantenuta per sicurezza ...
                $exercises_data = json_decode($row['exercises'], true);
                if (is_array($exercises_data)) {
                    $grouped = [];
                    foreach ($exercises_data as $ex_data) {
                        $eid = $ex_data['exercise_id'] ?? null;
                        if (!$eid) continue;
                        if (!isset($grouped[$eid])) {
                            $grouped[$eid] = [
                                "exercise_id" => $eid,
                                "name" => $ex_data['exercise_name'] ?? "Esercizio",
                                "muscle_group" => "N/A",
                                "sets" => []
                            ];
                        }
                        $grouped[$eid]["sets"][] = [
                            "set_number" => $ex_data['set_number'] ?? 1,
                            "weight" => $ex_data['weight'] ?? 0,
                            "reps" => $ex_data['reps'] ?? 0
                        ];
                    }
                    $record_item["exercises"] = array_values($grouped);
                }
            }
        }
        
        array_push($records_arr["records"], $record_item);
    }

    http_response_code(200);
    echo json_encode($records_arr);
} else {
    // Set response code - 404 Not found
    http_response_code(404);

    // Tell the user no records found
    echo json_encode(
        array("message" => "Nessun allenamento trovato.")
    );
}
?> 