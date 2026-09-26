<?php
/**
 * Configurazione del motore blog.
 *
 * Unico punto in cui vivono gli URL pubblici: alla migrazione verso il dominio
 * definitivo basta aggiornare questo file (vedi
 * docs/seo/domain-migration-checklist.md).
 *
 * NOTA: il blog non e' ancora pubblicato. Gli URL qui sotto riflettono
 * l'hosting attuale ma il blog viene caricato online solo in occasione della
 * migrazione, cosi' gli URL degli articoli nascono gia' puliti (/blog/<slug>).
 */

define('BLOG_BASE_URL', 'https://liftindex.app/blog');

define('BLOG_APP_URL', 'https://liftindex.app/');

define('BLOG_SITE_NAME', 'LiftIndex');
define('BLOG_LOGO_URL', BLOG_APP_URL . 'logo512.png');
define('BLOG_CONTENT_DIR', dirname(__DIR__) . '/content');
