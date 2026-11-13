<?php
/**
 * Collegamento degli assistenti AI (server MCP) in inglese, pubblicata su /en/blog/mcp/
 * (Nginx riscrive /en/blog/ su questa cartella). Stessa pagina di mcp/index.php, con il
 * testo in inglese e i link alle pagine /en/ dell'app.
 *
 * URL e hreflang stanno in lib/mcp.php.
 */

require __DIR__ . '/../../lib/config.php';
require __DIR__ . '/../../lib/render.php';
require __DIR__ . '/../../lib/mcp.php';

$alternates = mcp_page_alternates();
$canonical = $alternates['en'];
$title = 'Connect Claude and ChatGPT to your workouts';
$description = 'Connect your AI assistant to LiftIndex with MCP: it reads your workouts, loads, records, plans and body measurements read-only and answers with your real numbers.';

ob_start();
?>
        <h1>Connected AI assistants: LiftIndex and MCP</h1>
        <p class="page-intro">Ask an AI assistant how your bench press is going and you get a generic answer: it doesn't know how much you lift, or how long you've been stuck. Connect it to your LiftIndex account and it works with your real numbers.</p>
        <p>Claude, ChatGPT and the other approved assistants connect through MCP (Model Context Protocol), the open standard an AI assistant uses to read data from another app.</p>

        <h2>What it can read</h2>
        <p>The connected assistant reads your data <strong>read-only</strong>: it can't create, change or delete anything in your account.</p>
        <ul>
            <li>workouts and sessions, with exercises, sets and load progress</li>
            <li>personal records</li>
            <li>training plans</li>
            <li>stats and sets by muscle group</li>
            <li>body measurements, including history, only if you choose to share them</li>
        </ul>
        <p>It never reads your notes, your email or your password.</p>

        <h2>What you can ask</h2>
        <ul>
            <li>"How did my bench press go this past month? Am I progressing or stuck?"</li>
            <li>"How many sets per muscle group did I do this week? Am I neglecting anything?"</li>
            <li>"Look at my plan and my records: what would you change for the next four weeks?"</li>
        </ul>
        <p>Suggestions stay in the chat: if a change to your plan makes sense, you make it in LiftIndex.</p>

        <h2>How to connect it</h2>
        <ol>
            <li>Copy the link: <code><?php echo blog_e(MCP_CONNECTOR_URL); ?></code></li>
            <li>In the AI app, add a custom connector and paste the link.</li>
            <li>LiftIndex opens: sign in, confirm your password if asked and press "Allow".</li>
        </ol>
        <p>If you want it to read your body measurements too, check "Also share body measurements (weight and similar)" before pressing "Allow". The box is enabled only if you've already consented to body measurements in your account settings.</p>
        <p>The same steps, with the "Copy link" button, are on the Account tab of the app.</p>

        <h2>What you need</h2>
        <ul>
            <li>A LiftIndex account: connecting is for users who are at least 18.</li>
            <li>One of the approved AI apps: the up-to-date list, with how each one handles your data, is on the <a href="<?php echo blog_e(BLOG_APP_URL . 'en/assistenti-ai'); ?>">AI apps you can connect</a> page.</li>
        </ul>

        <h2>Your data</h2>
        <p>Every connection asks for your explicit consent, and you can revoke it anytime from the Account tab. The data the assistant reads goes to the AI app's provider, which handles it under its own privacy policy: the details are in the <a href="<?php echo blog_e(BLOG_APP_URL . 'privacy.html#assistenti-ai'); ?>">LiftIndex privacy policy</a> (in Italian).</p>

        <aside class="article-cta">
            <h2>Log your workouts first</h2>
            <p>The assistant only reads what you've logged in LiftIndex: sets, loads and, if you want, body measurements.</p>
            <a class="cta" href="<?php echo blog_e(BLOG_APP_URL . 'en/register'); ?>">Create a free account</a>
        </aside>
<?php
$bodyHtml = ob_get_clean();

blog_render_page(array(
    'title' => $title,
    'description' => $description,
    'canonical' => $canonical,
    'alternates' => $alternates,
    'lang' => 'en',
    'bodyHtml' => $bodyHtml,
    'jsonLd' => array(
        '@context' => 'https://schema.org',
        '@type' => 'WebPage',
        'name' => $title,
        'description' => $description,
        'url' => $canonical,
        'inLanguage' => 'en',
        'publisher' => array('@type' => 'Organization', 'name' => BLOG_SITE_NAME, 'url' => BLOG_APP_URL),
    ),
));
