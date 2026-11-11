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

echo "Pagina italiana\n";
$html = render('mcp/index.php');
check('nessun errore PHP', preg_match('/(Warning|Notice|Deprecated|Fatal error|Parse error):/', $html) === 0 && strpos($html, '</html>') !== false);
check('lingua italiana', strpos($html, '<html lang="it">') !== false);
check('canonical', strpos($html, '<link rel="canonical" href="' . $it . '">') !== false);
check('hreflang it, en e x-default', strpos($html, 'hreflang="it" href="' . $it . '"') !== false
    && strpos($html, 'hreflang="en" href="' . $en . '"') !== false
    && strpos($html, 'hreflang="x-default" href="' . $it . '"') !== false);
check('indicizzabile', strpos($html, 'noindex') === false);
check('indirizzo del connettore', strpos($html, 'https://liftindex.app/mcp<') !== false);
check('link all\'elenco delle app ammesse', strpos($html, 'href="https://liftindex.app/assistenti-ai"') !== false);
check('link alla privacy, sezione assistenti AI', strpos($html, 'href="https://liftindex.app/privacy.html#assistenti-ai"') !== false);
check('dice che è in sola lettura', strpos($html, 'sola lettura') !== false);
check('dice che è premium', strpos($html, 'Premium') !== false);
check('JSON-LD in italiano', strpos($html, '"inLanguage": "it"') !== false);
check('link alla versione inglese', strpos($html, 'href="' . $en . '"') !== false && strpos($html, '>English</a>') !== false);

echo "Pagina inglese\n";
$html = render('en/mcp/index.php');
check('nessun errore PHP', preg_match('/(Warning|Notice|Deprecated|Fatal error|Parse error):/', $html) === 0 && strpos($html, '</html>') !== false);
check('lingua inglese', strpos($html, '<html lang="en">') !== false);
check('canonical', strpos($html, '<link rel="canonical" href="' . $en . '">') !== false);
check('hreflang x-default italiano', strpos($html, 'hreflang="x-default" href="' . $it . '"') !== false);
check('indirizzo del connettore', strpos($html, 'https://liftindex.app/mcp<') !== false);
check('link all\'elenco inglese delle app ammesse', strpos($html, 'href="https://liftindex.app/en/assistenti-ai"') !== false);
check('dice che è in sola lettura', strpos($html, 'read-only') !== false);
check('dice che è premium', strpos($html, 'Premium') !== false);
check('registrazione su /en/register', strpos($html, 'href="https://liftindex.app/en/register"') !== false);
check('niente link italiani a login e registrazione', strpos($html, 'https://liftindex.app/register"') === false && strpos($html, 'https://liftindex.app/login"') === false);
check('JSON-LD in inglese', strpos($html, '"inLanguage": "en"') !== false);
check('link alla versione italiana', strpos($html, 'href="' . $it . '"') !== false && strpos($html, '>Italiano</a>') !== false);

echo "\n" . ($checks - $fails) . "/$checks controlli riusciti\n";
exit($fails > 0 ? 1 : 0);
