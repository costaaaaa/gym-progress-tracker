<?php
include_once '../../config/cors_headers.php';

echo json_encode(array("status" => "success", "message" => "Connessione al backend riuscita!", "server_time" => date('Y-m-d H:i:s')));
