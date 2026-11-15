<?php
// Calcolatore 1RM del blog: calcoli condivisi (blog/lib/calculator.php) e le due pagine,
// italiana e inglese, con hreflang. Si lancia con tests/blog_calculator.sh.
// Esce con 1 se un controllo fallisce.

require __DIR__ . '/../blog/lib/calculator.php';
require __DIR__ . '/../blog/lib/render.php';

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

echo "Campi del calcolatore (contrasto del bordo, WCAG 1.4.11)\n";
/** Luminanza relativa di un colore #rrggbb. */
function css_luminance($hex)
{
    $rgb = array_map(function ($v) {
        $c = hexdec($v) / 255;
        return $c <= 0.03928 ? $c / 12.92 : pow(($c + 0.055) / 1.055, 2.4);
    }, str_split(ltrim($hex, '#'), 2));
    return 0.2126 * $rgb[0] + 0.7152 * $rgb[1] + 0.0722 * $rgb[2];
}
function css_contrast($a, $b)
{
    $la = css_luminance($a);
    $lb = css_luminance($b);
    return (max($la, $lb) + 0.05) / (min($la, $lb) + 0.05);
}
/** Variabili colore di un blocco `:root` (o `:root[data-theme="dark"]`), vuoto se il blocco non esiste. */
function css_block_vars($css, $selector)
{
    if (!preg_match('/' . preg_quote($selector, '/') . '\s*\{([^}]*)\}/', $css, $block)) {
        return array();
    }
    preg_match_all('/--([a-z-]+):\s*(#[0-9a-f]{6})\s*;/i', $block[1], $all, PREG_SET_ORDER);
    $vars = array();
    foreach ($all as $v) {
        $vars[$v[1]] = $v[2];
    }
    return $vars;
}
/** Variabili del tema chiaro, o del scuro sopra a quelle del chiaro. */
function css_vars($css, $dark)
{
    $light = css_block_vars($css, ':root');
    return $dark ? array_merge($light, css_block_vars($css, ':root[data-theme="dark"]')) : $light;
}
$css = blog_styles();
check('il bordo di input e select usa --field-border', preg_match('/\.calc-field input, \.calc-field select \{[^}]*border: 1px solid var\(--field-border\);/', $css) === 1);
check('i blocchi :root chiaro e scuro esistono e hanno --field-border', isset(css_block_vars($css, ':root')['field-border']) && isset(css_block_vars($css, ':root[data-theme="dark"]')['field-border']));
foreach (array('chiaro' => false, 'scuro' => true) as $name => $dark) {
    $vars = css_vars($css, $dark);
    check("tema $name: bordo almeno 3:1 sullo sfondo del campo", css_contrast($vars['field-border'], $vars['bg-default']) >= 3.0);
    check("tema $name: bordo almeno 3:1 sulla card", css_contrast($vars['field-border'], $vars['bg-paper']) >= 3.0);
}

echo "Messaggi d'errore dei valori non validi (WCAG 3.3.1, 4.1.3)\n";
$errorPages = array(
    'it' => array(
        render('calcolatore-1rm/index.php'),
        'Inserisci un peso maggiore di 0 e fino a {max} kg.',
        'Inserisci da 1 a {max} ripetizioni.',
        array('calc-peso' => 'calc-peso-error', 'calc-ripetizioni' => 'calc-ripetizioni-error'),
    ),
    'en' => array(
        render('en/1rm-calculator/index.php'),
        'Enter a weight above 0 and up to {max} {unit}.',
        'Enter between 1 and {max} reps.',
        array('calc-weight' => 'calc-weight-error', 'calc-reps' => 'calc-reps-error'),
    ),
);
foreach ($errorPages as $lang => $page) {
    list($html, $msgWeight, $msgReps, $fields) = $page;
    check("$lang: i testi dei due errori sono sul form, con {max}", strpos($html, 'data-calc-msg-weight="' . $msgWeight . '"') !== false && strpos($html, 'data-calc-msg-reps="' . $msgReps . '"') !== false);
    foreach ($fields as $inputId => $errorId) {
        check("$lang: il campo $inputId è collegato a $errorId con aria-describedby", preg_match('/<input id="' . $inputId . '"[^>]*aria-describedby="' . $errorId . '"/', $html) === 1);
        check("$lang: $errorId è un avviso (role=alert), nascosto finché non serve e vuoto", preg_match('/<p class="calc-error" id="' . $errorId . '" data-calc-error="(weight|reps)" role="alert" hidden><\/p>/', $html) === 1);
        check("$lang: $errorId sta nello stesso .calc-field del suo campo", preg_match('/<div class="calc-field">\s*<label for="' . $inputId . '">[^<]*<\/label>\s*<input id="' . $inputId . '"[^>]*>\s*<p class="calc-error" id="' . $errorId . '"/', $html) === 1);
    }
}
check('il messaggio usa il colore --error-text e il campo sbagliato ha il bordo dello stesso colore', preg_match('/\.calc-error \{[^}]*color: var\(--error-text\)/', $css) === 1 && preg_match('/\.calc-field input\[aria-invalid="true"\] \{[^}]*border-color: var\(--error-text\)/', $css) === 1);
foreach (array('chiaro' => false, 'scuro' => true) as $name => $dark) {
    $vars = css_vars($css, $dark);
    check("tema $name: --error-text definito", isset($vars['error-text']));
    check("tema $name: testo dell'errore almeno 4,5:1 sulla card e sullo sfondo", css_contrast($vars['error-text'], $vars['bg-paper']) >= 4.5 && css_contrast($vars['error-text'], $vars['bg-default']) >= 4.5);
    check("tema $name: bordo del campo sbagliato almeno 3:1 sullo sfondo del campo", css_contrast($vars['error-text'], $vars['bg-default']) >= 3.0);
}

echo "Salta al contenuto (WCAG 2.4.1)\n";
$pages = array(
    'it' => array(render('calcolatore-1rm/index.php'), 'Salta al contenuto'),
    'en' => array(render('en/1rm-calculator/index.php'), 'Skip to main content'),
);
foreach ($pages as $lang => $page) {
    list($html, $text) = $page;
    check("$lang: il primo link del body è «{$text}» verso il main", preg_match('/<body>\s*<a class="skip-link" href="#main-content">' . preg_quote($text, '/') . '<\/a>/', $html) === 1);
    check("$lang: il main è raggiungibile dal link e dal programma", strpos($html, '<main class="wrap" id="main-content" tabindex="-1">') !== false);
}
check('il link sta fuori dallo schermo finché non ha il focus', preg_match('/\.skip-link \{[^}]*transform: translateY\(-200%\)/', $css) === 1 && preg_match('/\.skip-link:focus \{[^}]*transform: none/', $css) === 1);

echo "\n" . ($checks - $fails) . "/$checks controlli riusciti\n";
exit($fails > 0 ? 1 : 0);
