<?php
// Include common CORS headers
include_once '../../config/cors_headers.php';

// Start session
session_start();

// Clear all session variables
$_SESSION = array();

// Destroy the session
session_destroy();

// Set response code - 200 OK
http_response_code(200);

// Tell the user
echo json_encode(array("message" => "Logout effettuato con successo."));