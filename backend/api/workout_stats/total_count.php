<?php
// Include common CORS headers
include_once '../../config/cors_headers.php';

// Include database
include_once '../../config/database.php';

// Start session
session_start();

// Check if user is authenticated
if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Utente non autenticato']);
    exit;
}

try {
    $database = new Database();
    $db = $database->getConnection();
    $user_id = $_SESSION['user_id'];

    // Query for total workout count
    $query = "SELECT COUNT(*) as total FROM gym_workout_history WHERE user_id = ?";
    $stmt = $db->prepare($query);
    $stmt->execute([$user_id]);
    $total = $stmt->fetch(PDO::FETCH_ASSOC)['total'];

    http_response_code(200);
    echo json_encode([
        'success' => true,
        'total' => (int)$total
    ]);
} catch (Exception $e) {
    error_log("Workout total count error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Errore nel recupero del conteggio allenamenti.'
    ]);
}
?>
