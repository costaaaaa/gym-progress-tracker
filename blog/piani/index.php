<?php
/**
 * Pagina pubblica che confronta i piani Gratis, Plus e Pro: cosa include ciascuno e cosa
 * succede passando a un piano inferiore. HTML statico, leggibile senza JS, senza prezzi.
 * I numeri della tabella sono quelli del server (backend/lib/tier_limits.php).
 *
 * Pubblicata su /piani (Nginx riscrive su questa cartella). URL e hreflang stanno in
 * lib/plans.php, condivisi con la pagina inglese.
 */

require __DIR__ . '/../lib/config.php';
require __DIR__ . '/../lib/render.php';
require __DIR__ . '/../lib/plans.php';
require __DIR__ . '/../lib/mcp.php';

$alternates = plans_page_alternates();
$canonical = $alternates['it'];
$title = 'Piani Gratis, Plus e Pro: cosa include ciascuno';
$description = 'Il confronto tra i piani Gratis, Plus e Pro di LiftIndex: schede, giorni, esercizi personalizzati, stato muscolare e serie della settimana.';
$limits = plans_page_limits();

ob_start();
?>
        <h1>Piani Gratis, Plus e Pro</h1>
        <p class="page-intro">Plus e Pro non sono ancora acquistabili.</p>
        <p>Questa pagina confronta i tre piani di LiftIndex e dice cosa cambia dall'uno all'altro.</p>

        <h2>Confronto dei piani</h2>
        <table>
            <thead>
                <tr><th scope="col">Funzione</th><th scope="col">Gratis</th><th scope="col">Plus</th><th scope="col">Pro</th></tr>
            </thead>
            <tbody>
                <tr><th scope="row">Schede</th><td><?php echo (int) $limits['free']['plans']; ?></td><td><?php echo (int) $limits['plus']['plans']; ?></td><td><?php echo (int) $limits['pro']['plans']; ?></td></tr>
                <tr><th scope="row">Giorni per scheda</th><td><?php echo (int) $limits['free']['days_per_plan']; ?></td><td><?php echo (int) $limits['plus']['days_per_plan']; ?></td><td><?php echo (int) $limits['pro']['days_per_plan']; ?></td></tr>
                <tr><th scope="row">Esercizi personalizzati</th><td><?php echo (int) $limits['free']['personal_exercises']; ?></td><td><?php echo (int) $limits['plus']['personal_exercises']; ?></td><td><?php echo (int) $limits['pro']['personal_exercises']; ?></td></tr>
                <tr><th scope="row">Cambiare o aggiungere esercizi durante l'allenamento</th><td>no</td><td>sì</td><td>sì</td></tr>
                <tr><th scope="row">Stato muscolare</th><td>pronto / in recupero</td><td>con percentuale di recupero e giorni mancanti</td><td>come Plus</td></tr>
                <tr><th scope="row">Serie della settimana</th><td>solo il totale</td><td>per muscolo, con confronto con la settimana scorsa</td><td>come Plus</td></tr>
                <tr><th scope="row">AI Coach</th><td>–</td><td>in arrivo</td><td>in arrivo, con quota più alta</td></tr>
            </tbody>
        </table>
        <p>L'AI Coach è in arrivo, con quote diverse per Plus e Pro.</p>

        <h2>In tutti i piani, oggi</h2>
        <ul>
            <li>allenamenti senza limite</li>
            <li>storico completo</li>
            <li>progressi e grafici</li>
            <li>record personali</li>
            <li>misure corporee</li>
            <li>dati di Salute</li>
            <li>gruppi</li>
            <li>esportazione dei tuoi dati</li>
            <li>collegamento degli assistenti AI, come spiegato nella <a href="<?php echo blog_e(mcp_page_alternates()['it']); ?>">guida al collegamento</a></li>
        </ul>

        <h2>Se passi a un piano inferiore</h2>
        <p>Nessun dato viene cancellato. Se hai più schede del limite del nuovo piano, o una scheda con più giorni del limite, quelle schede restano utilizzabili per allenarti ma sono in sola lettura: non puoi aggiungere o modificare giorni ed esercizi finché non torni nei limiti, eliminando schede o giorni. Gli esercizi personalizzati che hai già restano.</p>

        <aside class="article-cta">
            <h2>Inizia a registrare i tuoi allenamenti</h2>
            <p>Il piano Gratis include gli allenamenti senza limite e lo storico completo.</p>
            <a class="cta" href="<?php echo blog_e(BLOG_REGISTER_URL); ?>">Crea il tuo account</a>
        </aside>
<?php
$bodyHtml = ob_get_clean();

blog_render_page(array(
    'title' => $title,
    'description' => $description,
    'canonical' => $canonical,
    'alternates' => $alternates,
    'bodyHtml' => $bodyHtml,
    'jsonLd' => array(
        '@context' => 'https://schema.org',
        '@type' => 'WebPage',
        'name' => $title,
        'description' => $description,
        'url' => $canonical,
        'inLanguage' => 'it',
        'publisher' => array('@type' => 'Organization', 'name' => BLOG_SITE_NAME, 'url' => BLOG_APP_URL),
    ),
));
