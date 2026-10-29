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
function find_authenticated_user_id($db)
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

function resolve_authenticated_user_id($db)
{
    $user_id = find_authenticated_user_id($db);
    request_user_context($db, $user_id);
    if ($user_id) {
        // Qui e non in request_time_zone(): vale per ogni richiesta autenticata, anche per gli endpoint
        // che il fuso non lo usano, così il «fuso salvato» è sempre l'ultimo visto dall'app
        remember_request_time_zone($db, $user_id);
    }
    return $user_id;
}

// Utente autenticato (sessione web o token Bearer), altrimenti 401. Ritorna lo user_id.
// La connessione va aperta prima: la validazione di sessione e token legge dal database.
function require_authenticated_user($db)
{
    $user_id = resolve_authenticated_user_id($db);
    if (!$user_id) {
        api_error(401, 'unauthenticated', t_server('auth.unauthenticated'));
    }
    return $user_id;
}

// ── Lingua ──────────────────────────────────────────────────────────────────

const SUPPORTED_LOCALES = array('it', 'en');

// 'it' o 'en' (anche da "en-US" o "EN"), null se non supportata
function normalize_locale($value)
{
    if (!is_string($value)) return null;
    $code = strtolower(substr(trim($value), 0, 2));
    return in_array($code, SUPPORTED_LOCALES, true) ? $code : null;
}

// Utente della richiesta, ricordato da resolve_authenticated_user_id() per leggerne la lingua
// quando serve (nomi degli esercizi) senza passare $db e l'id attraverso tutti i modelli.
function request_user_context($db = null, $user_id = null)
{
    static $context = array('db' => null, 'user_id' => null);
    if (func_num_args() > 0) {
        $context = array('db' => $db, 'user_id' => $user_id ? (int)$user_id : null);
    }
    return $context;
}

// Lingua della richiesta: quella dell'account (gym_users.locale) se c'è un utente, altrimenti
// l'header X-Locale che il client web manda sulle pagine pubbliche (login, registrazione,
// reset), altrimenti 'it'. X-Locale e non Accept-Language: le app mobile mandano il secondo da
// sole e le build vecchie diventerebbero inglesi. $refresh rilegge l'account dopo che la
// richiesta stessa ha cambiato lingua (update_settings).
function request_locale($refresh = false)
{
    static $cache = array();
    $context = request_user_context();
    $key = $context['user_id'] ?? 0;
    if ($refresh || !isset($cache[$key])) {
        $locale = null;
        if ($context['user_id'] !== null) {
            try {
                $stmt = $context['db']->prepare("SELECT locale FROM gym_users WHERE id = ? LIMIT 1");
                $stmt->execute(array($context['user_id']));
                $locale = normalize_locale($stmt->fetchColumn());
            } catch (PDOException $e) {
                // colonna non ancora migrata: si passa all'header
            }
        }
        $cache[$key] = $locale ?? normalize_locale($_SERVER['HTTP_X_LOCALE'] ?? null) ?? 'it';
    }
    return $cache[$key];
}

// ── Fuso orario ─────────────────────────────────────────────────────────────

const DEFAULT_TIME_ZONE = 'Europe/Rome';

// Nome IANA valido ("America/New_York") oppure null. Solo i nomi di timezone_identifiers_list():
// offset e abbreviazioni ("+02:00", "EST") non seguono l'ora legale, quindi non servono.
function valid_time_zone($value)
{
    static $names = null;
    if (!is_string($value)) return null;
    if ($names === null) $names = array_flip(timezone_identifiers_list());
    $value = trim($value);
    return isset($names[$value]) ? $value : null;
}

// Fuso del dispositivo per questa richiesta: header X-Timezone se valido, altrimenti l'ultimo fuso
// visto sull'account (gym_users.time_zone, salvato da remember_request_time_zone()), altrimenti
// Europe/Rome: i client che non lo mandano si comportano come prima. $refresh svuota la cache (test).
function request_time_zone($refresh = false)
{
    static $cache = array();
    $context = request_user_context();
    $key = $context['user_id'] ?? 0;
    if ($refresh || !isset($cache[$key])) {
        $header = valid_time_zone($_SERVER['HTTP_X_TIMEZONE'] ?? null);
        $saved = null;
        if ($header === null && $context['user_id'] !== null) {
            try {
                $stmt = $context['db']->prepare("SELECT time_zone FROM gym_users WHERE id = ? LIMIT 1");
                $stmt->execute(array($context['user_id']));
                $saved = valid_time_zone($stmt->fetchColumn());
            } catch (PDOException $e) {
                // colonna non ancora migrata (42S22): si passa a Europe/Rome; ogni altro errore si registra
                if (!is_missing_column_error($e)) api_log_exception('request_time_zone', $e);
            }
        }
        $cache[$key] = $header ?? $saved ?? DEFAULT_TIME_ZONE;
    }
    return $cache[$key];
}

// Salva sull'account il fuso dell'header X-Timezone, se valido e diverso da quello salvato: un solo
// UPDATE condizionato. Header assente o non valido non toccano nulla.
function remember_request_time_zone($db, $user_id)
{
    $header = valid_time_zone($_SERVER['HTTP_X_TIMEZONE'] ?? null);
    if ($header === null) return;
    try {
        $db->prepare("UPDATE gym_users SET time_zone = ? WHERE id = ? AND (time_zone IS NULL OR time_zone <> ?)")
            ->execute(array($header, $user_id, $header));
    } catch (PDOException $e) {
        // colonna non ancora migrata (42S22): vale l'header di ogni richiesta; ogni altro errore si
        // registra, ma la richiesta prosegue
        if (!is_missing_column_error($e)) api_log_exception('remember_request_time_zone', $e);
    }
}

// Colonna inesistente (SQLSTATE 42S22). La tolleranza vale solo per request_time_zone() e
// remember_request_time_zone(), che possono girare prima della migrazione 29; il resto del codice
// nuovo la richiede, e deploy.sh la applica prima di avviare il codice.
function is_missing_column_error(PDOException $e)
{
    return ($e->errorInfo[0] ?? $e->getCode()) === '42S22';
}

// "Adesso" per l'utente: stesso istante di new DateTime(), ma nel fuso del suo dispositivo. Da usare
// dove giorno, settimana o limite significano quelli dell'utente.
function user_now()
{
    return new DateTime('now', new DateTimeZone(request_time_zone()));
}

// Il giorno di oggi dell'utente come mezzanotte nel fuso del server: confrontabile con le date
// "Y-m-d" create nel fuso del server (nascita, inizio allenamento) senza scarti di fuso.
function user_today()
{
    return new DateTime(user_now()->format('Y-m-d'));
}

// Istante di un allenamento: la sua data è ora locale del luogo ($time_zone, nome IANA). Se il nome
// manca o non è valido vale Europe/Rome. Un'ora che non esiste (salto in avanti) si sposta avanti;
// una doppia (ritorno all'ora solare) vale una delle due occorrenze, scelta da PHP: ambiguità accettata.
function workout_instant($date, $time_zone)
{
    return new DateTimeImmutable($date, new DateTimeZone(valid_time_zone($time_zone) ?? DEFAULT_TIME_ZONE));
}

// Un orario che il database tiene nel fuso del server (name_locked_until, ...) come DateTime nel fuso
// della richiesta, per scriverlo in un messaggio all'utente.
function server_time_in_request_zone($value)
{
    return (new DateTime($value))->setTimezone(new DateTimeZone(request_time_zone()));
}

// Un istante come lo tiene il database: data e ora nel fuso del server ("Y-m-d H:i:s"), per confrontarlo
// con colonne come last_xp_session_at.
function server_time_from_instant(DateTimeInterface $instant)
{
    return DateTimeImmutable::createFromInterface($instant)
        ->setTimezone(new DateTimeZone(date_default_timezone_get()))
        ->format('Y-m-d H:i:s');
}

// Come workout_instant(), in ISO 8601 con l'offset del luogo ("2026-10-25T21:00:00-04:00").
function workout_started_at($date, $time_zone)
{
    return workout_instant($date, $time_zone)->format('c');
}

// Orario che il database tiene nel fuso del server (created_at, name_locked_until, ...) in ISO 8601
// con offset, così il client lo legge senza supporre il fuso. null se manca.
function server_time_iso($value)
{
    if ($value === null || $value === '' || strpos((string)$value, '0000-00-00') === 0) return null;
    return (new DateTime($value))->format('c');
}

// Messaggio del server nella lingua della richiesta (o in $locale), da backend/lang/<lingua>.php.
// I {segnaposto} si sostituiscono con $vars; una chiave mancante ricade sull'italiano.
function t_server($key, $vars = array(), $locale = null)
{
    static $strings = array();
    $locale = normalize_locale($locale) ?? request_locale();
    foreach (array_unique(array($locale, 'it')) as $lang) {
        if (!isset($strings[$lang])) {
            $strings[$lang] = require __DIR__ . '/../lang/' . $lang . '.php';
        }
        if (isset($strings[$lang][$key])) {
            $text = $strings[$lang][$key];
            foreach ($vars as $name => $value) {
                $text = str_replace('{' . $name . '}', (string)$value, $text);
            }
            return $text;
        }
    }
    error_log("t_server: chiave mancante $key");
    return $key;
}

// Nome da mostrare: quello inglese se l'utente ha scelto l'inglese e c'è, altrimenti l'italiano
function exercise_display_name($name, $name_en)
{
    return request_locale() === 'en' && $name_en !== null && $name_en !== '' ? $name_en : $name;
}

// Espressione SQL del nome da mostrare per la tabella gym_exercises con alias $alias
function exercise_name_sql($alias = 'e')
{
    return request_locale() === 'en' ? "COALESCE(NULLIF($alias.name_en, ''), $alias.name)" : "$alias.name";
}

// Esercizio nel formato dell'API: name è nella lingua dell'utente, name_it e name_en sono i due
// nomi del catalogo (per cercare in entrambe le lingue)
function exercise_public($row, $user_id)
{
    return array(
        'id' => (int)$row['id'],
        'name' => exercise_display_name($row['name'], $row['name_en']),
        'name_it' => $row['name'],
        'name_en' => $row['name_en'],
        'muscle_group' => $row['muscle_group'],
        'equipment' => $row['equipment'],
        'status' => $row['status'],
        'is_mine' => $user_id !== null && (int)$row['created_by'] === (int)$user_id,
    );
}

function api_json_response($payload, $status_code = 200)
{
    http_response_code($status_code);
    echo json_encode($payload);
    exit;
}

// Esegue $fn dopo aver mandato la risposta (PHP-FPM), per le email: non devono rallentarla
// né farla fallire.
function after_response(callable $fn)
{
    register_shutdown_function(function () use ($fn) {
        if (function_exists('fastcgi_finish_request')) {
            fastcgi_finish_request();
        }
        try {
            $fn();
        } catch (Throwable $e) {
            api_log_exception('after_response', $e);
        }
    });
}

function api_not_found($message = null)
{
    api_json_response([
        'success' => false,
        'message' => $message ?? t_server('common.not_found')
    ], 404);
}

function api_server_error($message = null)
{
    api_json_response([
        'success' => false,
        'message' => $message ?? t_server('common.server_error')
    ], 500);
}

function api_log_exception($context, $exception)
{
    error_log($context . ': ' . $exception->getMessage());
}

// Orario mandato dal client (di solito UTC, "...Z"): stesso istante, ma nel fuso $time_zone (nome IANA)
// o, senza, in quello del server, che è quello con cui il database memorizza le date. Senza fuso nella
// stringa vale già il fuso scelto.
function client_datetime($value, $time_zone = null)
{
    $zone = new DateTimeZone($time_zone ?? date_default_timezone_get());
    return (new DateTimeImmutable($value, $zone))->setTimezone($zone);
}

// Il nuovo istante di un allenamento spostato su $new_date, nel fuso $time_zone dell'allenamento.
// $new_date è un giorno ("Y-m-d"): l'orario originale ($time_of_day, "H:i:s") resta, tranne se in quel
// giorno non è ancora arrivato ($now): allora vale l'ora attuale del luogo. Altrimenti $new_date è già
// data e ora e vale così com'è. Un'ora che non esiste (salto in avanti) si sposta avanti, una doppia
// vale la prima occorrenza (ora legale): sono le scelte di PHP. Exception se $new_date non è una data.
function moved_workout_instant($new_date, $time_of_day, $time_zone, DateTimeInterface $now)
{
    $zone = new DateTimeZone(valid_time_zone($time_zone) ?? DEFAULT_TIME_ZONE);
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $new_date)) {
        $original = new DateTimeImmutable($new_date . ' ' . $time_of_day, $zone);
        if ($original <= $now) return $original;
        $new_date .= ' ' . DateTimeImmutable::createFromInterface($now)->setTimezone($zone)->format('H:i:s');
    }
    return client_datetime($new_date, $zone->getName());
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
    if (!$birth || $birth->format('Y-m-d') !== $birth_date || $birth > user_today()) {
        return t_server('birth.invalid');
    }
    if ($birth->diff(user_today())->y < 14) {
        return t_server('birth.too_young');
    }
    return null;
}

// Valida la data di inizio allenamento ('Y-m-d', non futura). Vuota/null e' ammessa (campo opzionale).
// Ritorna null se valida o assente, altrimenti il messaggio d'errore.
function training_start_date_error($value)
{
    if ($value === null || $value === '') {
        return null;
    }
    $d = is_string($value) ? DateTime::createFromFormat('!Y-m-d', $value) : false;
    if (!$d || $d->format('Y-m-d') !== $value || $d > user_today()) {
        return t_server('training_start.invalid');
    }
    return null;
}

// Limiti dei testi liberi, per campo (colonne: notes text, intensity_technique varchar(100))
const FREE_TEXT_MAX_LENGTH = array('notes' => 5000, 'intensity_technique' => 100);

// True se il testo facoltativo $field di $obj manca o è una stringa nel suo limite.
function free_text_ok($obj, $field)
{
    $value = $obj->$field ?? null;
    return !isset($value) || (is_string($value) && mb_strlen($value) <= FREE_TEXT_MAX_LENGTH[$field]);
}

// Valida serie, ripetizioni e recupero di un esercizio in scheda (limiti delle colonne
// gym_workout_exercises: reps varchar(20)). Il recupero 0 e' ammesso.
// Ritorna null se validi, altrimenti il messaggio d'errore.
function exercise_params_error($data)
{
    $int_in_range = function ($v, $min, $max) {
        if (is_string($v) && preg_match('/^\d+$/', $v)) {
            $v = (int)$v;
        }
        return is_int($v) && $v >= $min && $v <= $max;
    };
    $reps = isset($data->reps) ? $data->reps : null;
    $reps_ok = (is_string($reps) || is_int($reps)) && trim((string)$reps) !== '' && mb_strlen((string)$reps) <= 20;
    // Note e tecnica sono facoltative: se ci sono, stringhe nei limiti delle colonne
    $text_ok = free_text_ok($data, 'notes') && free_text_ok($data, 'intensity_technique');
    if (
        !isset($data->sets) || !$int_in_range($data->sets, 1, 20) ||
        !isset($data->rest) || !$int_in_range($data->rest, 0, 3600) ||
        !$reps_ok || !$text_ok
    ) {
        return t_server('exercise.params_invalid');
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
        api_error(404, 'group_not_found', t_server('groups.not_found'));
    }
    return $membership;
}

// Membro con uno dei ruoli indicati, altrimenti 403 (404 se non è proprio membro)
function require_group_role($db, $group_id, $user_id, array $roles)
{
    $membership = require_group_member($db, $group_id, $user_id);
    if (!in_array($membership['role'], $roles, true)) {
        api_error(403, 'forbidden', t_server('common.forbidden'));
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
        api_error(403, 'birth_date_required', t_server('groups.birth_required'));
    }
    if ($birth->diff(user_today())->y < GROUPS_MIN_AGE) {
        api_error(403, 'age_restricted', t_server('groups.min_age', array('age' => GROUPS_MIN_AGE)));
    }
}

// Riferimento opaco a un membro, per rimuoverlo senza esporre il suo user_id.
// Vale solo dentro quel gruppo. La chiave è GYM_API_SECRET: senza, meglio un errore che una
// chiave indovinabile.
function group_member_ref($group_id, $user_id)
{
    $secret = getenv('GYM_API_SECRET');
    if (!$secret) {
        error_log('group_member_ref: GYM_API_SECRET non impostata');
        api_error(500, 'server_misconfigured', t_server('common.misconfigured'));
    }
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
        api_error(429, 'rate_limited', t_server('common.rate_limited', array('seconds' => $retry_after)));
    }
    $limiter->hit($key, $decay);
}

// Indirizzo del client per i limiti per IP. Un IPv6 vale per la sua rete /64: chi ne ha una
// può cambiare indirizzo a ogni richiesta e aggirerebbe qualunque limite per indirizzo intero.
function client_ip()
{
    $ip = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : 'unknown';
    $packed = @inet_pton($ip);
    if ($packed === false || strlen($packed) !== 16) {
        return $ip;
    }
    if (strncmp($packed, str_repeat("\0", 10) . "\xff\xff", 12) === 0) {
        return inet_ntop(substr($packed, 12)); // IPv4 scritto come ::ffff:a.b.c.d
    }
    return bin2hex(substr($packed, 0, 8)) . '::/64';
}

// $ip: indirizzo già ottenuto con client_ip(), per chi lo usa anche per altre chiavi.
function client_ip_key($prefix, $ip = null)
{
    return $prefix . ':ip:' . hash('sha256', $ip ?? client_ip());
}

// ── Admin ───────────────────────────────────────────────────────────────────

// True se l'utente è admin. Lo si diventa solo da riga di comando (backend/tools/admin.php).
function user_is_admin($db, $user_id)
{
    $stmt = $db->prepare("SELECT is_admin FROM gym_users WHERE id = ? LIMIT 1");
    $stmt->execute([(int)$user_id]);
    return (int)$stmt->fetchColumn() === 1;
}

// ── Funzioni premium ────────────────────────────────────────────────────────

// Funzioni premium abilitate per l'utente: è l'unico punto che lega il piano alle funzioni. I client
// le usano solo per mostrare i comandi; dove conta (salvataggio, dati) le controlla il server.
// Oggi l'unico livello premium è gym_users.ai_tier, creato dall'SQL dell'AI Coach: nelle installazioni
// che non ce l'hanno la query fallisce e l'utente non ha funzioni premium.
// Quando ci saranno i piani a pagamento cambia solo questa funzione.
function user_features($db, $user_id)
{
    try {
        $stmt = $db->prepare("SELECT ai_tier FROM gym_users WHERE id = ? LIMIT 1");
        $stmt->execute([(int)$user_id]);
        $tier = $stmt->fetchColumn();
    } catch (PDOException $e) {
        return [];
    }
    if ($tier === 'premium') {
        // focus_session_edit: cambiare o aggiungere esercizi durante il Focus Mode
        return ['focus_session_edit'];
    }
    return [];
}

function user_has_feature($db, $user_id, $feature)
{
    return in_array($feature, user_features($db, $user_id), true);
}

// Utente autenticato e admin, altrimenti 404: chi non è admin non deve sapere che l'area esiste.
// Ritorna lo user_id.
function require_admin($db)
{
    $user_id = resolve_authenticated_user_id($db);
    if (!$user_id || !user_is_admin($db, $user_id)) {
        api_not_found();
    }
    return (int)$user_id;
}
