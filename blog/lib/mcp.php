<?php
/**
 * Pagina sul collegamento degli assistenti AI (server MCP), comune alla versione
 * italiana (mcp/) e a quella inglese (en/mcp/, pubblicata su /en/blog/mcp/).
 */

/** Indirizzo da incollare nell'app AI: la risorsa del server MCP, la stessa che l'app mostra nella scheda Account. */
const MCP_CONNECTOR_URL = BLOG_APP_URL . 'mcp';

/** Le due versioni della pagina, per hreflang e per il link all'altra lingua. */
function mcp_page_alternates()
{
    $it = BLOG_BASE_URL . '/mcp/';
    return array(
        'it' => $it,
        'en' => BLOG_APP_URL . 'en/blog/mcp/',
        'x-default' => $it,
    );
}
