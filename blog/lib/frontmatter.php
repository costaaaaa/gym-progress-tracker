<?php
/**
 * Lettura dei file Markdown del blog: front matter + corpo.
 *
 * Il front matter e' un blocco "---" in testa al file con righe "chiave: valore"
 * (niente liste, niente valori annidati) — abbastanza per i metadati SEO di un
 * articolo, senza tirarsi dentro una libreria YAML. Coerente con la convenzione
 * di backend/: PHP puro, nessun package manager.
 *
 * Target PHP 7.4+ (stessa versione dichiarata nel README per il backend).
 */

/**
 * Trasforma il blocco di front matter in un array associativo.
 *
 * @param string $block Testo tra i due delimitatori "---".
 * @return array<string,string>
 */
function blog_parse_front_matter($block)
{
    $meta = array();

    foreach (explode("\n", $block) as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#') {
            continue;
        }

        $pos = strpos($line, ':');
        if ($pos === false) {
            continue;
        }

        $key = trim(substr($line, 0, $pos));
        $value = trim(substr($line, $pos + 1));

        // Apici circostanti opzionali: servono solo a proteggere i due punti
        // dentro il titolo (es. "Come Tracciare i Progressi: la Guida").
        $len = strlen($value);
        if ($len >= 2) {
            $first = $value[0];
            $last = $value[$len - 1];
            if (($first === '"' && $last === '"') || ($first === "'" && $last === "'")) {
                $value = substr($value, 1, -1);
            }
        }

        if ($key !== '') {
            $meta[$key] = $value;
        }
    }

    return $meta;
}

/**
 * Legge un file Markdown restituendo metadati e corpo separati.
 *
 * @param string $path Percorso assoluto del file .md.
 * @return array{0: array<string,string>, 1: string}|null null se il file non
 *         esiste o non e' leggibile (il chiamante risponde 404).
 */
function blog_parse_markdown_file($path)
{
    if (!is_file($path) || !is_readable($path)) {
        return null;
    }

    $raw = file_get_contents($path);
    if ($raw === false) {
        return null;
    }

    // I .md possono arrivare con fine riga CRLF da editor diversi.
    $raw = str_replace(array("\r\n", "\r"), "\n", $raw);

    $meta = array();
    $body = $raw;

    if (preg_match('/^---\n(.*?)\n---[ \t]*\n?(.*)$/s', $raw, $m)) {
        $meta = blog_parse_front_matter($m[1]);
        $body = $m[2];
    }

    return array($meta, $body);
}

/**
 * Elenca gli articoli disponibili leggendo solo il front matter (il corpo non
 * serve alla pagina di listing, non va parsato).
 *
 * @param string $dir Cartella dei contenuti.
 * @return array<int,array<string,string>> Ordinati per data decrescente.
 */
function blog_list_articles($dir)
{
    $articles = array();
    $today = blog_today();

    $files = glob($dir . '/*.md');
    if ($files === false) {
        return $articles;
    }

    foreach ($files as $file) {
        $parsed = blog_parse_markdown_file($file);
        if ($parsed === null) {
            continue;
        }

        $meta = $parsed[0];
        // Il nome del file e' la fonte di verita' per l'URL: il campo "slug" del
        // front matter e' solo documentazione, non deve poter divergere.
        $meta['slug'] = blog_slug_from_file($file);

        // Due file con lo stesso slug (es. 001-x.md e 002-x.md): nessuno dei due esce
        if (blog_find_article_file($dir, $meta['slug']) !== $file) {
            continue;
        }

        if (!isset($meta['title']) || $meta['title'] === '') {
            continue; // file incompleto: non finisce nel listing
        }

        if (!blog_is_published($meta, $today)) {
            continue;
        }

        $articles[] = $meta;
    }

    usort($articles, 'blog_compare_by_date_desc');

    return $articles;
}

/**
 * Slug dell'URL dal nome del file. Il numero d'ordine iniziale ("001-") serve solo a tenere
 * i file in ordine nella cartella e non entra nell'URL: 001-volume-allenamento.md e
 * volume-allenamento.md vanno entrambi su /blog/volume-allenamento.
 *
 * @param string $file Percorso del file .md.
 * @return string
 */
function blog_slug_from_file($file)
{
    return preg_replace('/^\d{3}-/', '', basename($file, '.md'));
}

/**
 * File dell'articolo con quello slug, con o senza numero d'ordine.
 * Null se non esiste o se piu' file danno lo stesso slug: e' un errore nei contenuti,
 * e servirne uno a caso farebbe cambiare pagina a un URL gia' indicizzato.
 *
 * @param string $dir  Cartella dei contenuti.
 * @param string $slug Gia' validato: solo [a-z0-9-], nessun carattere speciale per glob().
 * @return string|null
 */
function blog_find_article_file($dir, $slug)
{
    $candidates = glob($dir . '/[0-9][0-9][0-9]-' . $slug . '.md');
    if ($candidates === false) {
        $candidates = array();
    }
    if (is_file($dir . '/' . $slug . '.md')) {
        $candidates[] = $dir . '/' . $slug . '.md';
    }

    // /blog/001-x non deve servire 001-x.md: il suo URL e' /blog/x
    $found = array();
    foreach ($candidates as $file) {
        if (blog_slug_from_file($file) === $slug) {
            $found[] = $file;
        }
    }

    if (count($found) > 1) {
        error_log('blog: piu\' file per lo slug ' . $slug . ': ' . implode(', ', $found));
    }

    return count($found) === 1 ? $found[0] : null;
}

/**
 * Data di oggi (YYYY-MM-DD) in ora italiana: e' il giorno che conta per la data degli articoli.
 */
function blog_today()
{
    $now = new DateTime('now', new DateTimeZone('Europe/Rome'));

    return $now->format('Y-m-d');
}

/**
 * Un articolo con data futura resta nascosto (listing, pagina, sitemap) fino a quel giorno:
 * cosi' piu' articoli entrano nell'immagine con una sola build e ognuno esce alla sua data.
 * Una data assente o non nel formato YYYY-MM-DD non nasconde l'articolo.
 *
 * @param array<string,string> $meta
 * @param string $today Risultato di blog_today().
 * @return bool
 */
function blog_is_published($meta, $today)
{
    $date = isset($meta['date']) ? trim($meta['date']) : '';
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
        return true;
    }

    return strcmp($date, $today) <= 0;
}

/**
 * Comparatore per usort(): data di pubblicazione decrescente.
 */
function blog_compare_by_date_desc($a, $b)
{
    $da = isset($a['date']) ? $a['date'] : '';
    $db = isset($b['date']) ? $b['date'] : '';

    return strcmp($db, $da);
}

/**
 * Formatta una data ISO (YYYY-MM-DD) in italiano esteso, es. "6 settembre 2026".
 *
 * Mesi scritti a mano invece di setlocale()+strftime(): strftime e' deprecata
 * da PHP 8.1 e i locale italiani non sono garantiti su hosting condiviso.
 *
 * @param string $iso
 * @return string Stringa vuota se la data non e' nel formato atteso.
 */
function blog_format_date($iso)
{
    if (!preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', trim($iso), $m)) {
        return '';
    }

    $mesi = array(
        1 => 'gennaio', 2 => 'febbraio', 3 => 'marzo', 4 => 'aprile',
        5 => 'maggio', 6 => 'giugno', 7 => 'luglio', 8 => 'agosto',
        9 => 'settembre', 10 => 'ottobre', 11 => 'novembre', 12 => 'dicembre',
    );

    $mese = (int) $m[2];
    if (!isset($mesi[$mese])) {
        return '';
    }

    return ((int) $m[3]) . ' ' . $mesi[$mese] . ' ' . $m[1];
}
