<?php
// Pagina pubblica sul collegamento degli assistenti AI (server MCP): le due versioni, italiana
// e inglese, con hreflang e il link all'elenco delle app ammesse. Si lancia con tests/blog_mcp.sh.
// Esce con 1 se un controllo fallisce.

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

/** HTML di una pagina, in un processo PHP a parte (le pagine dichiarano funzioni). */
function render($page)
{
    $code = 'require ' . var_export(__DIR__ . '/../blog/' . $page, true) . ';';
    return (string) shell_exec(escapeshellarg(PHP_BINARY) . ' -r ' . escapeshellarg($code) . ' 2>&1');
}

$it = 'https://liftindex.app/blog/mcp/';
$en = 'https://liftindex.app/en/blog/mcp/';

/** Controlli comuni alle due lingue; $t sono i testi attesi nella lingua della pagina. */
function check_page($html, $lang, $canonical, array $t)
{
    global $it, $en;
    $app = 'https://liftindex.app/' . ($lang === 'en' ? 'en/' : '');
    check('nessun errore PHP', preg_match('/(Warning|Notice|Deprecated|Fatal error|Parse error):/', $html) === 0 && strpos($html, '</html>') !== false);
    check('lingua della pagina', strpos($html, '<html lang="' . $lang . '">') !== false);
    check('canonical', strpos($html, '<link rel="canonical" href="' . $canonical . '">') !== false);
    check('hreflang it, en e x-default', strpos($html, 'hreflang="it" href="' . $it . '"') !== false
        && strpos($html, 'hreflang="en" href="' . $en . '"') !== false
        && strpos($html, 'hreflang="x-default" href="' . $it . '"') !== false);
    check('indicizzabile', strpos($html, 'noindex') === false);
    check('indirizzo del connettore', strpos($html, '<code>https://liftindex.app/mcp</code>') !== false);
    check('link all\'elenco delle app ammesse', strpos($html, 'href="' . $app . 'assistenti-ai"') !== false);
    check('link alla privacy, sezione assistenti AI', strpos($html, 'href="https://liftindex.app/privacy.html#assistenti-ai"') !== false);
    check('registrazione nella lingua della pagina', strpos($html, 'href="' . $app . 'register"') !== false);
    check('JSON-LD nella lingua della pagina', strpos($html, '"inLanguage": "' . $lang . '"') !== false);
    check('link all\'altra lingua', strpos($html, 'href="' . ($lang === 'en' ? $it : $en) . '"') !== false
        && strpos($html, '>' . ($lang === 'en' ? 'Italiano' : 'English') . '</a>') !== false);
    foreach ($t as $desc => $text) {
        check($desc, strpos($html, $text) !== false);
    }
}

echo "Pagina italiana\n";
check_page(render('mcp/index.php'), 'it', $it, array(
    'sola lettura' => 'in sola lettura',
    'nessuna scrittura' => 'non può creare, modificare o cancellare nulla',
    'le proposte restano in chat' => 'Le proposte restano nella chat',
    'mai note, email e password' => 'Non legge mai le note, la tua email né la password.',
    'Premium' => '<strong>Premium</strong>',
    'almeno 18 anni' => 'almeno 18 anni',
    'pulsante del consenso' => '"Consenti"',
    'casella delle misure corporee' => '"Condividi anche le misure corporee (peso e simili)"',
    'revoca dalla scheda Account' => 'puoi revocarlo in qualunque momento dalla scheda Account',
));

echo "Pagina inglese\n";
check_page(render('en/mcp/index.php'), 'en', $en, array(
    'sola lettura' => 'read-only',
    'nessuna scrittura' => "it can't create, change or delete anything",
    'le proposte restano in chat' => 'Suggestions stay in the chat',
    'mai note, email e password' => 'It never reads your notes, your email or your password.',
    'Premium' => '<strong>Premium</strong>',
    'almeno 18 anni' => 'at least 18',
    'pulsante del consenso' => '"Allow"',
    'casella delle misure corporee' => '"Also share body measurements (weight and similar)"',
    'revoca dalla scheda Account' => 'you can revoke it anytime from the Account page',
));
$html = render('en/mcp/index.php');
check('EN: niente link italiani a login e registrazione', strpos($html, 'https://liftindex.app/register"') === false && strpos($html, 'https://liftindex.app/login"') === false);

echo "Sitemap\n";
$vite = file_get_contents(__DIR__ . '/../vite.config.js');
check('coppia it/en in vite.config.js', strpos($vite, "{ it: '/blog/mcp/', en: '/en/blog/mcp/' }") !== false);

echo "\n" . ($checks - $fails) . "/$checks controlli riusciti\n";
exit($fails > 0 ? 1 : 0);
