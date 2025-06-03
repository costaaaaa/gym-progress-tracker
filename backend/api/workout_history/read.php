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
    // Initialize the response array
    $records_arr = array();
    $records_arr["records"] = array();

    // Retrieve our table contents
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        extract($row);

        // Create a standard record object
        $record_item = array(
            "id" => $id,
            "date" => $date,
            "notes" => $notes,
            "exercises" => array() // This will hold all exercise data
        );

        // Utilizziamo il nuovo modello WorkoutSet per ottenere i set raggruppati per esercizio
        $workout_set = new WorkoutSet($db);
        $workout_set->workout_history_id = $id;
        
        // Verifichiamo se esistono dati nella nuova struttura
        $has_new_data = false;
        $new_exercises = array();
        
        try {
            // Attempt to read from the new structure
            $exercises_with_sets = $workout_set->getExerciseSetsForWorkout();
            
            if (!empty($exercises_with_sets)) {
                $has_new_data = true;
                $new_exercises = $exercises_with_sets;
            }
        } catch (Exception $e) {
            // Log error but continue with legacy format
            error_log("Error reading from new structure: " . $e->getMessage());
        }
        
        if ($has_new_data) {
            // Use the new structure data
            foreach ($new_exercises as $exercise) {
                $exercise_item = array(
                    "exercise_id" => $exercise['exercise_id'],
                    "name" => $exercise['exercise_name'],
                    "muscle_group" => $exercise['muscle_group'],
                    "sets" => array()
                );
                
                // Add each set to the exercise
                foreach ($exercise['sets'] as $set) {
                    $exercise_item["sets"][] = array(
                        "set_number" => $set['set_number'],
                        "weight" => $set['weight'],
                        "reps" => $set['reps']
                    );
                }
                
                $record_item["exercises"][] = $exercise_item;
            }
        } else {
            // Fall back to the legacy JSON format
            if (isset($row['exercises']) && !empty($row['exercises'])) {
                $exercises_data = json_decode($row['exercises'], true);
                
                if (is_array($exercises_data)) {
                    // Group exercises by exercise_id
                    $grouped_exercises = array();
                    
                    foreach ($exercises_data as $exercise_data) {
                        $exercise_id = isset($exercise_data['exercise_id']) ? $exercise_data['exercise_id'] : null;
                        
                        if (!$exercise_id) {
                            continue;
                        }
                        
                        if (!isset($grouped_exercises[$exercise_id])) {
                            $grouped_exercises[$exercise_id] = array(
                                "exercise_id" => $exercise_id,
                                "name" => isset($exercise_data['exercise_name']) ? $exercise_data['exercise_name'] : "Esercizio",
                                "muscle_group" => "N/A",
                                "sets" => array()
                            );
                        }
                        
                        $grouped_exercises[$exercise_id]["sets"][] = array(
                            "set_number" => isset($exercise_data['set_number']) ? $exercise_data['set_number'] : 1,
                            "weight" => isset($exercise_data['weight']) ? $exercise_data['weight'] : 0,
                            "reps" => isset($exercise_data['reps']) ? $exercise_data['reps'] : 0
                        );
                    }
                    
                    $record_item["exercises"] = array_values($grouped_exercises);
                }
            }
        }
        
        // Add this record to the records array
        array_push($records_arr["records"], $record_item);
    }

    // Set response code - 200 OK
    http_response_code(200);

    // Show records
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