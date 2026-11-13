<?php
// Livello dell'account (free, plus, pro): l'unico modo per cambiarlo e' da qui (nessun endpoint lo concede).
//
//   php backend/tools/tier.php show <id|email|username>                           livello salvato, scadenza e livello in vigore
//   php backend/tools/tier.php set <id|email|username> <free|plus|pro> [AAAA-MM-GG]
//       la data e' l'ultimo giorno valido compreso (UTC); senza data non scade; con free niente data

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../lib/tier_rules.php';

$db = (new Database())->getConnection();
$cmd = $argv[1] ?? '';
$who = $argv[2] ?? '';

if (($cmd === 'show' && $who !== '' && count($argv) === 3)
    || ($cmd === 'set' && $who !== '' && count($argv) >= 4 && count($argv) <= 5)) {
    $stmt = $db->prepare('SELECT id, username, tier, tier_until FROM gym_users WHERE id = ? OR email = ? OR username = ?');
    $stmt->execute(array(ctype_digit($who) ? (int)$who : 0, $who, $who));
    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
    if (count($users) !== 1) {
        fwrite(STDERR, count($users) === 0 ? "Utente non trovato: $who\n" : "Piu' utenti corrispondono a '$who': usa l'id.\n");
        exit(1);
    }
    $u = $users[0];
    $now = gmdate('Y-m-d H:i:s');

    if ($cmd === 'set') {
        $r = tierSetUntil($argv[3], $argv[4] ?? null, $now);
        if (isset($r['error'])) {
            fwrite(STDERR, $r['error'] . "\n");
            exit(1);
        }
        $db->prepare('UPDATE gym_users SET tier = ?, tier_until = ? WHERE id = ?')->execute(array($argv[3], $r['until'], $u['id']));
        $u['tier'] = $argv[3];
        $u['tier_until'] = $r['until'];
    }

    echo "Utente {$u['id']} ({$u['username']}): livello salvato {$u['tier']}, scadenza "
        . ($u['tier_until'] === null ? 'nessuna' : $u['tier_until'] . ' UTC')
        . ', livello in vigore ' . tierEffective($u['tier'], $u['tier_until'], $now) . ".\n";
    exit(0);
}

fwrite(STDERR, "Uso: php tier.php show <id|email|username> | set <id|email|username> <free|plus|pro> [AAAA-MM-GG]\n");
exit(2);
