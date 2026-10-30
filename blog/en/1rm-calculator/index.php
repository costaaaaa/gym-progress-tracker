<?php
/**
 * Calcolatore 1RM in inglese, pubblicato su /en/blog/1rm-calculator/ (Nginx
 * riscrive /en/blog/ su questa cartella). Stessa pagina di
 * calcolatore-1rm/index.php, con il testo scritto per chi cerca "1rm
 * calculator" e la scelta tra kg e lb (carichi arrotondati ai 5 lb).
 *
 * Senza JS il form, inviato in GET, funziona come quello italiano; lo script
 * esterno e' lo stesso. I calcoli stanno in lib/calculator.php.
 */

require __DIR__ . '/../../lib/config.php';
require __DIR__ . '/../../lib/render.php';
require __DIR__ . '/../../lib/calculator.php';

$unit = calc_unit_param('unit');
$weight = calc_param('weight', 100, 1, CALC_UNITS[$unit]['max']);
$reps = (int) calc_param('reps', 5, 1, CALC_MAX_REPS);
$oneRm = calc_one_rep_max($weight, $reps);
$percents = array(100, 95, 90, 85, 80, 75, 70, 65, 60);

$alternates = calc_alternates();
$canonical = $alternates['en'];
$title = '1RM Calculator: estimate your one-rep max';
$description = 'Estimate your one-rep max (1RM) from weight and reps with the Epley formula and get your training loads from 100% to 60%. Free, in kg or lb, no sign-up.';

ob_start();
?>
        <h1>1RM Calculator (one-rep max)</h1>
        <p class="page-intro">Enter the weight you lifted and how many clean reps you got: the calculator estimates your one-rep max (1RM) and gives you the load to use at each percentage of it.</p>

        <section class="calc-card" aria-labelledby="calc-title">
            <h2 id="calc-title" class="visually-hidden">Calculate your 1RM</h2>
            <form class="calc-form" method="get" action="/en/blog/1rm-calculator/" data-calc-form data-calc-decimal=".">
                <div class="calc-field">
                    <label for="calc-weight">Weight lifted</label>
                    <input id="calc-weight" name="weight" data-calc-weight type="number" inputmode="decimal" min="1" max="<?php echo CALC_UNITS[$unit]['max']; ?>" step="any" value="<?php echo blog_e(number_format($weight, 1, '.', '') + 0); ?>" required>
                </div>
                <div class="calc-field calc-field-unit">
                    <label for="calc-unit">Unit</label>
                    <select id="calc-unit" name="unit" data-calc-unit>
<?php foreach (array_keys(CALC_UNITS) as $option): ?>
                        <option value="<?php echo $option; ?>"<?php echo $option === $unit ? ' selected' : ''; ?>><?php echo $option; ?></option>
<?php endforeach; ?>
                    </select>
                </div>
                <div class="calc-field">
                    <label for="calc-reps">Reps</label>
                    <input id="calc-reps" name="reps" data-calc-reps type="number" inputmode="numeric" min="1" max="<?php echo CALC_MAX_REPS; ?>" step="1" value="<?php echo blog_e($reps); ?>" required>
                </div>
                <button class="cta calc-submit" type="submit">Calculate</button>
            </form>

            <div class="calc-result" aria-live="polite">
                <p class="calc-result-label">Your estimated 1RM</p>
                <p class="calc-result-value"><span data-calc-one-rm><?php echo blog_e(calc_format($oneRm, '.')); ?></span> <span data-calc-unit-label><?php echo $unit; ?></span></p>
                <p class="calc-warning muted" data-calc-warning<?php echo $reps > 10 ? '' : ' hidden'; ?>>Above 10 reps the estimate gets less accurate: for a reliable number, use a set of 3 to 10 reps.</p>
            </div>

            <table class="pct-table">
                <caption>Loads by percentage of your 1RM</caption>
                <thead>
                    <tr><th scope="col">% 1RM</th><th scope="col">Load</th><th scope="col">Approx. reps</th></tr>
                </thead>
                <tbody>
<?php foreach ($percents as $percent): ?>
                    <tr data-calc-percent="<?php echo $percent; ?>">
                        <th scope="row"><?php echo $percent; ?>%</th>
                        <td><span data-calc-load><?php echo blog_e(calc_format(calc_round_load($oneRm * $percent / 100, $unit), '.')); ?></span> <span data-calc-unit-label><?php echo $unit; ?></span></td>
                        <td><?php echo calc_reps_at($percent); ?></td>
                    </tr>
<?php endforeach; ?>
                </tbody>
            </table>
            <p class="calc-note muted">Loads are rounded to 2.5 kg or 5 lb. The reps are what the same formula predicts at that load: a guide, not a target you have to hit.</p>
        </section>

        <h2>How the calculation works</h2>
        <p>The calculator uses the <strong>Epley formula</strong>, one of the most common ways to estimate your max without having to test it:</p>
        <p><code>1RM = weight × (1 + reps ÷ 30)</code></p>
        <p>If you get 5 reps with 225 lb, your estimated 1RM is 225 × (1 + 5 ÷ 30) = 262.5 lb; with 100 kg it comes to about 116.7 kg. The table under the result applies each percentage to that number: it's the usual way to pick the weights for a program (for example 4 sets of 6 at 80%).</p>

        <h2>When the estimate is reliable</h2>
        <ul>
            <li><strong>Use a real set</strong>: clean reps with good form, close to failure but without your technique breaking down.</li>
            <li><strong>Stay between 3 and 10 reps</strong>: in longer sets endurance starts to matter and the estimate drifts.</li>
            <li><strong>One lift at a time</strong>: your bench press max tells you nothing about your squat. Work it out for every exercise you want to program.</li>
            <li><strong>It's an estimate</strong>: two people with the same 1RM can get a different number of reps with the same weight. Use it to find your bearings, not as gospel.</li>
        </ul>

        <h2>Why estimate it instead of testing it</h2>
        <p>Testing your true max takes a long warm-up, a spotter and solid technique under the heaviest weight you have ever lifted. For most people who train, the risk isn't worth the number: an estimate from a set of 3 to 8 reps is plenty to program your loads and see whether you're getting stronger.</p>

        <aside class="article-cta">
            <h2>Your 1RM, updated every workout</h2>
            <p>On LiftIndex you log your sets and your estimated 1RM is worked out for every exercise, with a progress chart and your new records highlighted.</p>
            <a class="cta" href="<?php echo blog_e(BLOG_APP_URL . 'en/register'); ?>">Create a free account</a>
        </aside>
        <script src="/blog/assets/calcolatore-1rm.js" defer></script>
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
        '@type' => 'WebApplication',
        'name' => '1RM Calculator',
        'description' => $description,
        'url' => $canonical,
        'applicationCategory' => 'HealthApplication',
        'operatingSystem' => 'Any',
        'inLanguage' => 'en',
        'isAccessibleForFree' => true,
        'offers' => array('@type' => 'Offer', 'price' => '0', 'priceCurrency' => 'EUR'),
        'publisher' => array('@type' => 'Organization', 'name' => BLOG_SITE_NAME, 'url' => BLOG_APP_URL),
    ),
));
