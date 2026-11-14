<?php
// Piè di pagina delle email agli utenti (backend/lib/mailer.php, mail_footer): contatto e link
// all'informativa privacy. Le email all'admin non lo hanno. Si lancia con tests/mail_footer.sh.
// Esce con 1 se un controllo fallisce.

require __DIR__ . '/../backend/config/api_helpers.php';
require __DIR__ . '/../backend/lib/report_mail.php';
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

// Database finto: una sola riga utente, come SELECT email, username, locale di report_mail_to_user
class FakeStmt
{
    public $row;
    public function execute($p) { return true; }
    public function fetch($mode = null) { return $this->row; }
}
class FakeDb
{
    public $row;
    public function prepare($sql) { $s = new FakeStmt(); $s->row = $this->row; return $s; }
}

putenv('MAIL_DRIVER=log');
putenv('APP_PUBLIC_URL=https://liftindex.example/');

echo "Piè di pagina\n";
$it = mail_footer('it');
check('italiano: il testo concordato', $it === "\n--\nRicevi questa email perché hai un account su LiftIndex.\n"
    . "Informativa privacy: https://liftindex.example/privacy.html\nContatti: info@liftindex.app\n");
$en = mail_footer('en');
check('inglese: stesso link e contatto', strpos($en, 'https://liftindex.example/privacy.html') !== false
    && strpos($en, 'info@liftindex.app') !== false && strpos($en, 'Ricevi') === false);

echo "Email delle segnalazioni all'utente\n";
foreach (array('it', 'en') as $lang) {
    $db = new FakeDb();
    $db->row = array('email' => 'u@example.com', 'username' => 'Mario', 'locale' => $lang);
    $mail = sent_mail(function () use ($db) { report_mail_received($db, array('id' => 7, 'reporter_user_id' => 1, 'target_label' => 'X')); });
    check("$lang: l'email finisce con il piè di pagina", substr($mail, -strlen(mail_footer($lang))) === mail_footer($lang) || strpos($mail, mail_footer($lang)) !== false);
    check("$lang: una sola riga vuota fra firma e piè di pagina", strpos($mail, "LiftIndex\n\n--\n") !== false && strpos($mail, "\n\n\n") === false);
}

echo "Email all'admin\n";
putenv('ADMIN_NOTIFY_EMAIL=admin@example.com');
$mail = sent_mail(function () { admin_notify_exercise('Panca'); });
check("senza piè di pagina", strpos($mail, 'a=admin@example.com') !== false && strpos($mail, 'privacy') === false);

echo "\n";
if ($fails === 0) {
    echo "TUTTO OK ($checks controlli)\n";
    exit(0);
}
echo "FALLITI $fails su $checks\n";
exit(1);
