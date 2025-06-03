<?php
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json');
header('Access-Control-Allow-Methods: GET');
header('Access-Control-Allow-Headers: Access-Control-Allow-Headers, Content-Type, Access-Control-Allow-Methods, Authorization, X-Requested-With');

include_once '../../config/database.php';
include_once '../../models/User.php';

session_start();

$database = new Database();
$db = $database->getConnection();

$user = new User($db);

$user_id = isset($_SESSION['user_id']) ? $_SESSION['user_id'] : null;

if (!$user_id) {
    http_response_code(401);
    echo json_encode(array('success' => false, 'message' => 'Utente non autenticato'));
    exit;
}

if ($user->readById($user_id)) {
    echo json_encode(array(
        'success' => true,
        'id' => $user->id,
        'username' => $user->username,
        'email' => $user->email,
        'created_at' => $user->created_at
    ));
} else {
    http_response_code(404);
    echo json_encode(array('success' => false, 'message' => 'Utente non trovato'));
}