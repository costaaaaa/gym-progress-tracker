<?php
// Avvisi all'admin (backend/lib/admin_notify.php): a chi vanno, cosa dicono, cosa non dicono.
// Si lancia con tests/admin_notify.sh. Esce con 1 se un controllo fallisce.

require __DIR__ . '/../backend/lib/admin_notify.php';

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

// Email inviate durante $fn, lette dal log di MAIL_DRIVER=log
function sent_mail(callable $fn)
{
    $log = tempnam(sys_get_temp_dir(), 'mail');
    ini_set('error_log', $log);
    $fn();
    ini_set('error_log', '');
    $out = file_get_contents($log);
    unlink($log);
    return $out;
}

putenv('MAIL_DRIVER=log');
putenv('APP_PUBLIC_URL=https://liftindex.example');

$report = array(
    'id' => 12, 'group_id' => 5, 'target' => 'member', 'target_label' => 'MarioRossi',
    'reason' => 'Motivo riservato: insulta Luigi Bianchi',
);

echo "Con ADMIN_NOTIFY_EMAIL\n";
putenv('ADMIN_NOTIFY_EMAIL=admin@example.com');
$mail = sent_mail(function () use ($report) { admin_notify_report($report); });
check("la segnalazione va all'admin", strpos($mail, 'a=admin@example.com') !== false);
check("l'oggetto dice il numero della segnalazione", preg_match('/oggetto="[^"]*#12[^"]*"/', $mail) === 1);
check("c'è il link alla pagina admin", strpos($mail, 'https://liftindex.example/admin') !== false);
check("il motivo non è nell'email", strpos($mail, 'Luigi Bianchi') === false && strpos($mail, 'riservato') === false);
check("neanche il nome segnalato", strpos($mail, 'MarioRossi') === false);

$mail = sent_mail(function () { admin_notify_exercise('Curl al cavo basso'); });
check("anche il nuovo esercizio va all'admin", strpos($mail, 'a=admin@example.com') !== false);
check("con il nome dell'esercizio", strpos($mail, 'Curl al cavo basso') !== false);
check("e il link alla pagina admin", strpos($mail, 'https://liftindex.example/admin') !== false);

echo "Senza ADMIN_NOTIFY_EMAIL\n";
putenv('ADMIN_NOTIFY_EMAIL=');
$mail = sent_mail(function () use ($report) { admin_notify_report($report); admin_notify_exercise('Panca'); });
check("non parte nessuna email", strpos($mail, '[mail:log]') === false);

echo "\n";
if ($fails === 0) {
    echo "TUTTO OK ($checks controlli)\n";
    exit(0);
}
echo "FALLITI $fails su $checks\n";
exit(1);
