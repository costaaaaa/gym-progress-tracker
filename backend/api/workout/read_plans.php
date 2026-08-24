<?php
/**
 * Workout Plans Read API
 */

// Include common CORS headers (this also starts the session and output buffering)
include_once '../../config/cors_headers.php';

// Disable error display only after CORS headers to ensure clean JSON
error_reporting(0);
ini_set('display_errors', 0);

// Include database and workout model
include_once '../../config/database.php';
include_once '../../config/api_helpers.php';
include_once '../../models/WorkoutPlan.php';
include_once '../../models/WorkoutDay.php';
include_once '../../models/WorkoutExercise.php';

// Get database connection
try {
    $database = new Database();
    $db = $database->getConnection();

    if (!$db) {
        throw new Exception("Impossibile stabilire una connessione al database.");
    }

    // resolve_authenticated_user_id() copre sia il percorso web (sessione) sia quello
    // mobile (header Authorization: Bearer).
    $user_id = resolve_authenticated_user_id($db);

    if (!$user_id) {
        http_response_code(401);
        if (ob_get_length()) ob_clean();
        header('Content-Type: application/json');
        echo json_encode(array("message" => "Accesso non autorizzato. Effettua il login."));
        exit;
    }

    $plans_query = "SELECT id, name, description, is_active, created_at, updated_at
                    FROM gym_workout_plans
                    WHERE user_id = ?
                    ORDER BY created_at DESC";
    $stmt = $db->prepare($plans_query);
    $stmt->bindParam(1, $user_id);
    $stmt->execute();
    $plans = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $num = count($plans);

    $plans_arr = array();
    $plans_arr["records"] = array();

    if ($num > 0) {
        $plan_index_by_id = array();
        $day_index_by_id = array();
        $plan_ids = array();

        foreach ($plans as $row) {
            $id = $row['id'];
            $plan_item = array(
                "id" => $id,
                "name" => $row['name'],
                "description" => $row['description'] ?? "",
                "is_active" => $row['is_active'],
                "created_at" => $row['created_at'],
                "updated_at" => $row['updated_at'],
                "days" => array()
            );

            $plan_index_by_id[$id] = count($plans_arr["records"]);
            $plan_ids[] = $id;
            $plans_arr["records"][] = $plan_item;
        }

        $placeholders = implode(',', array_fill(0, count($plan_ids), '?'));
        $days_query = "SELECT id, plan_id, name, day_order
                       FROM gym_workout_days
                       WHERE plan_id IN ($placeholders)
                       ORDER BY plan_id ASC, day_order ASC";
        $days_stmt = $db->prepare($days_query);
        foreach ($plan_ids as $index => $plan_id) {
            $days_stmt->bindValue($index + 1, $plan_id, PDO::PARAM_INT);
        }
        $days_stmt->execute();
        $day_ids = array();

        while ($day_row = $days_stmt->fetch(PDO::FETCH_ASSOC)) {
            $day_item = array(
                "id" => $day_row["id"],
                "name" => $day_row["name"],
                "day_order" => $day_row["day_order"],
                "exercises" => array()
            );

            $plan_index = $plan_index_by_id[$day_row["plan_id"]];
            $day_index = count($plans_arr["records"][$plan_index]["days"]);
            $plans_arr["records"][$plan_index]["days"][] = $day_item;
            $day_index_by_id[$day_row["id"]] = array($plan_index, $day_index);
            $day_ids[] = $day_row["id"];
        }

        if (count($day_ids) > 0) {
            $day_placeholders = implode(',', array_fill(0, count($day_ids), '?'));
            $exercises_query = "SELECT we.id, we.day_id, we.exercise_id, we.sets, we.reps, we.rest,
                                       we.notes, we.intensity_technique,
                                       e.name AS exercise_name, e.muscle_group
                                FROM gym_workout_exercises we
                                LEFT JOIN gym_exercises e ON we.exercise_id = e.id
                                WHERE we.day_id IN ($day_placeholders)
                                ORDER BY we.day_id ASC, we.id ASC";
            $exercises_stmt = $db->prepare($exercises_query);
            foreach ($day_ids as $index => $day_id) {
                $exercises_stmt->bindValue($index + 1, $day_id, PDO::PARAM_INT);
            }
            $exercises_stmt->execute();

            while ($exercise_row = $exercises_stmt->fetch(PDO::FETCH_ASSOC)) {
                list($plan_index, $day_index) = $day_index_by_id[$exercise_row["day_id"]];
                $plans_arr["records"][$plan_index]["days"][$day_index]["exercises"][] = array(
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
        }
        http_response_code(200);
    } else {
        http_response_code(200);
        $plans_arr["message"] = "Nessuna scheda di allenamento trovata.";
    }

    if (ob_get_length()) ob_clean();
    header('Content-Type: application/json');
    echo json_encode($plans_arr);

} catch (Exception $e) {
    http_response_code(500);
    if (ob_get_length()) ob_clean();
    header('Content-Type: application/json');
    error_log("Errore in read_plans.php: " . $e->getMessage());
    echo json_encode(array("message" => "Errore interno del server."));
}
ob_end_flush();
