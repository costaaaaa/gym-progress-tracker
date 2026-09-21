<?php
// Avvolge in bcrypt i vecchi hash SHA-256 senza salt (password salvate dal client prima del
// passaggio a bcrypt): password = bcrypt(sha256_hex), password_legacy = 1.
// L'utente non deve fare nulla: al primo login User::login() verifica bcrypt(sha256(password)),
// poi salva un bcrypt normale e azzera il flag.
//
// Da lanciare UNA VOLTA dal server, dopo la migrazione 10 e prima di mettere online il codice
// che non accetta piu' SHA-256 in chiaro. E' rieseguibile: salta le righe gia' avvolte.
//
//   php backend/tools/wrap_legacy_hashes.php --dry-run   conta soltanto
//   php backend/tools/wrap_legacy_hashes.php             esegue

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once __DIR__ . '/../config/database.php';

$dryRun = in_array('--dry-run', $argv, true);
$db = (new Database())->getConnection();

$total = (int)$db->query("SELECT COUNT(*) FROM gym_users")->fetchColumn();
$bcrypt = (int)$db->query("SELECT COUNT(*) FROM gym_users WHERE password LIKE '$2y$%'")->fetchColumn();
$rows = $db->query("SELECT id, password FROM gym_users WHERE password_legacy = 0 AND password NOT LIKE '$2y$%'")
    ->fetchAll(PDO::FETCH_ASSOC);

$wrapped = 0;
$unknown = 0;
$update = $db->prepare("UPDATE gym_users SET password = ?, password_legacy = 1 WHERE id = ? AND password_legacy = 0");
foreach ($rows as $row) {
    if (!preg_match('/^[0-9a-f]{64}$/', $row['password'])) {
        $unknown++;
        fwrite(STDERR, "Utente {$row['id']}: hash in formato sconosciuto, non toccato\n");
        continue;
    }
    if (!$dryRun) {
        $update->execute([password_hash($row['password'], PASSWORD_BCRYPT), $row['id']]);
    }
    $wrapped++;
}

echo ($dryRun ? "[dry-run] " : "") . "utenti: $total, gia' bcrypt: $bcrypt, "
    . ($dryRun ? "da avvolgere" : "avvolti") . ": $wrapped, formato sconosciuto: $unknown\n";
exit($unknown > 0 ? 1 : 0);
