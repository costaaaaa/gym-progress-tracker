<?php
// Server di prova per tests/web_session_test.php (si lancia con `php -S`): ogni percorso include il
// vero backend/config/cors_headers.php e usa le funzioni di backend/lib/web_session.php, senza database.
//   /whoami                  utente della sessione (se c'è)
//   /login?remember=1|0      apre la sessione di un utente di prova
//   /regenerate              nuovo id di sessione (come il cambio password)
//   /logout                  chiude la sessione
//   /origin                  esito del controllo sull'origine (come login.php)

require __DIR__ . '/../backend/config/cors_headers.php';

$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

switch ($path) {
    case '/login':
        reject_foreign_origin();
        web_session_login(7, 'prova', ($_GET['remember'] ?? '0') === '1');
        break;
    case '/regenerate':
        web_session_regenerate();
        break;
    case '/logout':
        web_session_end();
        break;
}

echo json_encode(array(
    'user_id' => $_SESSION['user_id'] ?? null,
    'session_active' => session_status() === PHP_SESSION_ACTIVE,
));
