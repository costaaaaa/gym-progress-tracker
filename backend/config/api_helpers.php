<?php

include_once __DIR__ . '/../models/ApiToken.php';

// Token Bearer in chiaro dall'header Authorization, o null.
function bearer_token_from_request()
{
    $auth_header = $_SERVER['HTTP_AUTHORIZATION'] ?? null;
    if (!$auth_header || stripos($auth_header, 'Bearer ') !== 0) {
        return null;
    }
    $plain_token = trim(substr($auth_header, 7));
    return $plain_token === '' ? null : $plain_token;
}

// True se la sessione web e' ancora valida: l'utente esiste e la password non e' cambiata
// dopo l'accesso. Le sessioni aperte prima di questo controllo (senza auth_at) vengono
// marcate al primo uso.
function web_session_is_current($db, $user_id)
{
    $stmt = $db->prepare("SELECT UNIX_TIMESTAMP(password_changed_at) AS changed_at FROM gym_users WHERE id = ? LIMIT 1");
    $stmt->execute([$user_id]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) {
        return false;
    }
    if (!isset($_SESSION['auth_at'])) {
        $_SESSION['auth_at'] = time();
        return true;
    }
    return $row['changed_at'] === null || (int)$row['changed_at'] <= (int)$_SESSION['auth_at'];
}

// Risolve l'utente autenticato provando prima la sessione web (percorso invariato),
// poi — se assente — l'header "Authorization: Bearer <token>" usato dai client mobile.
// Ritorna l'user_id (int) o null se non autenticato con nessuno dei due metodi.
function resolve_authenticated_user_id($db)
{
    if (isset($_SESSION['user_id'])) {
        $user_id = (int)$_SESSION['user_id'];
        if (web_session_is_current($db, $user_id)) {
            return $user_id;
        }
        $_SESSION = array();
        session_destroy();
        return null;
    }

    $plain_token = bearer_token_from_request();
    if ($plain_token === null) {
        return null;
    }

    $api_token = new ApiToken($db);
    return $api_token->findValidByToken($plain_token);
}

function api_json_response($payload, $status_code = 200)
{
    http_response_code($status_code);
    echo json_encode($payload);
    exit;
}

function api_not_found($message = 'Risorsa non trovata.')
{
    api_json_response([
        'success' => false,
        'message' => $message
    ], 404);
}

function api_server_error($message = 'Errore interno del server.')
{
    api_json_response([
        'success' => false,
        'message' => $message
    ], 500);
}

function api_log_exception($context, $exception)
{
    error_log($context . ': ' . $exception->getMessage());
}

function workout_plan_belongs_to_user($db, $plan_id, $user_id)
{
    $query = "SELECT id FROM gym_workout_plans WHERE id = ? AND user_id = ? LIMIT 1";
    $stmt = $db->prepare($query);
    $stmt->bindParam(1, $plan_id);
    $stmt->bindParam(2, $user_id);
    $stmt->execute();

    return $stmt->fetch(PDO::FETCH_ASSOC) !== false;
}

function workout_day_belongs_to_user($db, $day_id, $user_id)
{
    $query = "SELECT wd.id
              FROM gym_workout_days wd
              INNER JOIN gym_workout_plans wp ON wd.plan_id = wp.id
              WHERE wd.id = ? AND wp.user_id = ?
              LIMIT 1";
    $stmt = $db->prepare($query);
    $stmt->bindParam(1, $day_id);
    $stmt->bindParam(2, $user_id);
    $stmt->execute();

    return $stmt->fetch(PDO::FETCH_ASSOC) !== false;
}

function workout_exercise_belongs_to_user($db, $workout_exercise_id, $day_id, $user_id)
{
    $query = "SELECT we.id
              FROM gym_workout_exercises we
              INNER JOIN gym_workout_days wd ON we.day_id = wd.id
              INNER JOIN gym_workout_plans wp ON wd.plan_id = wp.id
              WHERE we.id = ? AND we.day_id = ? AND wp.user_id = ?
              LIMIT 1";
    $stmt = $db->prepare($query);
    $stmt->bindParam(1, $workout_exercise_id);
    $stmt->bindParam(2, $day_id);
    $stmt->bindParam(3, $user_id);
    $stmt->execute();

    return $stmt->fetch(PDO::FETCH_ASSOC) !== false;
}


// Sesso ammesso: M, F o O (altro). Nessun valore predefinito lato server: va scelto.
function valid_gender($gender)
{
    return is_string($gender) && in_array($gender, array('M', 'F', 'O'), true);
}

// Valida una data di nascita 'Y-m-d' e l'eta' minima (14 anni, art. 2-quinquies Codice privacy).
// Ritorna null se valida, altrimenti il messaggio d'errore da mostrare all'utente.
function birth_date_error($birth_date)
{
    $birth = is_string($birth_date) ? DateTime::createFromFormat('!Y-m-d', $birth_date) : false;
    if (!$birth || $birth->format('Y-m-d') !== $birth_date || $birth > new DateTime('today')) {
        return 'Data di nascita obbligatoria o non valida.';
    }
    if ($birth->diff(new DateTime('today'))->y < 14) {
        return 'Devi avere almeno 14 anni per usare LiftIndex.';
    }
    return null;
}

// ── Gruppi ──────────────────────────────────────────────────────────────────

// Errore con un codice stabile, così web e mobile mostrano lo stesso messaggio
function api_error($status_code, $code, $message)
{
    api_json_response([
        'success' => false,
        'code' => $code,
        'message' => $message
    ], $status_code);
}

// Riga di appartenenza (role, share_level, joined_at) dell'utente al gruppo, o null
function group_membership($db, $group_id, $user_id)
{
    $stmt = $db->prepare("SELECT role, share_level, joined_at FROM gym_group_members WHERE group_id = ? AND user_id = ? LIMIT 1");
    $stmt->execute([(int)$group_id, (int)$user_id]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return $row ?: null;
}

// Chi non è membro riceve 404, come se il gruppo non esistesse
function require_group_member($db, $group_id, $user_id)
{
    $membership = group_membership($db, $group_id, $user_id);
    if (!$membership) {
        api_error(404, 'group_not_found', 'Gruppo non trovato.');
    }
    return $membership;
}

// Membro con uno dei ruoli indicati, altrimenti 403 (404 se non è proprio membro)
function require_group_role($db, $group_id, $user_id, array $roles)
{
    $membership = require_group_member($db, $group_id, $user_id);
    if (!in_array($membership['role'], $roles, true)) {
        api_error(403, 'forbidden', 'Non hai i permessi per questa azione.');
    }
    return $membership;
}

// Codice invito di 10 caratteri, senza caratteri ambigui (0/O, 1/I/L)
function generate_invite_code()
{
    $alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    $max = strlen($alphabet) - 1;
    $code = '';
    for ($i = 0; $i < 10; $i++) {
        $code .= $alphabet[random_int(0, $max)];
    }
    return $code;
}

// Normalizza un codice invito digitato a mano (spazi, minuscole), o null se non valido
function normalize_invite_code($code)
{
    if (!is_string($code)) return null;
    $code = strtoupper(preg_replace('/\s+/', '', $code));
    return preg_match('/^[A-HJKMNP-Z2-9]{10}$/', $code) ? $code : null;
}

// Età minima per i gruppi: 16 anni, finché non c'è un parere legale sui minori.
// Esce con 403 se l'utente è più giovane o non ha una data di nascita.
const GROUPS_MIN_AGE = 16;

function require_group_age($db, $user_id)
{
    $stmt = $db->prepare("SELECT birth_date FROM gym_users WHERE id = ? LIMIT 1");
    $stmt->execute([(int)$user_id]);
    $birth_date = $stmt->fetchColumn();
    $birth = $birth_date ? DateTime::createFromFormat('!Y-m-d', $birth_date) : false;
    if (!$birth) {
        api_error(403, 'birth_date_required', 'Per usare i gruppi inserisci la data di nascita nelle impostazioni.');
    }
    if ($birth->diff(new DateTime('today'))->y < GROUPS_MIN_AGE) {
        api_error(403, 'age_restricted', 'I gruppi sono disponibili dai ' . GROUPS_MIN_AGE . ' anni in su.');
    }
}

// Riferimento opaco a un membro, per rimuoverlo senza esporre il suo user_id.
// Vale solo dentro quel gruppo. La chiave è un segreto già presente nell'ambiente PHP.
function group_member_ref($group_id, $user_id)
{
    $secret = getenv('GYM_API_SECRET') ?: (getenv('DB_PASSWORD') ?: 'sviluppo-locale');
    return substr(hash_hmac('sha256', 'group-member:' . $group_id . ':' . $user_id, $secret), 0, 20);
}

// Limite di richieste: esce con 429 se superato, altrimenti conta il tentativo
function enforce_rate_limit($db, $rule, $key)
{
    $limiter = rate_limiter($db);
    list($max, $decay) = rate_limit_rule($rule);
    if ($limiter->tooManyAttempts($key, $max)) {
        $retry_after = $limiter->availableIn($key);
        header('Retry-After: ' . $retry_after);
        api_error(429, 'rate_limited', 'Troppi tentativi. Riprova tra ' . $retry_after . ' secondi.');
    }
    $limiter->hit($key, $decay);
}

function client_ip_key($prefix)
{
    $ip = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : 'unknown';
    return $prefix . ':ip:' . hash('sha256', $ip);
}
