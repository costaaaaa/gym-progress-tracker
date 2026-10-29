<?php
/**
 * Pagina di listing del blog.
 *
 * Renderizzata lato server: il contenuto e' nell'HTML della prima risposta,
 * senza dipendere dall'esecuzione JS — che e' esattamente il motivo per cui il
 * blog e' PHP e non una sezione della SPA React (vedi audit SEO).
 */

require __DIR__ . '/lib/config.php';
require __DIR__ . '/lib/frontmatter.php';
require __DIR__ . '/lib/render.php';

$articles = blog_list_articles(BLOG_CONTENT_DIR);

$title = 'Blog';
$description = 'Guide pratiche su allenamento in palestra: come tracciare i progressi, volume, 1RM stimato e recupero muscolare.';

ob_start();
?>
        <h1>Blog</h1>
        <p class="page-intro"><?php echo blog_e($description); ?></p>

        <h2>Strumenti</h2>
        <ul class="post-list">
            <li class="post-card">
                <h3><a href="<?php echo blog_e(BLOG_BASE_URL . '/calcolatore-1rm/'); ?>">Calcolatore 1RM</a></h3>
                <p>Stima il tuo massimale da peso e ripetizioni e ottieni i carichi in percentuale. Gratis, senza registrazione.</p>
            </li>
        </ul>

        <h2>Articoli</h2>
<?php if (empty($articles)): ?>
        <p class="empty-state">Nessun articolo pubblicato al momento.</p>
<?php else: ?>
        <ul class="post-list">
<?php foreach ($articles as $article): ?>
<?php
            $url = BLOG_BASE_URL . '/' . rawurlencode($article['slug']);
            $data = isset($article['date']) ? blog_format_date($article['date']) : '';
?>
            <li class="post-card">
                <h2><a href="<?php echo blog_e($url); ?>"><?php echo blog_e($article['title']); ?></a></h2>
<?php if (!empty($article['description'])): ?>
                <p><?php echo blog_e($article['description']); ?></p>
<?php endif; ?>
<?php if ($data !== ''): ?>
                <p class="post-meta"><time datetime="<?php echo blog_e($article['date']); ?>"><?php echo blog_e($data); ?></time></p>
<?php endif; ?>
            </li>
<?php endforeach; ?>
        </ul>
<?php endif; ?>
<?php
$bodyHtml = ob_get_clean();

blog_render_page(array(
    'title' => $title,
    'description' => $description,
    'canonical' => BLOG_BASE_URL . '/',
    'bodyHtml' => $bodyHtml,
    'jsonLd' => array(
        '@context' => 'https://schema.org',
        '@type' => 'Blog',
        'name' => BLOG_SITE_NAME . ' — Blog',
        'description' => $description,
        'url' => BLOG_BASE_URL . '/',
        'inLanguage' => 'it',
    ),
));
