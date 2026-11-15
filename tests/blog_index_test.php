<?php
// Indice del blog (italiano): le card degli strumenti (calcolatore 1RM e guida MCP) e la sezione
// "Articoli" solo quando c'e' almeno un articolo. Si lancia con tests/blog_index.sh.
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

$html = render('index.php');

echo "Indice senza articoli (nel repo non ci sono i .md)\n";
check('nessun errore PHP', preg_match('/(Warning|Notice|Deprecated|Fatal error|Parse error):/', $html) === 0 && strpos($html, '</html>') !== false);
check('card del calcolatore 1RM', strpos($html, 'href="https://liftindex.app/blog/calcolatore-1rm/"') !== false);
check('card della guida MCP', strpos($html, 'href="https://liftindex.app/blog/mcp/">Collega il tuo assistente AI</a>') !== false);
check('la card MCP ha una riga di descrizione', preg_match('#<h3><a href="https://liftindex.app/blog/mcp/">[^<]*</a></h3>\s*<p>[^<]{20,}</p>#', $html) === 1);
check('niente sezione "Articoli" vuota', strpos($html, '<h2>Articoli</h2>') === false);
check('niente "Nessun articolo pubblicato"', strpos($html, 'Nessun articolo pubblicato') === false);
check('indice ancora noindex senza articoli (come la sitemap)', strpos($html, '<meta name="robots" content="noindex">') !== false);

echo "\n" . ($checks - $fails) . "/$checks controlli riusciti\n";
exit($fails > 0 ? 1 : 0);
