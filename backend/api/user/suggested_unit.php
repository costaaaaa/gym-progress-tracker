<?php
// GET, senza login → {"success": true, "suggested_weight_unit": "kg"|"lb"}: l'unità da preimpostare nel modulo di
// registrazione, calcolata dal solo Accept-Language (lb se il primo tag ha regione US, altrimenti kg). Non salva né
// registra nulla (nessun cookie, nessuna posizione): l'unità resta quella che l'utente conferma nel modulo.
// Sta in un endpoint a parte perché la pagina di registrazione non fa nessuna richiesta senza login al caricamento
// (check_availability.php parte solo dal primo passo). Stesso limite per IP del primo passo della registrazione.
include_once '../../config/cors_headers.php';
include_once '../../config/database.php';
include_once '../../config/api_helpers.php';
include_once '../../config/rate_limiter.php';

header('Content-Type: application/json');

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        header('Allow: GET');
        api_error(405, 'method_not_allowed', t_server('common.invalid_request'));
    }

    $database = new Database();
    $db = $database->getConnection();
    enforce_rate_limit($db, 'check_ip', client_ip_key('unit'));

    api_json_response(array(
        'success' => true,
        'suggested_weight_unit' => suggested_weight_unit($_SERVER['HTTP_ACCEPT_LANGUAGE'] ?? null)
    ));
} catch (Throwable $e) {
    api_log_exception('user/suggested_unit.php', $e);
    if (ob_get_length()) ob_clean();
    api_error(500, 'server_error', t_server('common.server_error'));
}
