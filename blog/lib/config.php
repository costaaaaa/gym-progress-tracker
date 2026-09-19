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

// TODO migrazione: -> https://<nuovo-dominio>/blog
define('BLOG_BASE_URL', 'https://andreacostamagna.altervista.org/gym-progress-tracker-v2/blog');

// TODO migrazione: -> https://<nuovo-dominio>/
define('BLOG_APP_URL', 'https://andreacostamagna.altervista.org/gym-progress-tracker-v2/');

define('BLOG_SITE_NAME', 'Gym Progress Tracker');
define('BLOG_LOGO_URL', BLOG_APP_URL . 'logo512.png');
define('BLOG_CONTENT_DIR', dirname(__DIR__) . '/content');
