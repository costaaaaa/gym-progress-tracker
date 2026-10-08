<?php
include_once '../../config/cors_headers.php';
include_once '../../config/api_helpers.php';

// Start session
session_start();

// Clear all session variables
$_SESSION = array();

// Destroy the session
session_destroy();

http_response_code(200);

echo json_encode(array("message" => t_server('auth.logout_ok')));