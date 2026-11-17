<?php
/**
 * Pagina che confronta i piani Gratis, Plus e Pro, comune alla versione italiana (piani/,
 * pubblicata su /piani) e a quella inglese (en/plans/, pubblicata su /en/plans). Nginx
 * riscrive i due indirizzi pubblici su queste cartelle.
 *
 * I numeri della tabella vengono da backend/lib/tier_limits.php, la stessa fonte del server.
 */

require_once __DIR__ . '/../../backend/lib/tier_limits.php';

/** Le due versioni della pagina, per hreflang e per il link all'altra lingua. */
function plans_page_alternates()
{
    $it = BLOG_APP_URL . 'piani';
    return array(
        'it' => $it,
        'en' => BLOG_APP_URL . 'en/plans',
        'x-default' => $it,
    );
}

/** Limiti dei tre piani, per chiave: free, plus, pro. */
function plans_page_limits()
{
    return array('free' => tierLimits('free'), 'plus' => tierLimits('plus'), 'pro' => tierLimits('pro'));
}
