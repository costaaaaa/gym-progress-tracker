<?php
// Admin della pagina /admin del sito: l'unico modo per diventarlo e' da qui (nessun endpoint lo concede).
//
//   php backend/tools/admin.php list                              elenca gli admin
//   php backend/tools/admin.php grant <id|email|username>         rende admin
//   php backend/tools/admin.php revoke <id|email|username>        toglie admin

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once __DIR__ . '/../config/database.php';

$db = (new Database())->getConnection();
$cmd = $argv[1] ?? '';

if ($cmd === 'list') {
    $rows = $db->query("SELECT id, username, email FROM gym_users WHERE is_admin = 1 ORDER BY id")->fetchAll(PDO::FETCH_ASSOC);
    foreach ($rows as $r) {
        echo "{$r['id']}  {$r['username']}  {$r['email']}\n";
    }
    echo $rows ? '' : "(nessun admin)\n";
    exit(0);
}

if (in_array($cmd, array('grant', 'revoke'), true) && ($argv[2] ?? '') !== '') {
    $who = $argv[2];
    $stmt = $db->prepare('SELECT id, username, is_admin FROM gym_users WHERE id = ? OR email = ? OR username = ?');
    $stmt->execute(array(ctype_digit($who) ? (int)$who : 0, $who, $who));
    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
    if (count($users) !== 1) {
        fwrite(STDERR, count($users) === 0 ? "Utente non trovato: $who\n" : "Piu' utenti corrispondono a '$who': usa l'id.\n");
        exit(1);
    }
    $u = $users[0];
    $value = $cmd === 'grant' ? 1 : 0;
    $db->prepare('UPDATE gym_users SET is_admin = ? WHERE id = ?')->execute(array($value, $u['id']));
    echo "Utente {$u['id']} ({$u['username']}): admin " . ((int)$u['is_admin'] ? 'si' : 'no') . ' → ' . ($value ? 'si' : 'no') . ".\n";
    exit(0);
}

fwrite(STDERR, "Uso: php admin.php list | grant <id|email|username> | revoke <id|email|username>\n");
exit(2);
