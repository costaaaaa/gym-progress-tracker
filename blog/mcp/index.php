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
        <p class="page-intro">Chiedi a un assistente AI come sta andando la tua panca e ti risponde in generale: non sa quanto sollevi, né da quanto sei fermo. Collegalo al tuo account LiftIndex e ragiona sui tuoi numeri veri.</p>
        <p>Claude, ChatGPT e gli altri assistenti ammessi si collegano con MCP (Model Context Protocol), lo standard aperto con cui un assistente AI legge i dati di un'altra app.</p>

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
            <li>"Com'è andata la mia panca nell'ultimo mese? Sto migliorando o sono fermo?"</li>
            <li>"Quante serie ho fatto per gruppo muscolare questa settimana? Sto trascurando qualcosa?"</li>
            <li>"Guarda la mia scheda e i miei record: cosa cambieresti per le prossime quattro settimane?"</li>
        </ul>
        <p>Le proposte restano nella chat: se una modifica alla scheda ti convince, la fai tu su LiftIndex.</p>

        <h2>Come collegarlo</h2>
        <ol>
            <li>Copia il link: <code><?php echo blog_e(MCP_CONNECTOR_URL); ?></code></li>
            <li>Nell'app AI aggiungi un connettore personalizzato e incolla il link.</li>
            <li>Si apre LiftIndex: accedi, conferma la password se te lo chiede e premi "Consenti".</li>
        </ol>
        <p>Se vuoi che legga anche le misure corporee, prima di premere "Consenti" spunta "Condividi anche le misure corporee (peso e simili)". La casella è attiva solo se hai già dato il consenso alle misure corporee nelle impostazioni dell'account.</p>
        <p>Trovi gli stessi passi, con il pulsante "Copia link", nella scheda Account dell'app.</p>

        <h2>Cosa serve</h2>
        <ul>
            <li>Un account LiftIndex: il collegamento è riservato a chi ha almeno 18 anni.</li>
            <li>Un'app AI tra quelle ammesse: l'elenco aggiornato, con la scheda di ciascuna su come tratta i tuoi dati, è nella pagina <a href="<?php echo blog_e(BLOG_APP_URL . 'assistenti-ai'); ?>">app AI collegabili</a>.</li>
        </ul>

        <h2>I tuoi dati</h2>
        <p>Ogni collegamento richiede il tuo consenso esplicito e puoi revocarlo in qualunque momento dalla scheda Account. I dati che l'assistente legge passano al fornitore dell'app AI, che li tratta secondo la propria informativa: i dettagli sono nella <a href="<?php echo blog_e(BLOG_APP_URL . 'privacy.html#assistenti-ai'); ?>">privacy di LiftIndex</a>.</p>

        <aside class="article-cta">
            <h2>Prima registra i tuoi allenamenti</h2>
            <p>L'assistente legge solo quello che hai registrato su LiftIndex: serie, carichi e, se vuoi, le misure corporee.</p>
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
