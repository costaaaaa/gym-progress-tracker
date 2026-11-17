<?php
// Pagina pubblica che confronta i piani Gratis, Plus e Pro: le due versioni, italiana e inglese,
// con hreflang, canonical, numeri uguali a quelli del server (tierLimits) e senza prezzi.
// Si lancia con tests/blog_plans.sh. Esce con 1 se un controllo fallisce.

require __DIR__ . '/../backend/lib/tier_limits.php';

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

$it = 'https://liftindex.app/piani';
$en = 'https://liftindex.app/en/plans';

/** Righe della tabella dei piani: etichetta della riga => celle (testo senza tag). */
function table_rows($html)
{
    $rows = array();
    preg_match_all('#<tr>(.*?)</tr>#s', $html, $trs);
    foreach ($trs[1] as $tr) {
        preg_match_all('#<t[hd][^>]*>(.*?)</t[hd]>#s', $tr, $cells);
        $texts = array_map(function ($c) {
            return trim(html_entity_decode(strip_tags($c), ENT_QUOTES, 'UTF-8'));
        }, $cells[1]);
        $rows[array_shift($texts)] = $texts;
    }
    return $rows;
}

/** Controlli comuni alle due lingue; $t sono i testi attesi nella lingua della pagina. */
function check_page($html, $lang, $canonical, array $t, array $labels)
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
    check('un solo h1', substr_count($html, '<h1>') === 1);
    check('link alla guida degli assistenti AI nella lingua della pagina', strpos($html, 'href="' . ($lang === 'en' ? 'https://liftindex.app/en/blog/mcp/' : 'https://liftindex.app/blog/mcp/') . '"') !== false);
    check('piè di pagina: privacy e termini nella lingua della pagina', strpos($html, 'href="' . $app . 'privacy.html">Privacy</a>') !== false
        && strpos($html, 'href="' . $app . ($lang === 'en' ? 'terms.html' : 'termini.html') . '"') !== false);
    check('registrazione nella lingua della pagina', strpos($html, 'href="' . $app . 'register"') !== false);
    check('JSON-LD nella lingua della pagina', strpos($html, '"inLanguage": "' . $lang . '"') !== false);
    $other = $lang === 'en' ? array($it, 'it', 'Italiano') : array($en, 'en', 'English');
    check('link all\'altra lingua', strpos($html, '<a href="' . $other[0] . '" hreflang="' . $other[1] . '" lang="' . $other[1] . '">' . $other[2] . '</a>') !== false);
    foreach ($t as $desc => $text) {
        check($desc, strpos($html, $text) !== false);
    }

    // Numeri della tabella = numeri del server.
    $rows = table_rows($html);
    $free = tierLimits('free');
    $plus = tierLimits('plus');
    $pro = tierLimits('pro');
    $map = array('plans' => $labels['plans'], 'days_per_plan' => $labels['days'], 'personal_exercises' => $labels['exercises']);
    foreach ($map as $key => $label) {
        $row = isset($rows[$label]) ? $rows[$label] : null;
        check("riga «{$label}»: Gratis, Plus e Pro come tierLimits()", $row === array((string) $free[$key], (string) $plus[$key], (string) $pro[$key]));
    }
    check('tabella con i tre piani nell\'intestazione', isset($rows[$labels['corner']]) && $rows[$labels['corner']] === $labels['head']);

    // Nessun prezzo, nessuna promessa, niente di privato.
    $text = html_entity_decode(strip_tags($html), ENT_QUOTES, 'UTF-8');
    check('nessun simbolo di valuta', preg_match('/[€$£]/u', $text) === 0);
    check('nessuna cifra con euro o dollari', preg_match('/\d\s*(eur|euro|usd|dollar|dollari)\b/iu', $text) === 0);
    check('nessuna promessa «per sempre»', preg_match('/per sempre|forever|for life/iu', $text) === 0);
    check('nessun riferimento all\'Apple Watch', stripos($text, 'watch') === false);
    check('nessun riferimento ad app mobile', preg_match('/mobile app|app mobile/iu', $html) === 0);
}

echo "Pagina italiana\n";
$htmlIt = render('piani/index.php');
check_page($htmlIt, 'it', $it, array(
    'frase in alto: Plus e Pro non ancora acquistabili' => 'Plus e Pro non sono ancora acquistabili',
    'AI Coach: quote diverse' => 'in arrivo, con quote diverse per Plus e Pro',
    'elenco «in tutti i piani, oggi»' => 'In tutti i piani, oggi',
    'passaggio a un piano inferiore: nessun dato cancellato' => 'Nessun dato viene cancellato',
    'sola lettura' => 'sola lettura',
), array('plans' => 'Schede', 'days' => 'Giorni per scheda', 'exercises' => 'Esercizi personalizzati', 'head' => array('Gratis', 'Plus', 'Pro'), 'corner' => 'Funzione'));
check('titolo con Gratis, Plus e Pro', preg_match('#<title>[^<]*Gratis[^<]*Plus[^<]*Pro#u', $htmlIt) === 1);
check('IT: la parola «livello» non indica l\'abbonamento', stripos($htmlIt, 'livello') === false && stripos($htmlIt, 'livelli') === false);

echo "Pagina inglese\n";
$htmlEn = render('en/plans/index.php');
check_page($htmlEn, 'en', $en, array(
    'frase in alto: Plus e Pro non ancora acquistabili' => 'Plus and Pro can\'t be bought yet',
    'AI Coach: quote diverse' => 'coming soon, with different allowances for Plus and Pro',
    'elenco «in tutti i piani, oggi»' => 'On every plan, today',
    'passaggio a un piano inferiore: nessun dato cancellato' => 'No data is deleted',
    'sola lettura' => 'read-only',
), array('plans' => 'Workout plans', 'days' => 'Days per workout plan', 'exercises' => 'Custom exercises', 'head' => array('Free', 'Plus', 'Pro'), 'corner' => 'Feature'));
check('titolo con Free, Plus and Pro', preg_match('#<title>[^<]*Free, Plus and Pro#u', $htmlEn) === 1);
check('EN: niente link alle pagine legali italiane', strpos($htmlEn, 'liftindex.app/privacy.html') === false && strpos($htmlEn, 'liftindex.app/termini.html') === false);
check('EN: niente link italiani a login e registrazione', strpos($htmlEn, 'https://liftindex.app/register"') === false && strpos($htmlEn, 'https://liftindex.app/login"') === false);

echo "Piè di pagina del blog\n";
check('IT: link ai piani', strpos($htmlIt, '<a href="https://liftindex.app/piani">Piani</a>') !== false);
check('EN: link ai piani', strpos($htmlEn, '<a href="https://liftindex.app/en/plans">Free, Plus and Pro</a>') !== false);

echo "Sitemap\n";
$vite = file_get_contents(__DIR__ . '/../vite.config.js');
check('coppia it/en in vite.config.js', strpos($vite, "{ it: '/piani', en: '/en/plans' }") !== false);

echo "\n" . ($checks - $fails) . "/$checks controlli riusciti\n";
exit($fails > 0 ? 1 : 0);
