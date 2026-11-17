<?php
// Codici di registrazione, solo per admin (gli altri ricevono 404). Un codice dà il livello Plus o Pro per un
// numero di giorni dalla conferma dell'email (o per sempre); regole in lib/signup_code_rules.php.
//
//   GET  ?page=N                 elenco a pagine (20 per pagina, più recenti prima): {codes, page, per_page, total, pages}
//   GET  ?id=ID&page=N           dettaglio: {code, uses, page, per_page, total, pages}; uses = gli iscritti con quel
//                                codice (username, status, created_at, applied_at; username null e account_deleted
//                                true se l'account non c'è più), più recenti prima, a pagine di 20
//   POST {action: create, code?, tier, duration_days?, confirm_forever?, max_uses, last_day?, assignee?}
//        code vuoto o assente = lo genera il server (10 caratteri, senza 0/O/1/I); duration_days vuoto o assente =
//        per sempre e richiede confirm_forever: true; last_day = ultimo giorno (AAAA-MM-GG, ora italiana) in cui
//        il codice si può usare, vuoto = non scade
//   POST {action: update, id, max_uses?, last_day?, enabled?, assignee?, tier?, duration_days?, confirm_forever?, code?}
//        max_uses (qualsiasi valore >= posti occupati), last_day, enabled e assignee sempre; tier, duration_days
//        e code solo finché il codice non ha usi (lo stesso valore di prima è sempre ammesso). Solo i campi presenti cambiano.
//   POST {action: delete, id}    solo un codice senza usi
//
// Ogni codice: id, code, tier, duration_days (null = per sempre), forever, max_uses, last_day (null = non scade),
// expired, enabled, assignee, seats_taken (posti occupati), registered (tutti gli usi), confirmed (applied),
// missed, created_at. Errori: {success:false, code, message}.
include_once __DIR__ . '/../../config/cors_headers.php';
include_once __DIR__ . '/../../config/database.php';
include_once __DIR__ . '/../../config/api_helpers.php';
include_once __DIR__ . '/../../models/SignupCode.php';

header('Content-Type: application/json');

const SIGNUP_ADMIN_PAGE_SIZE = 20;
const SIGNUP_ASSIGNEE_MAX = 100;

function signup_admin_page(): int
{
    $p = $_GET['page'] ?? 1;
    return (is_string($p) && ctype_digit($p) && (int)$p >= 1 && (int)$p <= 1000000) ? (int)$p : 1;
}

function signup_admin_pager(int $page, int $total): array
{
    return array('page' => $page, 'per_page' => SIGNUP_ADMIN_PAGE_SIZE, 'total' => $total,
        'pages' => max(1, (int)ceil($total / SIGNUP_ADMIN_PAGE_SIZE)));
}

// Righe dei codici di $ids (id => riga con i campi dell'elenco) in un solo giro di query
function signup_admin_rows($db, array $codes): array
{
    $ids = array_map(function ($c) { return (int)$c['id']; }, $codes);
    $counts = array();
    $seatUses = array();
    if ($ids) {
        $in = implode(',', array_fill(0, count($ids), '?'));
        $stmt = $db->prepare("SELECT code_id, COUNT(*) AS registered, SUM(status = 'applied') AS confirmed, SUM(status = 'missed') AS missed
                              FROM gym_signup_code_uses WHERE code_id IN ($in) GROUP BY code_id");
        $stmt->execute($ids);
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
            $counts[(int)$r['code_id']] = $r;
        }
        $stmt = $db->prepare("SELECT s.code_id, s.status, g.id IS NOT NULL AS user_exists, UNIX_TIMESTAMP(g.created_at) AS created_ts
                              FROM gym_signup_code_uses s LEFT JOIN gym_users g ON g.id = s.user_id
                              WHERE s.code_id IN ($in) AND (s.status = 'applied' OR (s.status = 'pending' AND s.user_id IS NOT NULL))");
        $stmt->execute($ids);
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
            $seatUses[(int)$r['code_id']][] = array('status' => $r['status'], 'user_exists' => (int)$r['user_exists'] === 1,
                'user_created_ts' => $r['created_ts'] === null ? null : (int)$r['created_ts']);
        }
    }
    $nowTs = (int)$db->query("SELECT UNIX_TIMESTAMP()")->fetchColumn();
    $nowUtc = gmdate('Y-m-d H:i:s', $nowTs);
    return array_map(function ($c) use ($counts, $seatUses, $nowTs, $nowUtc) {
        $id = (int)$c['id'];
        return array(
            'id' => $id,
            'code' => $c['code'],
            'tier' => $c['tier'],
            'duration_days' => $c['duration_days'] === null ? null : (int)$c['duration_days'],
            'forever' => $c['duration_days'] === null,
            'max_uses' => (int)$c['max_uses'],
            'last_day' => tierLastDay($c['expires_at']),
            'expired' => signupCodeIsExpired($c['expires_at'], $nowUtc),
            'enabled' => (int)$c['enabled'] === 1,
            'assignee' => $c['assignee'],
            'seats_taken' => signupCodeSeatsTaken($seatUses[$id] ?? array(), $nowTs),
            'registered' => (int)($counts[$id]['registered'] ?? 0),
            'confirmed' => (int)($counts[$id]['confirmed'] ?? 0),
            'missed' => (int)($counts[$id]['missed'] ?? 0),
            'created_at' => server_time_iso($c['created_at']),
        );
    }, $codes);
}

const SIGNUP_CODE_COLUMNS = 'id, code, tier, duration_days, max_uses, expires_at, enabled, assignee, created_at';

// Numero intero positivo da JSON: int, oppure stringa di sole cifre
function signup_admin_int($v): ?int
{
    if (is_string($v) && ctype_digit($v) && strlen($v) <= 10) {
        $v = (int)$v;
    }
    return (is_int($v) && $v >= 1 && $v <= 2147483647) ? $v : null;
}

// Durata: ['days' => ?int] oppure ['error' => [codice, messaggio]]. Vuota o assente = per sempre (serve la conferma).
function signup_admin_duration($raw, $confirmForever): array
{
    if ($raw === null || $raw === '') {
        if ($confirmForever !== true) {
            return array('error' => array('confirm_forever_required',
                'Senza durata il codice dà il livello per sempre: conferma con confirm_forever.'));
        }
        return array('days' => null);
    }
    $days = signup_admin_int($raw);
    if ($days === null || $days > SIGNUP_CODE_MAX_DURATION_DAYS) {
        return array('error' => array('invalid_duration', 'Durata non valida (da 1 a ' . SIGNUP_CODE_MAX_DURATION_DAYS . ' giorni, o vuota per sempre).'));
    }
    return array('days' => $days);
}

// Ultimo giorno d'uso -> expires_at: ['expires_at' => ?string] o ['error' => messaggio]
function signup_admin_last_day($raw, string $nowUtc): array
{
    if ($raw === null || $raw === '') {
        return array('expires_at' => null);
    }
    if (!is_string($raw)) {
        return array('error' => 'Data non valida (formato AAAA-MM-GG).');
    }
    $r = tierSetUntil('plus', $raw, $nowUtc);
    return isset($r['error']) ? array('error' => $r['error']) : array('expires_at' => $r['until']);
}

// Assegnatario: ['assignee' => ?string] o ['error' => messaggio]
function signup_admin_assignee($raw): array
{
    if ($raw === null) {
        return array('assignee' => null);
    }
    if (!is_string($raw) || mb_strlen(trim($raw), 'UTF-8') > SIGNUP_ASSIGNEE_MAX) {
        return array('error' => 'Assegnatario non valido (testo fino a ' . SIGNUP_ASSIGNEE_MAX . ' caratteri).');
    }
    $v = trim($raw);
    return array('assignee' => $v === '' ? null : $v);
}

function signup_admin_begin($db): void
{
    $db->exec("SET TRANSACTION ISOLATION LEVEL READ COMMITTED");
    $db->beginTransaction();
}

// Interrompe la transazione aperta e risponde con un errore
function signup_admin_fail($db, int $status, string $code, string $message): void
{
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    api_error($status, $code, $message);
}

try {
    $database = new Database();
    $db = $database->getConnection();
    require_admin($db);
    $nowUtc = gmdate('Y-m-d H:i:s');

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $page = signup_admin_page();
        $offset = ($page - 1) * SIGNUP_ADMIN_PAGE_SIZE;
        if (isset($_GET['id'])) {
            $id = is_string($_GET['id']) ? signup_admin_int($_GET['id']) : null;
            $stmt = $db->prepare("SELECT " . SIGNUP_CODE_COLUMNS . " FROM gym_signup_codes WHERE id = ?");
            $stmt->execute([$id ?? 0]);
            $code = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$code) {
                api_error(404, 'code_not_found', 'Codice non trovato.');
            }
            $total = $db->prepare("SELECT COUNT(*) FROM gym_signup_code_uses WHERE code_id = ?");
            $total->execute([$id]);
            $total = (int)$total->fetchColumn();
            $stmt = $db->prepare("SELECT s.status, s.created_at, s.applied_at, g.username
                                  FROM gym_signup_code_uses s LEFT JOIN gym_users g ON g.id = s.user_id
                                  WHERE s.code_id = ? ORDER BY s.id DESC LIMIT " . SIGNUP_ADMIN_PAGE_SIZE . " OFFSET " . (int)$offset);
            $stmt->execute([$id]);
            $uses = array_map(function ($r) {
                return array(
                    'username' => $r['username'],
                    'account_deleted' => $r['username'] === null,
                    'status' => $r['status'],
                    'created_at' => server_time_iso($r['created_at']),
                    'applied_at' => server_time_iso($r['applied_at']),
                );
            }, $stmt->fetchAll(PDO::FETCH_ASSOC));
            api_json_response(array('success' => true, 'code' => signup_admin_rows($db, array($code))[0], 'uses' => $uses)
                + signup_admin_pager($page, $total));
        }
        $total = (int)$db->query("SELECT COUNT(*) FROM gym_signup_codes")->fetchColumn();
        $stmt = $db->query("SELECT " . SIGNUP_CODE_COLUMNS . " FROM gym_signup_codes ORDER BY id DESC LIMIT " . SIGNUP_ADMIN_PAGE_SIZE . " OFFSET " . (int)$offset);
        api_json_response(array('success' => true, 'codes' => signup_admin_rows($db, $stmt->fetchAll(PDO::FETCH_ASSOC)))
            + signup_admin_pager($page, $total));
    }
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        api_error(405, 'method_not_allowed', 'Metodo non consentito');
    }

    $data = json_decode(file_get_contents('php://input'), true);
    $data = is_array($data) ? $data : array();
    $action = $data['action'] ?? '';

    if ($action === 'create') {
        $tier = $data['tier'] ?? null;
        if (!is_string($tier) || !in_array($tier, SIGNUP_TIERS, true)) {
            api_error(400, 'invalid_tier', 'Livello non valido (plus o pro).');
        }
        $duration = signup_admin_duration($data['duration_days'] ?? null, $data['confirm_forever'] ?? null);
        if (isset($duration['error'])) {
            api_error(400, $duration['error'][0], $duration['error'][1]);
        }
        $maxUses = signup_admin_int($data['max_uses'] ?? null);
        if ($maxUses === null) {
            api_error(400, 'invalid_max_uses', 'Posti non validi (almeno 1).');
        }
        $last = signup_admin_last_day($data['last_day'] ?? null, $nowUtc);
        if (isset($last['error'])) {
            api_error(400, 'invalid_date', $last['error']);
        }
        $assignee = signup_admin_assignee($data['assignee'] ?? null);
        if (isset($assignee['error'])) {
            api_error(400, 'invalid_assignee', $assignee['error']);
        }
        $rawCode = $data['code'] ?? null;
        $generate = $rawCode === null || (is_string($rawCode) && trim($rawCode) === '');
        $code = null;
        if (!$generate) {
            $code = signupCodeNormalize($rawCode);
            if ($code === null) {
                api_error(400, 'invalid_code', 'Codice non valido: da ' . SIGNUP_CODE_MIN_LENGTH . ' a ' . SIGNUP_CODE_MAX_LENGTH . ' caratteri tra lettere, cifre e trattino.');
            }
        }
        $insert = $db->prepare("INSERT INTO gym_signup_codes (code, tier, duration_days, max_uses, expires_at, assignee) VALUES (?, ?, ?, ?, ?, ?)");
        $id = null;
        for ($attempt = 0; $attempt < ($generate ? 10 : 1) && $id === null; $attempt++) {
            $candidate = $generate ? signupCodeGenerate() : $code;
            try {
                $insert->execute([$candidate, $tier, $duration['days'], $maxUses, $last['expires_at'], $assignee['assignee']]);
                $id = (int)$db->lastInsertId();
            } catch (PDOException $e) {
                if (($e->errorInfo[0] ?? $e->getCode()) !== '23000') {
                    throw $e;
                }
                if (!$generate) {
                    api_error(409, 'code_taken', 'Esiste già un codice con questo testo.');
                }
            }
        }
        if ($id === null) {
            api_error(500, 'server_error', 'Impossibile generare un codice libero: riprova.');
        }
        $stmt = $db->prepare("SELECT " . SIGNUP_CODE_COLUMNS . " FROM gym_signup_codes WHERE id = ?");
        $stmt->execute([$id]);
        api_json_response(array('success' => true, 'code' => signup_admin_rows($db, array($stmt->fetch(PDO::FETCH_ASSOC)))[0]), 201);
    }

    if ($action === 'update' || $action === 'delete') {
        $id = signup_admin_int($data['id'] ?? null);
        signup_admin_begin($db);
        $stmt = $db->prepare("SELECT " . SIGNUP_CODE_COLUMNS . " FROM gym_signup_codes WHERE id = ? FOR UPDATE");
        $stmt->execute([$id ?? 0]);
        $code = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$code) {
            signup_admin_fail($db, 404, 'code_not_found', 'Codice non trovato.');
        }
        $usesCount = $db->prepare("SELECT COUNT(*) FROM gym_signup_code_uses WHERE code_id = ?");
        $usesCount->execute([$id]);
        $hasUses = (int)$usesCount->fetchColumn() > 0;

        if ($action === 'delete') {
            if ($hasUses) {
                signup_admin_fail($db, 409, 'code_has_uses', 'Un codice già usato non si elimina: spegnilo.');
            }
            $db->prepare("DELETE FROM gym_signup_codes WHERE id = ?")->execute([$id]);
            $db->commit();
            api_json_response(array('success' => true));
        }

        $set = array();
        $params = array();
        if (array_key_exists('max_uses', $data)) {
            $maxUses = signup_admin_int($data['max_uses']);
            if ($maxUses === null) {
                signup_admin_fail($db, 400, 'invalid_max_uses', 'Posti non validi (almeno 1).');
            }
            $taken = SignupCode::seatsTaken($db, $id);
            if ($maxUses < $taken) {
                signup_admin_fail($db, 400, 'max_uses_below_taken', "I posti non possono essere meno di quelli occupati ($taken).");
            }
            $set[] = 'max_uses = ?';
            $params[] = $maxUses;
        }
        if (array_key_exists('last_day', $data) && $data['last_day'] !== tierLastDay($code['expires_at'])) {
            $last = signup_admin_last_day($data['last_day'], $nowUtc);
            if (isset($last['error'])) {
                signup_admin_fail($db, 400, 'invalid_date', $last['error']);
            }
            $set[] = 'expires_at = ?';
            $params[] = $last['expires_at'];
        }
        if (array_key_exists('enabled', $data)) {
            if (!is_bool($data['enabled'])) {
                signup_admin_fail($db, 400, 'invalid_enabled', 'Valore non valido per enabled (true o false).');
            }
            $set[] = 'enabled = ?';
            $params[] = $data['enabled'] ? 1 : 0;
        }
        if (array_key_exists('assignee', $data)) {
            $assignee = signup_admin_assignee($data['assignee']);
            if (isset($assignee['error'])) {
                signup_admin_fail($db, 400, 'invalid_assignee', $assignee['error']);
            }
            $set[] = 'assignee = ?';
            $params[] = $assignee['assignee'];
        }
        // Livello, durata e testo: solo finché il codice non ha usi (il valore invariato è sempre ammesso)
        $locked = function ($field) use ($db, $hasUses) {
            if ($hasUses) {
                signup_admin_fail($db, 409, 'code_has_uses', "Dopo il primo uso $field non si cambia.");
            }
        };
        if (array_key_exists('tier', $data) && $data['tier'] !== $code['tier']) {
            if (!is_string($data['tier']) || !in_array($data['tier'], SIGNUP_TIERS, true)) {
                signup_admin_fail($db, 400, 'invalid_tier', 'Livello non valido (plus o pro).');
            }
            $locked('il livello');
            $set[] = 'tier = ?';
            $params[] = $data['tier'];
        }
        if (array_key_exists('duration_days', $data)) {
            $duration = signup_admin_duration($data['duration_days'], $data['confirm_forever'] ?? null);
            if (isset($duration['error'])) {
                signup_admin_fail($db, 400, $duration['error'][0], $duration['error'][1]);
            }
            $current = $code['duration_days'] === null ? null : (int)$code['duration_days'];
            if ($duration['days'] !== $current) {
                $locked('la durata');
                $set[] = 'duration_days = ?';
                $params[] = $duration['days'];
            }
        }
        if (array_key_exists('code', $data)) {
            $newCode = signupCodeNormalize($data['code']);
            if ($newCode === null) {
                signup_admin_fail($db, 400, 'invalid_code', 'Codice non valido: da ' . SIGNUP_CODE_MIN_LENGTH . ' a ' . SIGNUP_CODE_MAX_LENGTH . ' caratteri tra lettere, cifre e trattino.');
            }
            if ($newCode !== $code['code']) {
                $locked('il testo del codice');
                $set[] = 'code = ?';
                $params[] = $newCode;
            }
        }
        if ($set) {
            $params[] = $id;
            try {
                $db->prepare("UPDATE gym_signup_codes SET " . implode(', ', $set) . " WHERE id = ?")->execute($params);
            } catch (PDOException $e) {
                if (($e->errorInfo[0] ?? $e->getCode()) !== '23000') {
                    throw $e;
                }
                signup_admin_fail($db, 409, 'code_taken', 'Esiste già un codice con questo testo.');
            }
        }
        $db->commit();
        $stmt = $db->prepare("SELECT " . SIGNUP_CODE_COLUMNS . " FROM gym_signup_codes WHERE id = ?");
        $stmt->execute([$id]);
        api_json_response(array('success' => true, 'code' => signup_admin_rows($db, array($stmt->fetch(PDO::FETCH_ASSOC)))[0]));
    }

    api_error(400, 'invalid_action', 'Azione non valida.');
} catch (Throwable $e) {
    if (isset($db) && $db && $db->inTransaction()) {
        $db->rollBack();
    }
    api_log_exception('admin/signup_codes.php', $e);
    if (ob_get_length()) ob_clean();
    api_error(500, 'server_error', 'Errore interno del server.');
}
