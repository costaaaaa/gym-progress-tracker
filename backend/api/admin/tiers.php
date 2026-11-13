<?php
// Livello degli utenti (free, plus, pro), solo per admin (gli altri ricevono 404): cerca un utente e
// gli assegna il livello, senza passare dal terminale (backend/tools/tier.php fa lo stesso).
//
//   GET  ?q=testo                                   utenti con quel testo nello username o nell'email
//                                                   (almeno 2 caratteri, al massimo 20, per username)
//   POST {action: set_tier, id, tier, last_day}     last_day = ultimo giorno valido compreso (AAAA-MM-GG,
//                                                   UTC); null, assente o stringa vuota = senza scadenza;
//                                                   con free niente data
//
// Ogni utente: id, username, email, tier (salvato), last_day (null se non scade), effective_tier
// (quello in vigore: free se il salvato è scaduto).
include_once __DIR__ . '/../../config/cors_headers.php';
include_once __DIR__ . '/../../config/database.php';
include_once __DIR__ . '/../../config/api_helpers.php';

header('Content-Type: application/json');

const TIER_SEARCH_MIN = 2;
const TIER_USER_COLUMNS = 'id, username, email, tier, tier_until';

function tier_user_row(array $r, string $now): array
{
    return array(
        'id' => (int)$r['id'],
        'username' => $r['username'],
        'email' => $r['email'],
        'tier' => $r['tier'],
        'last_day' => tierLastDay($r['tier_until']),
        'effective_tier' => tierEffective($r['tier'], $r['tier_until'], $now),
    );
}

try {
    $database = new Database();
    $db = $database->getConnection();
    require_admin($db);
    $now = gmdate('Y-m-d H:i:s');

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $q = is_string($_GET['q'] ?? null) ? trim($_GET['q']) : '';
        $users = array();
        if (mb_strlen($q, 'UTF-8') >= TIER_SEARCH_MIN) {
            $like = '%' . addcslashes($q, '%_\\') . '%';
            $stmt = $db->prepare(
                "SELECT " . TIER_USER_COLUMNS . " FROM gym_users
                 WHERE username LIKE ? OR email LIKE ?
                 ORDER BY username, id
                 LIMIT 20"
            );
            $stmt->execute([$like, $like]);
            $users = array_map(function ($r) use ($now) {
                return tier_user_row($r, $now);
            }, $stmt->fetchAll(PDO::FETCH_ASSOC));
        }
        api_json_response(array('success' => true, 'users' => $users));
    }
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        api_error(405, 'method_not_allowed', 'Metodo non consentito');
    }

    $data = json_decode(file_get_contents('php://input'), true);
    $data = is_array($data) ? $data : array();
    if (($data['action'] ?? '') !== 'set_tier') {
        api_error(400, 'invalid_action', 'Azione non valida.');
    }
    $id = $data['id'] ?? null;
    $user = false;
    if (is_int($id) && $id > 0) {
        $stmt = $db->prepare("SELECT " . TIER_USER_COLUMNS . " FROM gym_users WHERE id = ?");
        $stmt->execute([$id]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
    }
    if (!$user) {
        api_error(404, 'user_not_found', 'Utente non trovato.');
    }
    $tier = $data['tier'] ?? null;
    if (!is_string($tier) || !in_array($tier, TIER_LEVELS, true)) {
        api_error(400, 'invalid_tier', 'Livello non valido (free, plus o pro).');
    }
    $lastDay = $data['last_day'] ?? null;
    if ($lastDay === '') {
        $lastDay = null;
    }
    if ($lastDay !== null && !is_string($lastDay)) {
        api_error(400, 'invalid_date', 'Data non valida (formato AAAA-MM-GG).');
    }
    $r = tierSetUntil($tier, $lastDay, $now);
    if (isset($r['error'])) {
        api_error(400, 'invalid_date', $r['error']);
    }

    $db->prepare("UPDATE gym_users SET tier = ?, tier_until = ? WHERE id = ?")->execute([$tier, $r['until'], $id]);
    $user['tier'] = $tier;
    $user['tier_until'] = $r['until'];
    api_json_response(array('success' => true, 'user' => tier_user_row($user, $now)));
} catch (Throwable $e) {
    api_log_exception('admin/tiers.php', $e);
    if (ob_get_length()) ob_clean();
    api_error(500, 'server_error', 'Errore interno del server.');
}
