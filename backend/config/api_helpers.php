<?php

function api_json_response($payload, $status_code = 200)
{
    http_response_code($status_code);
    echo json_encode($payload);
    exit;
}

function api_not_found($message = 'Risorsa non trovata.')
{
    api_json_response([
        'success' => false,
        'message' => $message
    ], 404);
}

function api_server_error($message = 'Errore interno del server.')
{
    api_json_response([
        'success' => false,
        'message' => $message
    ], 500);
}

function api_log_exception($context, $exception)
{
    error_log($context . ': ' . $exception->getMessage());
}

function workout_plan_belongs_to_user($db, $plan_id, $user_id)
{
    $query = "SELECT id FROM gym_workout_plans WHERE id = ? AND user_id = ? LIMIT 1";
    $stmt = $db->prepare($query);
    $stmt->bindParam(1, $plan_id);
    $stmt->bindParam(2, $user_id);
    $stmt->execute();

    return $stmt->fetch(PDO::FETCH_ASSOC) !== false;
}

function workout_day_belongs_to_user($db, $day_id, $user_id)
{
    $query = "SELECT wd.id
              FROM gym_workout_days wd
              INNER JOIN gym_workout_plans wp ON wd.plan_id = wp.id
              WHERE wd.id = ? AND wp.user_id = ?
              LIMIT 1";
    $stmt = $db->prepare($query);
    $stmt->bindParam(1, $day_id);
    $stmt->bindParam(2, $user_id);
    $stmt->execute();

    return $stmt->fetch(PDO::FETCH_ASSOC) !== false;
}

function workout_exercise_belongs_to_user($db, $workout_exercise_id, $day_id, $user_id)
{
    $query = "SELECT we.id
              FROM gym_workout_exercises we
              INNER JOIN gym_workout_days wd ON we.day_id = wd.id
              INNER JOIN gym_workout_plans wp ON wd.plan_id = wp.id
              WHERE we.id = ? AND we.day_id = ? AND wp.user_id = ?
              LIMIT 1";
    $stmt = $db->prepare($query);
    $stmt->bindParam(1, $workout_exercise_id);
    $stmt->bindParam(2, $day_id);
    $stmt->bindParam(3, $user_id);
    $stmt->execute();

    return $stmt->fetch(PDO::FETCH_ASSOC) !== false;
}
