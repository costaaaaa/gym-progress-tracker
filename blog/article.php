<?php
/**
 * Pagina di un singolo articolo.
 *
 * URL pubblico: /blog/<slug> (riscritto qui da .htaccess in ?slug=<slug>).
 */

require __DIR__ . '/lib/config.php';
require __DIR__ . '/lib/frontmatter.php';
require __DIR__ . '/lib/render.php';
require __DIR__ . '/lib/Parsedown.php';

/**
 * Risponde 404 con una pagina brandizzata e termina.
 */
function blog_not_found()
{
    http_response_code(404);

    $bodyHtml = '        <h1>Articolo non trovato</h1>' . "\n"
        . '        <p class="page-intro">La pagina che cercavi non esiste o e\' stata spostata.</p>' . "\n"
        . '        <p><a href="' . blog_e(BLOG_BASE_URL) . '/">Torna al blog</a></p>' . "\n";

    blog_render_page(array(
        'title' => 'Articolo non trovato',
        'description' => 'La pagina richiesta non esiste.',
        'canonical' => BLOG_BASE_URL . '/',
        'bodyHtml' => $bodyHtml,
    ));

    exit;
}

$slugRaw = isset($_GET['slug']) ? (string) $_GET['slug'] : '';

// Doppio guard contro il path traversal: basename() toglie qualunque componente
// di percorso, la whitelist rifiuta tutto cio' che non e' uno slug pulito.
$slug = basename($slugRaw);
if ($slug === '' || !preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/', $slug)) {
    blog_not_found();
}

$parsed = blog_parse_markdown_file(BLOG_CONTENT_DIR . '/' . $slug . '.md');
if ($parsed === null) {
    blog_not_found();
}

list($meta, $markdown) = $parsed;

$title = isset($meta['title']) ? $meta['title'] : $slug;
$description = isset($meta['description']) ? $meta['description'] : '';
$date = isset($meta['date']) ? $meta['date'] : '';
$dateLabel = blog_format_date($date);
$canonical = BLOG_BASE_URL . '/' . rawurlencode($slug);

// safeMode resta disattivato: il Markdown non e' user-generated, arriva dai file
// versionati in content/, e l'HTML inline (es. i commenti TODO) e' voluto.
$parsedown = new Parsedown();
$contentHtml = $parsedown->text($markdown);

$jsonLd = array(
    '@context' => 'https://schema.org',
    '@type' => 'BlogPosting',
    'headline' => $title,
    'description' => $description,
    'inLanguage' => 'it',
    'mainEntityOfPage' => array(
        '@type' => 'WebPage',
        '@id' => $canonical,
    ),
    'publisher' => array(
        '@type' => 'Organization',
        'name' => BLOG_SITE_NAME,
        'logo' => array(
            '@type' => 'ImageObject',
            'url' => BLOG_LOGO_URL,
        ),
    ),
);

if ($date !== '') {
    $jsonLd['datePublished'] = $date;
}

// author solo se dichiarato nel front matter: niente nomi inventati nello schema.
if (!empty($meta['author'])) {
    $jsonLd['author'] = array(
        '@type' => 'Person',
        'name' => $meta['author'],
    );
}

ob_start();
?>
        <article>
            <h1><?php echo blog_e($title); ?></h1>
<?php if ($dateLabel !== ''): ?>
            <p class="post-meta">Pubblicato il <time datetime="<?php echo blog_e($date); ?>"><?php echo blog_e($dateLabel); ?></time></p>
<?php endif; ?>
<?php echo $contentHtml; ?>
        </article>

        <aside class="article-cta">
            <h2>Metti in pratica quello che hai letto</h2>
            <p>LiftIndex registra i tuoi allenamenti e ti mostra volume, 1RM stimato e progressi nel tempo.</p>
            <p><a class="cta" href="<?php echo blog_e(BLOG_APP_URL); ?>">Vai all'app</a></p>
        </aside>
<?php
$bodyHtml = ob_get_clean();

blog_render_page(array(
    'title' => $title,
    'description' => $description,
    'canonical' => $canonical,
    'bodyHtml' => $bodyHtml,
    'jsonLd' => $jsonLd,
));
