<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
echo json_encode(array("status" => "success", "message" => "Connessione al backend riuscita!", "server_time" => date('Y-m-d H:i:s')));
?>