<?php
/**
 * Calcolatore 1RM pubblico: strumento gratuito, senza login, pensato per la
 * ricerca organica ("calcolo 1rm", "calcolatore massimale").
 *
 * Il calcolo e' fatto anche lato server: il risultato d'esempio e' nell'HTML
 * della prima risposta e il form, inviato in GET, funziona senza JS. Lo script
 * esterno (assets/calcolatore-1rm.js, la CSP del blog vieta il JS inline)
 * aggiorna solo il risultato mentre si digita.
 *
 * Formula e arrotondamento sono gli stessi dell'app (estimateOneRepMax in
 * src/utils/workoutMetrics.js): se cambiano li', vanno cambiati qui e nello
 * script.
 */

require __DIR__ . '/../lib/config.php';
require __DIR__ . '/../lib/render.php';

const CALC_MAX_WEIGHT = 500;
const CALC_MAX_REPS = 20;

/** 1RM stimato con Epley, arrotondato a un decimale come nell'app. */
function calc_one_rep_max($weight, $reps)
{
    return round($weight * (1 + $reps / 30), 1);
}

/** Carico arrotondato ai 2,5 kg: il salto minimo con i dischi da 1,25 kg per lato. */
function calc_round_load($kg)
{
    return round($kg / 2.5) * 2.5;
}

/** Ripetizioni indicative a una data percentuale del massimale (Epley inversa). */
function calc_reps_at($percent)
{
    if ($percent >= 100) {
        return 1;
    }
    return max(1, (int) round(30 * (100 / $percent - 1)));
}

function calc_format_kg($kg)
{
    return str_replace('.', ',', rtrim(rtrim(number_format($kg, 1, '.', ''), '0'), '.'));
}

/** Legge un parametro numerico in GET (accetta la virgola decimale). */
function calc_param($name, $default, $min, $max)
{
    if (!isset($_GET[$name]) || !is_string($_GET[$name])) {
        return $default;
    }
    $value = str_replace(',', '.', trim($_GET[$name]));
    if (!is_numeric($value)) {
        return $default;
    }
    return min($max, max($min, (float) $value));
}

$weight = calc_param('peso', 100, 1, CALC_MAX_WEIGHT);
$reps = (int) calc_param('ripetizioni', 5, 1, CALC_MAX_REPS);
$oneRm = calc_one_rep_max($weight, $reps);
$percents = array(100, 95, 90, 85, 80, 75, 70, 65, 60);

$canonical = BLOG_BASE_URL . '/calcolatore-1rm/';
$title = 'Calcolatore 1RM: calcola il tuo massimale online';
$description = 'Calcola il massimale (1RM) da peso e ripetizioni con la formula di Epley e ottieni i carichi dal 95% al 60%. Gratis, senza registrazione.';

// Il link alla guida compare solo se l'articolo e' pubblicato: i .md non sono
// nel repo (vedi content/README.md) e un link rotto costa piu' di nessun link.
$guideSlug = 'come-calcolare-1rm';
$hasGuide = is_file(BLOG_CONTENT_DIR . '/' . $guideSlug . '.md');

ob_start();
?>
        <h1>Calcolatore 1RM (massimale)</h1>
        <p class="page-intro">Inserisci il peso che hai sollevato e quante ripetizioni pulite hai fatto: il calcolatore stima il tuo massimale su una ripetizione (1RM) e ti dà i carichi da usare in base alla percentuale.</p>

        <section class="calc-card" aria-labelledby="calc-title">
            <h2 id="calc-title" class="visually-hidden">Calcola il tuo 1RM</h2>
            <form class="calc-form" method="get" action="/blog/calcolatore-1rm/" data-calc-form>
                <div class="calc-field">
                    <label for="calc-peso">Peso sollevato (kg)</label>
                    <input id="calc-peso" name="peso" type="number" inputmode="decimal" min="1" max="<?php echo CALC_MAX_WEIGHT; ?>" step="any" value="<?php echo blog_e(number_format($weight, 1, '.', '') + 0); ?>" required>
                </div>
                <div class="calc-field">
                    <label for="calc-ripetizioni">Ripetizioni</label>
                    <input id="calc-ripetizioni" name="ripetizioni" type="number" inputmode="numeric" min="1" max="<?php echo CALC_MAX_REPS; ?>" step="1" value="<?php echo blog_e($reps); ?>" required>
                </div>
                <button class="cta calc-submit" type="submit">Calcola</button>
            </form>

            <div class="calc-result" aria-live="polite">
                <p class="calc-result-label">Il tuo 1RM stimato</p>
                <p class="calc-result-value"><span data-calc-one-rm><?php echo blog_e(calc_format_kg($oneRm)); ?></span> kg</p>
                <p class="calc-warning muted" data-calc-warning<?php echo $reps > 10 ? '' : ' hidden'; ?>>Oltre le 10 ripetizioni la stima diventa meno precisa: per un valore affidabile usa una serie da 3 a 10 ripetizioni.</p>
            </div>

            <table class="pct-table">
                <caption>Carichi in base alla percentuale del massimale</caption>
                <thead>
                    <tr><th scope="col">% 1RM</th><th scope="col">Carico</th><th scope="col">Ripetizioni circa</th></tr>
                </thead>
                <tbody>
<?php foreach ($percents as $percent): ?>
                    <tr data-calc-percent="<?php echo $percent; ?>">
                        <th scope="row"><?php echo $percent; ?>%</th>
                        <td><span data-calc-load><?php echo blog_e(calc_format_kg(calc_round_load($oneRm * $percent / 100))); ?></span> kg</td>
                        <td><?php echo calc_reps_at($percent); ?></td>
                    </tr>
<?php endforeach; ?>
                </tbody>
            </table>
            <p class="calc-note muted">Carichi arrotondati ai 2,5 kg. Le ripetizioni sono quelle che la stessa formula prevede a quel carico: un'indicazione, non un obbligo.</p>
        </section>

        <h2>Come funziona il calcolo</h2>
        <p>Il calcolatore usa la <strong>formula di Epley</strong>, una delle più diffuse per stimare il massimale senza doverlo testare:</p>
        <p><code>1RM = peso × (1 + ripetizioni ÷ 30)</code></p>
        <p>Se fai 5 ripetizioni con 100 kg, il tuo 1RM stimato è 100 × (1 + 5 ÷ 30) ≈ 116,7 kg. La tabella sotto il risultato applica le percentuali a quel valore: è il modo più comune per scegliere i carichi di una scheda (per esempio 4 serie da 6 all'80%).</p>

        <h2>Quando la stima è affidabile</h2>
        <ul>
            <li><strong>Usa una serie vera</strong>: ripetizioni pulite, con tecnica corretta, vicino al cedimento ma senza sbavature.</li>
            <li><strong>Resta tra 3 e 10 ripetizioni</strong>: con serie più lunghe entrano in gioco la resistenza e la stima tende a sbagliare.</li>
            <li><strong>Un esercizio alla volta</strong>: il massimale di panca non dice nulla sul tuo squat. Calcolalo per ogni esercizio che vuoi programmare.</li>
            <li><strong>È una stima</strong>: due persone con lo stesso 1RM possono fare un numero di ripetizioni diverso allo stesso carico. Usala per orientarti, non come verità assoluta.</li>
        </ul>

        <h2>Perché stimarlo invece di testarlo</h2>
        <p>Provare il massimale reale richiede riscaldamento lungo, un compagno che ti assista e una tecnica solida sotto il carico più pesante che tu abbia mai sollevato. Per la maggior parte di chi si allena il rischio non vale il dato: una stima da una serie di 3-8 ripetizioni è più che sufficiente per programmare i carichi e vedere se stai migliorando.</p>
<?php if ($hasGuide): ?>
        <p>Approfondisci nella guida: <a href="<?php echo blog_e(BLOG_BASE_URL . '/' . $guideSlug); ?>">come calcolare il tuo 1RM senza rischiare infortuni</a>.</p>
<?php endif; ?>

        <aside class="article-cta">
            <h2>Il tuo 1RM, aggiornato a ogni allenamento</h2>
            <p>Su LiftIndex registri le serie e il 1RM stimato si calcola da solo per ogni esercizio, con il grafico dei progressi e i nuovi record evidenziati.</p>
            <a class="cta" href="<?php echo blog_e(BLOG_APP_URL); ?>">Prova LiftIndex gratis</a>
        </aside>
        <script src="/blog/assets/calcolatore-1rm.js" defer></script>
<?php
$bodyHtml = ob_get_clean();

blog_render_page(array(
    'title' => $title,
    'description' => $description,
    'canonical' => $canonical,
    'bodyHtml' => $bodyHtml,
    'jsonLd' => array(
        '@context' => 'https://schema.org',
        '@type' => 'WebApplication',
        'name' => 'Calcolatore 1RM',
        'description' => $description,
        'url' => $canonical,
        'applicationCategory' => 'HealthApplication',
        'operatingSystem' => 'Any',
        'inLanguage' => 'it',
        'isAccessibleForFree' => true,
        'offers' => array('@type' => 'Offer', 'price' => '0', 'priceCurrency' => 'EUR'),
        'publisher' => array('@type' => 'Organization', 'name' => BLOG_SITE_NAME, 'url' => BLOG_APP_URL),
    ),
));
