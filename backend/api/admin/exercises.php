<?php
// Moderazione del catalogo esercizi, solo per admin (gli altri ricevono 404).
//
//   GET  ?status=pending|approved|rejected     elenco (default pending) + gruppi muscolari ammessi
//   POST {action, ...}
//     approve {id}                              in attesa o rifiutato → visibile a tutti
//     reject {id}                               in attesa → resta solo di chi l'ha creato
//     update {id, name, muscle_group}           corregge nome o gruppo prima di approvare
//     create {name, muscle_group}               esercizio ufficiale, già approvato
//     delete {id}                               solo se nessuno lo usa
include_once __DIR__ . '/../../config/cors_headers.php';
include_once __DIR__ . '/../../config/database.php';
include_once __DIR__ . '/../../config/api_helpers.php';
include_once __DIR__ . '/../../models/Exercise.php';

header('Content-Type: application/json');

// Nome e gruppo muscolare validati, o esce con 400
function admin_exercise_input($exercise, $data)
{
    $name = Exercise::cleanName($data['name'] ?? null);
    if ($name === null) {
        api_error(400, 'invalid_name', 'Il nome deve avere da 2 a 60 caratteri (lettere, numeri e punteggiatura semplice) e non può contenere link.');
    }
    $muscle_group = is_string($data['muscle_group'] ?? null) ? mb_strtolower(trim($data['muscle_group']), 'UTF-8') : '';
    if (!in_array($muscle_group, $exercise->muscleGroups(), true)) {
        api_error(400, 'invalid_muscle_group', 'Gruppo muscolare non valido.');
    }
    return array($name, $muscle_group);
}

function admin_exercise_or_404($exercise, $id)
{
    $row = $exercise->find($id);
    if (!$row) {
        api_error(404, 'exercise_not_found', 'Esercizio non trovato.');
    }
    return $row;
}

try {
    $database = new Database();
    $db = $database->getConnection();
    require_admin($db);
    $exercise = new Exercise($db);

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $status = $_GET['status'] ?? 'pending';
        if (!in_array($status, Exercise::STATUSES, true)) {
            api_error(400, 'invalid_status', 'Stato non valido.');
        }
        api_json_response(array(
            'success' => true,
            'exercises' => $exercise->adminList($status),
            'muscle_groups' => $exercise->muscleGroups(),
        ));
    }
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        api_error(405, 'method_not_allowed', 'Metodo non consentito');
    }

    $data = json_decode(file_get_contents('php://input'), true);
    $data = is_array($data) ? $data : array();
    $id = (int)($data['id'] ?? 0);

    switch ($data['action'] ?? '') {
        case 'approve':
            $row = admin_exercise_or_404($exercise, $id);
            if ($row['status'] === 'approved') {
                api_error(409, 'already_approved', 'Esercizio già approvato.');
            }
            if ($exercise->approvedNameTaken($row['name'], $id)) {
                api_error(409, 'duplicate', 'Nel catalogo c\'è già un esercizio con questo nome: rinominalo o rifiutalo.');
            }
            $exercise->setStatus($id, 'approved');
            api_json_response(array('success' => true, 'status' => 'approved'));

        case 'reject':
            $row = admin_exercise_or_404($exercise, $id);
            if ($row['status'] !== 'pending') {
                api_error(409, 'not_pending', 'Si possono rifiutare solo gli esercizi in attesa.');
            }
            $exercise->setStatus($id, 'rejected');
            api_json_response(array('success' => true, 'status' => 'rejected'));

        case 'update':
            $row = admin_exercise_or_404($exercise, $id);
            list($name, $muscle_group) = admin_exercise_input($exercise, $data);
            if ($row['status'] === 'approved' && $exercise->approvedNameTaken($name, $id)) {
                api_error(409, 'duplicate', 'Nel catalogo c\'è già un esercizio con questo nome.');
            }
            $exercise->updateDetails($id, $name, $muscle_group);
            api_json_response(array('success' => true, 'name' => $name, 'muscle_group' => $muscle_group));

        case 'create':
            list($name, $muscle_group) = admin_exercise_input($exercise, $data);
            if ($exercise->approvedNameTaken($name)) {
                api_error(409, 'duplicate', 'Nel catalogo c\'è già un esercizio con questo nome.');
            }
            $exercise->name = $name;
            $exercise->muscle_group = $muscle_group;
            $exercise->created_by = null;
            $exercise->status = 'approved';
            if (!$exercise->create()) {
                throw new Exception('INSERT gym_exercises fallita');
            }
            api_json_response(array('success' => true, 'id' => $exercise->id), 201);

        case 'delete':
            admin_exercise_or_404($exercise, $id);
            if ($exercise->usageCount($id) > 0) {
                api_error(409, 'in_use', 'L\'esercizio è usato in schede o allenamenti: non si può eliminare.');
            }
            $exercise->delete($id);
            api_json_response(array('success' => true));

        default:
            api_error(400, 'invalid_action', 'Azione non valida.');
    }
} catch (Throwable $e) {
    api_log_exception('admin/exercises.php', $e);
    if (ob_get_length()) ob_clean();
    api_error(500, 'server_error', 'Errore interno del server.');
}
