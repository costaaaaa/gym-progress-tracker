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
        // Lo slug del file e' la fonte di verita' per l'URL: il campo "slug" del
        // front matter e' solo documentazione, non deve poter divergere.
        $meta['slug'] = basename($file, '.md');

        if (!isset($meta['title']) || $meta['title'] === '') {
            continue; // file incompleto: non finisce nel listing
        }

        $articles[] = $meta;
    }

    usort($articles, 'blog_compare_by_date_desc');

    return $articles;
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
