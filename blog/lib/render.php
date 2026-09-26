<?php
/**
 * Layout condiviso delle pagine del blog (head SEO, header brandizzato, footer).
 *
 * Palette, font e border-radius sono ripresi 1:1 dal tema MUI dell'app
 * (src/context/ThemeModeContext.jsx) — vanno tenuti in sync a mano se il tema
 * dell'app cambia. Il dark mode qui e' gestito solo da prefers-color-scheme:
 * il blog e' HTML/CSS statico servito da PHP, niente JS e niente toggle
 * (l'app ha il suo, persistito in localStorage, che non ha modo di arrivare
 * fin qui senza aggiungere script).
 */

/**
 * Scorciatoia per htmlspecialchars con i default sicuri.
 *
 * @param string|null $value
 * @return string
 */
function blog_e($value)
{
    return htmlspecialchars((string) $value, ENT_QUOTES, 'UTF-8');
}

/**
 * Stampa una pagina completa.
 *
 * @param array $opts {
 *     @type string $title       Titolo pagina (gia' senza suffisso brand).
 *     @type string $description Meta description.
 *     @type string $canonical   URL canonico assoluto.
 *     @type string $bodyHtml    Contenuto <main> gia' in HTML.
 *     @type array|null $jsonLd  Payload JSON-LD, o null.
 * }
 * @return void
 */
function blog_render_page(array $opts)
{
    $title = isset($opts['title']) ? $opts['title'] : BLOG_SITE_NAME;
    $description = isset($opts['description']) ? $opts['description'] : '';
    $canonical = isset($opts['canonical']) ? $opts['canonical'] : BLOG_BASE_URL;
    $bodyHtml = isset($opts['bodyHtml']) ? $opts['bodyHtml'] : '';
    $jsonLd = isset($opts['jsonLd']) ? $opts['jsonLd'] : null;

    // Suffisso brand solo se il <title> resta entro i ~60 caratteri che Google
    // mostra nella SERP: su un titolo d'articolo gia' lungo, aggiungerlo
    // significherebbe solo farlo troncare, perdendo le parole finali.
    $fullTitle = $title;
    $withBrand = $title . ' | ' . BLOG_SITE_NAME;
    if (mb_strlen($withBrand, 'UTF-8') <= 60) {
        $fullTitle = $withBrand;
    }

    header('Content-Type: text/html; charset=utf-8');
    ?>
<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title><?php echo blog_e($fullTitle); ?></title>
    <meta name="description" content="<?php echo blog_e($description); ?>">
    <link rel="canonical" href="<?php echo blog_e($canonical); ?>">

    <meta property="og:type" content="article">
    <meta property="og:title" content="<?php echo blog_e($fullTitle); ?>">
    <meta property="og:description" content="<?php echo blog_e($description); ?>">
    <meta property="og:url" content="<?php echo blog_e($canonical); ?>">
    <meta property="og:image" content="<?php echo blog_e(BLOG_LOGO_URL); ?>">
    <meta property="og:locale" content="it_IT">
    <meta name="twitter:card" content="summary">
    <meta name="twitter:title" content="<?php echo blog_e($fullTitle); ?>">
    <meta name="twitter:description" content="<?php echo blog_e($description); ?>">
    <meta name="twitter:image" content="<?php echo blog_e(BLOG_LOGO_URL); ?>">

    <link rel="preload" href="<?php echo blog_e(BLOG_APP_URL); ?>fonts/inter-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
    <style>
@font-face { font-family: "Inter"; font-style: normal; font-weight: 100 900; font-display: swap; src: url("<?php echo blog_e(BLOG_APP_URL); ?>fonts/inter-latin-wght-normal.woff2") format("woff2"); }
@font-face { font-family: "Lexend"; font-style: normal; font-weight: 100 900; font-display: swap; src: url("<?php echo blog_e(BLOG_APP_URL); ?>fonts/lexend-latin-wght-normal.woff2") format("woff2"); }
    </style>
    <style><?php echo blog_styles(); ?></style>
<?php $umamiSrc = getenv('UMAMI_SRC'); $umamiId = getenv('UMAMI_WEBSITE_ID'); if ($umamiSrc && $umamiId): ?>
    <script defer src="<?php echo blog_e($umamiSrc); ?>" data-website-id="<?php echo blog_e($umamiId); ?>" data-do-not-track="true"></script>
<?php endif; ?>
<?php if ($jsonLd !== null): ?>
    <script type="application/ld+json">
<?php echo json_encode($jsonLd, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT); ?>

    </script>
<?php endif; ?>
</head>
<body>
    <header class="site-header">
        <div class="wrap header-inner">
            <a class="brand" href="<?php echo blog_e(BLOG_BASE_URL); ?>/">
                <span class="brand-mark" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M20.57 14.86 22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 16.29z"/></svg>
                </span>
                <span class="brand-name">LiftIndex</span>
            </a>
            <a class="cta" href="<?php echo blog_e(BLOG_APP_URL); ?>">Vai all'app</a>
        </div>
    </header>

    <main class="wrap">
<?php echo $bodyHtml; ?>
    </main>

    <footer class="site-footer">
        <div class="wrap">
            <p>
                <a href="<?php echo blog_e(BLOG_BASE_URL); ?>/">Blog</a> &middot;
                <a href="<?php echo blog_e(BLOG_APP_URL); ?>"><?php echo blog_e(BLOG_SITE_NAME); ?></a>
            </p>
            <p class="muted">Diario di allenamento online: piani, Focus Mode, progressi.</p>
        </div>
    </footer>
</body>
</html>
    <?php
}

/**
 * CSS del blog. Token identici a quelli del tema MUI dell'app.
 *
 * @return string
 */
function blog_styles()
{
    return <<<'CSS'
:root {
  --primary-main: #d50000;
  --primary-light: #ff5131;
  --bg-default: #f7f6f5;
  --bg-paper: #ffffff;
  --text-primary: #1a1816;
  --text-secondary: #6b6663;
  --divider: #ececea;
  --radius: 16px;
}
@media (prefers-color-scheme: dark) {
  :root {
    --primary-main: #ff5252;
    --bg-default: #0a0a0b;
    --bg-paper: #141416;
    --text-primary: #ffffff;
    --text-secondary: #a0a0a2;
    --divider: rgba(255, 255, 255, 0.08);
  }
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--bg-default);
  color: var(--text-primary);
  font-family: "Inter", "Roboto", -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: 17px;
  line-height: 1.7;
  -webkit-font-smoothing: antialiased;
}
.wrap { width: 100%; max-width: 760px; margin: 0 auto; padding: 0 20px; }
h1, h2, h3, h4 {
  font-family: "Lexend", sans-serif;
  letter-spacing: -0.02em;
  line-height: 1.25;
  margin: 2.2rem 0 0.8rem;
}
h1 { font-weight: 800; font-size: 2.1rem; margin-top: 0; }
h2 { font-weight: 800; font-size: 1.5rem; }
h3 { font-weight: 700; font-size: 1.2rem; letter-spacing: -0.01em; }
p, ul, ol { margin: 0 0 1.1rem; }
a { color: var(--primary-main); text-decoration: none; }
a:hover { text-decoration: underline; }
code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.9em;
  background: var(--bg-paper);
  border: 1px solid var(--divider);
  border-radius: 6px;
  padding: 0.1em 0.35em;
}
pre {
  background: var(--bg-paper);
  border: 1px solid var(--divider);
  border-radius: var(--radius);
  padding: 16px;
  overflow-x: auto;
}
pre code { background: none; border: 0; padding: 0; }
blockquote {
  margin: 1.4rem 0;
  padding: 4px 18px;
  border-left: 3px solid var(--primary-main);
  color: var(--text-secondary);
}
img { max-width: 100%; height: auto; border-radius: var(--radius); }
.site-header {
  background: var(--bg-paper);
  border-bottom: 1px solid var(--divider);
  position: sticky;
  top: 0;
  z-index: 10;
}
.header-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  height: 64px;
}
.brand { display: inline-flex; align-items: center; gap: 10px; color: inherit; }
.brand:hover { text-decoration: none; }
.brand-mark {
  width: 34px;
  height: 34px;
  border-radius: 9px;
  background: var(--primary-main);
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
}
.brand-name { font-family: "Lexend", sans-serif; font-weight: 700; font-size: 16px; }
.cta {
  background: var(--primary-main);
  color: #fff;
  font-weight: 600;
  font-size: 14px;
  padding: 9px 16px;
  border-radius: 10px;
  white-space: nowrap;
}
.cta:hover { background: var(--primary-light); text-decoration: none; }
main.wrap { padding-top: 40px; padding-bottom: 56px; }
.page-intro { color: var(--text-secondary); margin-bottom: 2.2rem; }
.post-meta { color: var(--text-secondary); font-size: 0.92rem; margin: 0 0 2rem; }
.post-list { list-style: none; padding: 0; margin: 0; }
.post-card {
  background: var(--bg-paper);
  border: 1px solid var(--divider);
  border-radius: var(--radius);
  padding: 20px 22px;
  margin-bottom: 16px;
}
.post-card h2 { margin: 0 0 0.4rem; font-size: 1.25rem; }
.post-card h2 a { color: var(--text-primary); }
.post-card h2 a:hover { color: var(--primary-main); text-decoration: none; }
.post-card p { margin: 0 0 0.6rem; color: var(--text-secondary); font-size: 0.97rem; }
.post-card .post-meta { margin: 0; font-size: 0.85rem; }
.article-cta {
  background: var(--bg-paper);
  border: 1px solid var(--divider);
  border-radius: var(--radius);
  padding: 22px;
  margin-top: 3rem;
  text-align: center;
}
.article-cta h2 { margin-top: 0; font-size: 1.2rem; }
.article-cta p { color: var(--text-secondary); }
.site-footer {
  border-top: 1px solid var(--divider);
  padding: 28px 0 40px;
  font-size: 0.9rem;
  color: var(--text-secondary);
}
.site-footer p { margin: 0 0 0.3rem; }
.muted { color: var(--text-secondary); }
.empty-state { color: var(--text-secondary); }
@media (max-width: 600px) {
  body { font-size: 16px; }
  h1 { font-size: 1.7rem; }
  h2 { font-size: 1.3rem; }
}
CSS;
}
