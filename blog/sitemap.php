<?php
/**
 * Sitemap degli articoli del blog.
 *
 * URL pubblico: /blog/sitemap.xml (riscritto qui da .htaccess e da Nginx).
 *
 * Si genera a ogni richiesta dai file in content/: gli articoli non sono nel repo,
 * quindi la sitemap costruita da vite.config.js non li vede. Contiene solo gli
 * articoli gia' pubblicati (vedi blog_is_published()).
 */

require __DIR__ . '/lib/config.php';
require __DIR__ . '/lib/frontmatter.php';

$articles = blog_list_articles(BLOG_CONTENT_DIR);

header('Content-Type: application/xml; charset=utf-8');

echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";
foreach ($articles as $article) {
    $loc = BLOG_BASE_URL . '/' . rawurlencode($article['slug']);
    echo "  <url>\n";
    echo '    <loc>' . htmlspecialchars($loc, ENT_XML1, 'UTF-8') . "</loc>\n";
    if (isset($article['date']) && blog_format_date($article['date']) !== '') {
        echo '    <lastmod>' . $article['date'] . "</lastmod>\n";
    }
    echo "  </url>\n";
}
echo "</urlset>\n";
