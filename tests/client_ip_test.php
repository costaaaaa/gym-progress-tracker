<?php
// Chiave dei limiti per IP (backend/config/api_helpers.php): un IPv6 vale per la sua rete /64.
// Si lancia con tests/client_ip.sh. Esce con 1 se un controllo fallisce.

require __DIR__ . '/../backend/config/api_helpers.php';

$fails = 0;
$checks = 0;
function check($desc, $cond)
{
    global $fails, $checks;
    $checks++;
    if ($cond) {
        echo "  \033[32m✓\033[0m $desc\n";
    } else {
        $fails++;
        echo "  \033[31m✗\033[0m $desc\n";
    }
}

function key_for($ip)
{
    $_SERVER['REMOTE_ADDR'] = $ip;
    return client_ip_key('prova');
}

check('IPv4: chiave come prima (hash dell\'indirizzo)', key_for('203.0.113.7') === 'prova:ip:' . hash('sha256', '203.0.113.7'));
check('IPv4: indirizzi diversi, chiavi diverse', key_for('203.0.113.7') !== key_for('203.0.113.8'));
check('IPv6: stesso /64, stessa chiave', key_for('2001:db8:1:2:aaaa:bbbb:cccc:dddd') === key_for('2001:db8:1:2::1'));
check('IPv6: /64 diversi, chiavi diverse', key_for('2001:db8:1:2::1') !== key_for('2001:db8:1:3::1'));
check('IPv4 scritto come ::ffff:a.b.c.d: stessa chiave dell\'IPv4', key_for('::ffff:203.0.113.7') === key_for('203.0.113.7'));
check('indirizzo illeggibile: non lancia, chiave stabile', key_for('non-un-ip') === key_for('non-un-ip'));
$_SERVER['REMOTE_ADDR'] = '2001:db8:1:2::1';
check('client_ip_key con $ip già calcolato: stessa chiave', client_ip_key('prova', client_ip()) === client_ip_key('prova'));
unset($_SERVER['REMOTE_ADDR']);
check('senza REMOTE_ADDR: non lancia', client_ip_key('prova') === 'prova:ip:' . hash('sha256', 'unknown'));

echo "\n" . ($checks - $fails) . "/$checks controlli riusciti\n";
exit($fails > 0 ? 1 : 0);
