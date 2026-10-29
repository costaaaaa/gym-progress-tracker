<?php
/**
 * Layout condiviso delle pagine del blog (head SEO, header brandizzato, footer).
 *
 * Palette, font, border-radius, header e footer sono ripresi dal tema MUI e dal
 * Layout dell'app (src/context/ThemeModeContext.jsx, src/components/Layout/,
 * marchio da src/components/LogoMark.jsx) — vanno tenuti in sync a mano se
 * l'app cambia. Il tema chiaro/scuro e' quello scelto nell'app (themeMode in
 * localStorage, stessa origine), chiaro di default: lo applica assets/tema.js,
 * che gestisce anche il toggle nell'header.
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
 *     @type bool   $noindex     true: la pagina non va indicizzata (i link si seguono comunque).
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
    $noindex = !empty($opts['noindex']);

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
    <script src="/blog/assets/tema.js"></script>
    <title><?php echo blog_e($fullTitle); ?></title>
    <meta name="description" content="<?php echo blog_e($description); ?>">
    <link rel="canonical" href="<?php echo blog_e($canonical); ?>">
<?php if ($noindex): ?>
    <meta name="robots" content="noindex">
<?php endif; ?>

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
<?php echo json_encode($jsonLd, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_HEX_TAG); ?>

    </script>
<?php endif; ?>
</head>
<body>
    <header class="site-header">
        <div class="header-inner">
            <a class="brand" href="<?php echo blog_e(BLOG_BASE_URL); ?>/">
                <span class="brand-mark" aria-hidden="true">
                    <svg viewBox="0 0 160 122" width="20" height="15.25" fill="none" stroke="currentColor" stroke-width="22" stroke-linecap="round"><line x1="11" y1="37" x2="11" y2="85"/><line x1="45.5" y1="11" x2="45.5" y2="111"/><line x1="114.5" y1="11" x2="114.5" y2="111"/><line x1="149" y1="37" x2="149" y2="85"/></svg>
                </span>
                <span class="brand-name">LiftIndex</span>
            </a>
            <div class="header-actions">
                <button class="theme-toggle" type="button" data-theme-toggle hidden>
                    <svg class="icon-dark" viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1"/></svg>
                    <svg class="icon-light" viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5M2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1m18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1M11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1m0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1M5.99 4.58c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41zm12.37 12.37c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41zm1.06-10.96c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0zM7.05 18.36c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0z"/></svg>
                </button>
                <a class="nav-link" href="<?php echo blog_e(BLOG_APP_URL); ?>login">Accedi</a>
                <a class="cta" href="<?php echo blog_e(BLOG_REGISTER_URL); ?>">Registrati</a>
            </div>
        </div>
    </header>

    <main class="wrap">
<?php echo $bodyHtml; ?>
    </main>

    <footer class="site-footer">
        <a href="<?php echo blog_e(BLOG_BASE_URL); ?>/">Blog</a> &middot;
        <a href="<?php echo blog_e(BLOG_APP_URL); ?>privacy.html">Privacy</a> &middot;
        <a href="<?php echo blog_e(BLOG_APP_URL); ?>termini.html">Termini d'uso</a>
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
  color-scheme: light;
  --primary-main: #d50000;
  --primary-dark: #9b0000;
  --bg-default: #f7f6f5;
  --bg-paper: #ffffff;
  --text-primary: #1a1816;
  --text-secondary: #6b6663;
  --divider: #ececea;
  --toggle-bg: #f7f6f5;
  --toggle-bg-hover: #ececea;
  --radius: 16px;
}
/* Come nell'app il rosso del marchio non cambia in scuro. */
:root[data-theme="dark"] {
  color-scheme: dark;
  --bg-default: #0a0a0b;
  --bg-paper: #141416;
  --text-primary: #ffffff;
  --text-secondary: #a0a0a2;
  --divider: rgba(255, 255, 255, 0.08);
  --toggle-bg: rgba(255, 255, 255, 0.06);
  --toggle-bg-hover: rgba(255, 255, 255, 0.12);
}
* { box-sizing: border-box; }
body {
  margin: 0;
  transition: background-color 0.3s ease, color 0.3s ease;
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
/* Link nel testo: colore del testo e sottolineati, come nell'app (il rosso resta ai bottoni). */
a { color: var(--text-primary); text-decoration: underline; }
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
  max-width: 1180px;
  margin: 0 auto;
  padding: 0 32px;
}
.brand { display: inline-flex; align-items: center; gap: 10px; color: inherit; text-decoration: none; }
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
.brand-name { font-family: "Lexend", sans-serif; font-weight: 700; font-size: 16px; line-height: 1; }
.header-actions { display: flex; align-items: center; gap: 12px; }
.theme-toggle {
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: 50%;
  padding: 0;
  background: var(--toggle-bg);
  color: var(--text-secondary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.theme-toggle[hidden] { display: none; }
.theme-toggle:hover { background: var(--toggle-bg-hover); }
.theme-toggle .icon-light, [data-theme="dark"] .theme-toggle .icon-dark { display: none; }
[data-theme="dark"] .theme-toggle .icon-light { display: block; }
.nav-link {
  color: var(--text-secondary);
  font-weight: 500;
  font-size: 14px;
  letter-spacing: 0.02em;
  padding: 10px 8px;
  text-decoration: none;
  white-space: nowrap;
}
.nav-link:hover { color: var(--text-primary); }
.cta {
  display: inline-block;
  background: var(--primary-main);
  color: #fff;
  font-weight: 600;
  font-size: 14px;
  letter-spacing: 0.02em;
  line-height: 1.75;
  padding: 10px 18px;
  border-radius: 10px;
  text-decoration: none;
  white-space: nowrap;
  transition: background-color 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.cta:hover { background: var(--primary-dark); }
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
.post-card h2, .post-card h3 { margin: 0 0 0.4rem; font-size: 1.25rem; }
.post-card h2 a, .post-card h3 a { color: var(--text-primary); text-decoration: none; }
.post-card h2 a:hover, .post-card h3 a:hover { color: var(--primary-main); }
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
  text-align: center;
  padding: 0 16px 16px;
  font-size: 14px;
  color: var(--text-secondary);
}
.site-footer a { color: inherit; text-decoration: none; }
.site-footer a:hover { text-decoration: underline; }
.empty-state { color: var(--text-secondary); }
table {
  width: 100%;
  border-collapse: collapse;
  margin: 0 0 1.1rem;
  font-size: 0.95rem;
}
caption { text-align: left; font-weight: 600; margin-bottom: 0.4rem; }
th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--divider); }
thead th { color: var(--text-secondary); font-weight: 600; }
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
.calc-card {
  background: var(--bg-paper);
  border: 1px solid var(--divider);
  border-radius: var(--radius);
  padding: 22px;
  margin-bottom: 2.5rem;
}
.calc-form { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 14px; }
.calc-field { display: flex; flex-direction: column; gap: 4px; flex: 1 1 140px; }
.calc-field label { font-size: 0.9rem; font-weight: 600; }
.calc-field input {
  font: inherit;
  color: inherit;
  background: var(--bg-default);
  border: 1px solid var(--divider);
  border-radius: 10px;
  padding: 9px 12px;
}
.calc-field input:focus { outline: 2px solid var(--primary-main); outline-offset: 1px; }
.calc-submit { border: 0; font-family: inherit; cursor: pointer; }
.calc-result { margin: 1.6rem 0 1.2rem; }
.calc-result p { margin: 0; }
.calc-result-label { color: var(--text-secondary); font-size: 0.92rem; }
.calc-result-value { font-family: "Lexend", sans-serif; font-weight: 800; font-size: 2.4rem; line-height: 1.2; }
.calc-warning { font-size: 0.92rem; margin-top: 0.4rem; }
.calc-note { font-size: 0.88rem; margin: 0; }
@media (max-width: 899px) {
  .header-inner { padding: 0 16px; }
}
@media (max-width: 600px) {
  body { font-size: 16px; }
  .header-actions { gap: 8px; }
  .nav-link { padding: 10px 4px; }
  .header-actions .cta { padding: 10px 14px; }
}
/* Sotto i 360px marchio, toggle e i due bottoni non stanno: resta il solo marchio, col nome per i lettori di schermo. */
@media (max-width: 359px) {
  .brand-name { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  h1 { font-size: 1.7rem; }
  h2 { font-size: 1.3rem; }
  /* Le tabelle larghe degli articoli scorrono da sole, senza allargare la pagina. */
  table:not(.pct-table) { display: block; overflow-x: auto; }
}
CSS;
}
