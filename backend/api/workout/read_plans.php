<?php
// Include common CORS headers
include_once '../../config/cors_headers.php';

// Include database and workout model
include_once '../../config/database.php';
include_once '../../models/WorkoutPlan.php';
include_once '../../models/WorkoutDay.php';
include_once '../../models/WorkoutExercise.php';

// La sessione è già gestita in cors_headers.php

// Check if user is logged in
if (!isset($_SESSION['user_id'])) {
    // Set response code - 401 Unauthorized
    http_response_code(401);

    // Tell the user
    echo json_encode(array("message" => "Accesso non autorizzato. Effettua il login."));
    exit;
}

// Get database connection
try {
    $database = new Database();
    $db = $database->getConnection();

    if (!$db) {
        throw new Exception("Impossibile stabilire una connessione al database.");
    }

    // Instantiate workout plan object
    $workout_plan = new WorkoutPlan($db);
    $workout_plan->user_id = $_SESSION['user_id'];

    // Read all workout plans
    $stmt = $workout_plan->readAllByUser();
    $num = $stmt->rowCount();

    // Check if more than 0 record found
    if ($num > 0) {
        // Workout plans array
        $plans_arr = array();
        $plans_arr["records"] = array();

        // Retrieve table contents
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            extract($row);

            $plan_item = array(
                "id" => $id,
                "name" => $name,
                "is_active" => $is_active,
                "created_at" => $created_at,
                "updated_at" => $updated_at,
                "days" => array()
            );

            // Get workout days for this plan
            $workout_day = new WorkoutDay($db);
            $workout_day->plan_id = $id;
            $days_stmt = $workout_day->readAllByPlan();

            while ($day_row = $days_stmt->fetch(PDO::FETCH_ASSOC)) {
                $day_item = array(
                    "id" => $day_row["id"],
                    "name" => $day_row["name"],
                    "day_order" => $day_row["day_order"],
                    "exercises" => array()
                );

                // Get exercises for this day
                $workout_exercise = new WorkoutExercise($db);
                $workout_exercise->day_id = $day_row["id"];
                $exercises_stmt = $workout_exercise->readByDay();

                while ($exercise_row = $exercises_stmt->fetch(PDO::FETCH_ASSOC)) {
                    $day_item["exercises"][] = array(
                        "id" => $exercise_row["id"],
                        "exercise_id" => $exercise_row["exercise_id"],
                        "exercise_name" => $exercise_row["exercise_name"],
                        "muscle_group" => $exercise_row["muscle_group"],
                        "sets" => $exercise_row["sets"],
                        "reps" => $exercise_row["reps"],
                        "rest" => $exercise_row["rest"],
                        "notes" => $exercise_row["notes"] ?? "",
                        "intensity_technique" => $exercise_row["intensity_technique"] ?? ""
                    );
                }

                $plan_item["days"][] = $day_item;
            }

            // Add plan to plans array
            array_push($plans_arr["records"], $plan_item);
        }

        // Set response code - 200 OK
        http_response_code(200);

        // Show workout plans data
        echo json_encode($plans_arr);
    } else {
        // Set response code - 200 OK
        http_response_code(200);

        // Tell the user no workout plans found
        echo json_encode(array(
            "message" => "Nessuna scheda di allenamento trovata.",
            "records" => array()
        ));
    }
} catch (Exception $e) {
    // Set response code - 500 Internal Server Error
    http_response_code(500);

    // Tell the user
    echo json_encode(array(
        "message" => "Errore del server: " . $e->getMessage(),
        "success" => false
    ));
}
