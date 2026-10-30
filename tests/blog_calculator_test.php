<?php
// Calcolatore 1RM del blog: calcoli condivisi (blog/lib/calculator.php) e le due pagine,
// italiana e inglese, con hreflang. Si lancia con tests/blog_calculator.sh.
// Esce con 1 se un controllo fallisce.

require __DIR__ . '/../blog/lib/calculator.php';

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

/** HTML di una pagina con i parametri GET dati, in un processo PHP a parte (le pagine dichiarano funzioni). */
function render($page, array $get = array())
{
    $code = '$_GET = ' . var_export($get, true) . '; require ' . var_export(__DIR__ . '/../blog/' . $page, true) . ';';
    return (string) shell_exec(escapeshellarg(PHP_BINARY) . ' -r ' . escapeshellarg($code) . ' 2>&1');
}

$it = 'https://liftindex.app/blog/calcolatore-1rm/';
$en = 'https://liftindex.app/en/blog/1rm-calculator/';

echo "Calcoli\n";
check('Epley: 100 x 5 = 116,7', calc_one_rep_max(100, 5) === 116.7);
check('kg: carico arrotondato ai 2,5', calc_round_load(116.7 * 0.8, 'kg') === 92.5);
check('lb: carico arrotondato ai 5', calc_round_load(262.5 * 0.8, 'lb') === 210.0 && calc_round_load(233.3 * 0.8, 'lb') === 185.0);
check('formato italiano con la virgola', calc_format(116.7, ',') === '116,7' && calc_format(100.0, ',') === '100');
check('formato inglese con il punto', calc_format(116.7, '.') === '116.7' && calc_format(1100.0, '.') === '1100');
$_GET = array('w' => '82,5', 'u' => 'lb', 'x' => 'stone');
check('parametro con la virgola decimale', calc_param('w', 100, 1, 500) === 82.5);
check('unità lb accettata', calc_unit_param('u') === 'lb');
check('unità sconosciuta: kg', calc_unit_param('x') === 'kg' && calc_unit_param('manca') === 'kg');
$_GET = array();

echo "Pagina italiana\n";
$html = render('calcolatore-1rm/index.php', array('peso' => '100', 'ripetizioni' => '5'));
check('lang it', strpos($html, '<html lang="it">') !== false);
check('hreflang it', strpos($html, '<link rel="alternate" hreflang="it" href="' . $it . '">') !== false);
check('hreflang en', strpos($html, '<link rel="alternate" hreflang="en" href="' . $en . '">') !== false);
check('hreflang x-default', strpos($html, '<link rel="alternate" hreflang="x-default" href="' . $it . '">') !== false);
check('risultato 116,7 kg', strpos($html, '<span data-calc-one-rm>116,7</span>') !== false);
check('link alla versione inglese', strpos($html, 'href="' . $en . '"') !== false && strpos($html, '>English</a>') !== false);

echo "Pagina inglese\n";
$html = render('en/1rm-calculator/index.php');
check('lang en', strpos($html, '<html lang="en">') !== false);
check('og:locale en_US', strpos($html, '<meta property="og:locale" content="en_US">') !== false);
check('canonical inglese', strpos($html, '<link rel="canonical" href="' . $en . '">') !== false);
check('hreflang it', strpos($html, '<link rel="alternate" hreflang="it" href="' . $it . '">') !== false);
check('hreflang en', strpos($html, '<link rel="alternate" hreflang="en" href="' . $en . '">') !== false);
check('hreflang x-default', strpos($html, '<link rel="alternate" hreflang="x-default" href="' . $it . '">') !== false);
check('form verso l\'URL inglese', strpos($html, 'action="/en/blog/1rm-calculator/"') !== false);
check('registrazione su /en/register', strpos($html, 'href="https://liftindex.app/en/register"') !== false);
check('accesso su /en/login', strpos($html, 'href="https://liftindex.app/en/login"') !== false);
check('niente link italiani a login e registrazione', strpos($html, 'https://liftindex.app/register"') === false && strpos($html, 'https://liftindex.app/login"') === false);
check('esempio di default: 116.7 kg', strpos($html, '<span data-calc-one-rm>116.7</span>') !== false);
check('JSON-LD in inglese', strpos($html, '"inLanguage": "en"') !== false);
check('link alla versione italiana', strpos($html, 'href="' . $it . '"') !== false && strpos($html, '>Italiano</a>') !== false);

$html = render('en/1rm-calculator/index.php', array('weight' => '225', 'reps' => '5', 'unit' => 'lb'));
check('lb: 225 x 5 = 262.5', strpos($html, '<span data-calc-one-rm>262.5</span>') !== false);
check('lb: 80% = 210', strpos($html, 'data-calc-percent="80"') !== false && preg_match('/data-calc-percent="80">.*?<span data-calc-load>210<\/span>/s', $html) === 1);
check('lb: unità selezionata nel form', strpos($html, '<option value="lb" selected>') !== false);
check('lb: massimo 1100 nel campo peso', preg_match('/id="calc-weight"[^>]*max="1100"/', $html) === 1);

$html = render('en/1rm-calculator/index.php', array('weight' => '2000', 'reps' => '5', 'unit' => 'lb'));
check('lb: peso oltre il massimo portato a 1100', strpos($html, 'value="1100"') !== false);

echo "\n" . ($checks - $fails) . "/$checks controlli riusciti\n";
exit($fails > 0 ? 1 : 0);
