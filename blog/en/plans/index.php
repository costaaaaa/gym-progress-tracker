<?php
/**
 * Confronto dei piani Free, Plus e Pro in inglese, pubblicato su /en/plans (Nginx riscrive su
 * questa cartella). Stessa pagina di piani/index.php, con il testo in inglese e i link alle
 * pagine /en/ dell'app. In inglese "plan" da solo si confonde con la scheda ("workout plan"):
 * il titolo e i testi parlano di Free, Plus e Pro.
 *
 * URL e hreflang stanno in lib/plans.php.
 */

require __DIR__ . '/../../lib/config.php';
require __DIR__ . '/../../lib/render.php';
require __DIR__ . '/../../lib/plans.php';
require __DIR__ . '/../../lib/mcp.php';

$alternates = plans_page_alternates();
$canonical = $alternates['en'];
$title = 'Free, Plus and Pro: what each one includes';
$description = 'Compare Free, Plus and Pro in LiftIndex: workout plans, days, custom exercises, muscle status and weekly sets.';
$limits = plans_page_limits();

ob_start();
?>
        <h1>Free, Plus and Pro</h1>
        <p class="page-intro">Plus and Pro can't be bought yet.</p>
        <p>This page compares Free, Plus and Pro and says what changes from one to the next.</p>

        <h2>Compare Free, Plus and Pro</h2>
        <table>
            <thead>
                <tr><th scope="col">Feature</th><th scope="col">Free</th><th scope="col">Plus</th><th scope="col">Pro</th></tr>
            </thead>
            <tbody>
                <tr><th scope="row">Workout plans</th><td><?php echo (int) $limits['free']['plans']; ?></td><td><?php echo (int) $limits['plus']['plans']; ?></td><td><?php echo (int) $limits['pro']['plans']; ?></td></tr>
                <tr><th scope="row">Days per workout plan</th><td><?php echo (int) $limits['free']['days_per_plan']; ?></td><td><?php echo (int) $limits['plus']['days_per_plan']; ?></td><td><?php echo (int) $limits['pro']['days_per_plan']; ?></td></tr>
                <tr><th scope="row">Custom exercises</th><td><?php echo (int) $limits['free']['personal_exercises']; ?></td><td><?php echo (int) $limits['plus']['personal_exercises']; ?></td><td><?php echo (int) $limits['pro']['personal_exercises']; ?></td></tr>
                <tr><th scope="row">Swap or add exercises during a workout</th><td>no</td><td>yes</td><td>yes</td></tr>
                <tr><th scope="row">Muscle status</th><td>ready / recovering</td><td>with recovery percentage and days left</td><td>same as Plus</td></tr>
                <tr><th scope="row">Weekly sets</th><td>total only</td><td>by muscle, compared with last week</td><td>same as Plus</td></tr>
                <tr><th scope="row">AI Coach</th><td>–</td><td>coming soon</td><td>coming soon, with a higher allowance</td></tr>
            </tbody>
        </table>
        <p>The AI Coach is coming soon, with different allowances for Plus and Pro.</p>

        <h2>Included in Free, Plus and Pro, today</h2>
        <ul>
            <li>unlimited workouts</li>
            <li>full history</li>
            <li>progress and charts</li>
            <li>personal records</li>
            <li>body measurements</li>
            <li>health data</li>
            <li>groups</li>
            <li>export of your data</li>
            <li>connecting AI assistants, as explained in the <a href="<?php echo blog_e(mcp_page_alternates()['en']); ?>">connection guide</a></li>
        </ul>

        <h2>If you move down from Plus or Pro</h2>
        <p>No data is deleted. If you then have more workout plans than the new limit, or a workout plan with more days than the limit, those workout plans stay usable for training but are read-only: you can't add or change days and exercises until you are back within the limits, by deleting workout plans or days. The custom exercises you already have stay.</p>

        <aside class="article-cta">
            <h2>Start logging your workouts</h2>
            <p>Free includes unlimited workouts and your full history.</p>
            <a class="cta" href="<?php echo blog_e(BLOG_APP_URL . 'en/register'); ?>">Create your account</a>
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
