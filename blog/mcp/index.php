<?php
/**
 * Pagina pubblica sul collegamento degli assistenti AI (Claude, ChatGPT...) tramite il
 * server MCP: cosa legge, come si collega, cosa serve. HTML statico, leggibile senza JS,
 * pensato per la ricerca organica; l'elenco aggiornato delle app ammesse resta nella
 * pagina /assistenti-ai dell'app, a cui questa rimanda.
 *
 * URL e hreflang stanno in lib/mcp.php, condivisi con la pagina inglese.
 */

require __DIR__ . '/../lib/config.php';
require __DIR__ . '/../lib/render.php';
require __DIR__ . '/../lib/mcp.php';

$alternates = mcp_page_alternates();
$canonical = $alternates['it'];
$title = 'Collega Claude e ChatGPT ai tuoi allenamenti';
$description = 'Collega il tuo assistente AI a LiftIndex con MCP: legge in sola lettura allenamenti, carichi, record, schede e misure corporee e risponde sui tuoi numeri veri.';

ob_start();
?>
        <h1>Assistenti AI collegati: LiftIndex e MCP</h1>
        <p class="page-intro">Collega Claude, ChatGPT o un altro assistente AI al tuo account LiftIndex: invece di risponderti in generale, legge i tuoi allenamenti e ragiona sui tuoi numeri veri. Il collegamento usa MCP (Model Context Protocol), lo standard aperto con cui gli assistenti AI si collegano ad app esterne.</p>

        <h2>Cosa può leggere</h2>
        <p>L'assistente collegato legge i tuoi dati <strong>in sola lettura</strong>: non può creare, modificare o cancellare nulla sul tuo account.</p>
        <ul>
            <li>allenamenti e sessioni, con esercizi, serie e andamento dei carichi</li>
            <li>record personali</li>
            <li>schede</li>
            <li>statistiche e serie per gruppo muscolare</li>
            <li>misure corporee, anche lo storico, solo se scegli di condividerle</li>
        </ul>
        <p>Non legge mai le note, la tua email né la password.</p>

        <h2>Cosa puoi chiedergli</h2>
        <ul>
            <li>«Com'è andata la mia panca nell'ultimo mese? Sto migliorando o sono fermo?»</li>
            <li>«Quante serie ho fatto per gruppo muscolare questa settimana? Sto trascurando qualcosa?»</li>
            <li>«Guarda la mia scheda e i miei record: cosa cambieresti per le prossime quattro settimane?»</li>
        </ul>
        <p>Le proposte restano nella chat: se una modifica alla scheda ti convince, la fai tu su LiftIndex.</p>

        <h2>Come collegarlo</h2>
        <ol>
            <li>Copia l'indirizzo del connettore: <code><?php echo blog_e(MCP_CONNECTOR_URL); ?></code></li>
            <li>Nell'app AI aggiungi un connettore personalizzato e incolla l'indirizzo.</li>
            <li>Si apre LiftIndex: accedi, scegli se condividere le misure corporee e premi Consenti.</li>
        </ol>
        <p>Trovi gli stessi passi, con il pulsante per copiare l'indirizzo, nella scheda Account dell'app.</p>

        <h2>Cosa serve</h2>
        <ul>
            <li>Un account LiftIndex <strong>premium</strong>: il collegamento è riservato a chi ha almeno 18 anni.</li>
            <li>Un'app AI tra quelle ammesse: l'elenco aggiornato, con la scheda di ciascuna su come tratta i tuoi dati, è nella pagina <a href="<?php echo blog_e(BLOG_APP_URL); ?>assistenti-ai">app AI collegabili</a>.</li>
        </ul>

        <h2>I tuoi dati</h2>
        <p>Ogni collegamento richiede il tuo consenso esplicito e puoi revocarlo in qualunque momento dalla scheda Account. I dati che l'assistente legge passano al fornitore dell'app AI, che li tratta secondo la propria informativa: i dettagli sono nella <a href="<?php echo blog_e(BLOG_APP_URL); ?>privacy.html#assistenti-ai">privacy di LiftIndex</a>.</p>

        <aside class="article-cta">
            <h2>Prima i dati, poi le domande</h2>
            <p>Su LiftIndex registri serie, carichi e misure corporee: sono i numeri su cui il tuo assistente AI ragiona.</p>
            <a class="cta" href="<?php echo blog_e(BLOG_REGISTER_URL); ?>">Crea l'account gratis</a>
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
