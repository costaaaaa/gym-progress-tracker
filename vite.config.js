import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const SITE = 'https://liftindex.app';

// Le SPA non hanno HTML per lingua: dopo la build scrive build/en/index.html, copia di
// index.html con lang, title e meta in inglese (presi da src/i18n), per chi non esegue JS.
// La build fallisce se index.html non contiene più i testi italiani di src/i18n/it.json.
const englishLanding = () => ({
  name: 'liftindex-english-landing',
  apply: 'build',
  closeBundle() {
    const it = JSON.parse(readFileSync('src/i18n/it.json', 'utf8'));
    const en = JSON.parse(readFileSync('src/i18n/en.json', 'utf8'));
    let html = readFileSync('build/index.html', 'utf8');
    const swap = (from, to) => {
      if (!html.includes(from)) throw new Error(`index.html: non trovo "${from}"`);
      html = html.split(from).join(to);
    };
    swap('<html lang="it">', '<html lang="en">');
    swap('<meta property="og:locale" content="it_IT" />', '<meta property="og:locale" content="en_US" />');
    swap(`<link rel="canonical" href="${SITE}/" />`, `<link rel="canonical" href="${SITE}/en/" />`);
    swap(`<meta property="og:url" content="${SITE}/" />`, `<meta property="og:url" content="${SITE}/en/" />`);
    swap(`"url": "${SITE}/"`, `"url": "${SITE}/en/"`);
    swap('"inLanguage": "it"', '"inLanguage": "en"');
    for (const key of ['meta.title', 'meta.description', 'meta.og_description', 'meta.twitter_description', 'meta.jsonld_description']) {
      swap(it[key], en[key]);
    }
    mkdirSync('build/en', { recursive: true });
    writeFileSync('build/en/index.html', html);

    const alternates = ['it', 'en', 'x-default']
      .map((lang) => `    <xhtml:link rel="alternate" hreflang="${lang}" href="${SITE}${lang === 'en' ? '/en/' : '/'}" />`)
      .join('\n');
    const urls = ['/', '/en/']
      .map((path) => `  <url>\n    <loc>${SITE}${path}</loc>\n${alternates}\n  </url>`)
      .join('\n');
    writeFileSync(
      'build/sitemap.xml',
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}\n</urlset>\n`
    );
  },
});

export default defineConfig({
  plugins: [react(), englishLanding()],
  base: '/',
  server: {
    port: 3000,
    open: true,
  },
  build: {
    outDir: 'build',
    // In produzione i console.* (log di debug, ma anche console.error) non finiscono nel bundle
    rolldownOptions: {
      output: { minify: { compress: { dropConsole: true } } },
    },
    chunkSizeWarningLimit: 1000,
  },
});
