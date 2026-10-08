<?php
// POST {email}: se l'indirizzo è registrato, invia un link di reset valido 1 ora.
// La risposta è SEMPRE la stessa (successo generico) per non rivelare chi è registrato.
include_once '../../config/cors_headers.php';
include_once '../../config/database.php';
include_once '../../config/api_helpers.php';
include_once '../../config/rate_limiter.php';
include_once '../../models/ApiToken.php';
include_once '../../models/PasswordReset.php';
include_once '../../lib/mailer.php';

$generic = array(
    "success" => true,
    "message" => t_server('forgot.sent')
);

try {
    $data = json_decode(file_get_contents("php://input"));
    $email = (is_object($data) && isset($data->email) && is_string($data->email)) ? strtolower(trim($data->email)) : '';

    if ($email === '' || strlen($email) > 100 || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);
        echo json_encode(array("success" => false, "message" => t_server('common.email_invalid')));
        exit;
    }

    $database = new Database();
    $db = $database->getConnection();
    $limiter = rate_limiter($db);

    $ip = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : 'unknown';
    $ipKey = 'forgot:ip:' . hash('sha256', $ip);
    $emailKey = 'forgot:email:' . hash('sha256', strtolower($email));
    list($ipMax, $ipDecay) = rate_limit_rule('forgot_ip');
    list($emailMax, $emailDecay) = rate_limit_rule('forgot_email');

    // Oltre soglia si risponde comunque col messaggio generico: 429 rivelerebbe che l'indirizzo esiste.
    if ($limiter->tooManyAttempts($ipKey, $ipMax)) {
        http_response_code(429);
        echo json_encode(array("success" => false, "message" => t_server('forgot.too_many')));
        exit;
    }
    // Ogni richiesta conta, esista o no l'account.
    $limiter->hit($ipKey, $ipDecay);
    $blockedByEmail = $limiter->tooManyAttempts($emailKey, $emailMax);
    $limiter->hit($emailKey, $emailDecay);

    if (!$blockedByEmail) {
        $reset = new PasswordReset($db);
        $user = $reset->findUserByEmail($email);
        if ($user) {
            $token = $reset->create($user['id']);
            // APP_PUBLIC_URL: indirizzo pubblico dell'app, es. https://liftindex.app
            // (env sul server, come MAIL_*). L'app sta alla radice del dominio; la pagina
            // inglese sta sotto /en. Email e link sono nella lingua dell'account.
            $lang = normalize_locale($user['locale'] ?? null) ?? 'it';
            $baseUrl = rtrim(getenv('APP_PUBLIC_URL') ?: 'http://localhost:3000', '/');
            $link = $baseUrl . ($lang === 'en' ? '/en' : '') . '/reset-password?token=' . $token;
            $text = t_server('forgot.email_body', array('username' => $user['username'], 'link' => $link), $lang);
            mail_send($email, t_server('forgot.email_subject', array(), $lang), $text);
        }
    }

    http_response_code(200);
    echo json_encode($generic);
} catch (Exception $e) {
    error_log("Forgot password error: " . $e->getMessage());
    // Anche in errore non si distingue il caso "account inesistente".
    http_response_code(200);
    echo json_encode($generic);
}
