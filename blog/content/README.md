# Contenuti del blog

Gli articoli vivono qui come file Markdown, **uno per articolo**, e il nome del
file è lo slug dell'URL: `come-tracciare-progressi-palestra.md` viene servito su
`/blog/come-tracciare-progressi-palestra`.

## I file .md non sono nel repo

Questa cartella è in `.gitignore` (eccetto questo README): il testo degli
articoli è contenuto editoriale di brand e resta fuori dal repo pubblico, anche
per evitare che GitHub ne indicizzi una copia in concorrenza con la pagina
pubblicata.

**Conseguenze pratiche:**
- I `.md` vanno caricati sul server **a mano**, insieme al resto di `blog/`.
- Vanno tenuti in **backup fuori dal repo** — se perdi la copia locale non c'è
  storia git da cui recuperarli.
- Un clone fresco del repo trova questa cartella vuota: il blog risponde
  regolarmente ma mostra "Nessun articolo pubblicato al momento".

## Formato

Front matter delimitato da `---`, righe `chiave: valore` (niente YAML annidato):

```markdown
---
title: "Titolo dell'articolo"
description: "Meta description, max 160 caratteri."
date: 2026-09-06
---

Corpo dell'articolo in Markdown.

## Un sottotitolo

Testo.
```

| Campo | Obbligatorio | Note |
|---|---|---|
| `title` | sì | Senza il campo l'articolo non compare nel listing. Tenerlo ≤60 caratteri: oltre, viene troncato in SERP e il template omette il suffisso del brand. |
| `description` | sì | Meta description, ≤160 caratteri. |
| `date` | sì | `YYYY-MM-DD`. Ordina il listing e popola `datePublished` nel JSON-LD. |
| `author` | no | Se presente, aggiunge `author` (Person) allo schema `BlogPosting`. |

Il campo `slug` non serve: **il nome del file è la fonte di verità** per l'URL.

## Prima di pubblicare

- Il testo di riferimento per ogni articolo sta in `docs/seo/content-briefs/`.
- Niente anno nel titolo (`(2026)`): la data sta nel campo `date`, così
  l'articolo non porta con sé un impegno implicito di aggiornamento annuale.
- L'articolo pillar va pubblicato **prima** dei satelliti, e ogni articolo deve
  linkare gli altri del cluster — è ciò che fa funzionare il topic cluster.

## Test in locale

```sh
php -S localhost:8080 -t blog
# poi: http://localhost:8080/index.php
#      http://localhost:8080/article.php?slug=<nome-del-file-senza-estensione>
```

Il server built-in di PHP ignora gli `.htaccess`, quindi in locale gli URL
puliti `/blog/<slug>` non funzionano: si testano i due script direttamente.
