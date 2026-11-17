#!/usr/bin/env bash
#
# legal_pages.sh — le pagine legali in italiano e in inglese hanno la stessa struttura:
# stessi titoli, stesse ancore (id), stessi elenchi e tabelle, e quelle inglesi puntano a pagine inglesi.
#
#   tests/legal_pages.sh
#
# Non serve rete né Docker: legge i file di public/. Esce con 1 se un controllo fallisce.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fails=0
checks=0

ok() { checks=$((checks + 1)); printf '  \033[32m✓\033[0m %s\n' "$1"; }
ko() { checks=$((checks + 1)); fails=$((fails + 1)); printf '  \033[31m✗\033[0m %s\n' "$1"; [[ -n "${2:-}" ]] && printf '      %s\n' "$2"; }

# conta TAG file → numero di occorrenze del tag di apertura
conta() { grep -o "<$1[ >]" "$2" | wc -l | tr -d ' '; }

# solo_numeri FILE → i numeri del testo visibile (dopo <body>, senza tag né attributi), in ordine, su una riga
solo_numeri() { sed -n '/<body>/,$p' "$1" | sed 's/<[^>]*>/ /g' | grep -oE '[0-9]+' | tr '\n' ' ' | sed 's/ *$//'; }

# confronta ITALIANO INGLESE etichetta
confronta() {
    local it="$ROOT/public/$1" en="$ROOT/public/en/$2" nome="$3"
    if [[ ! -f "$it" || ! -f "$en" ]]; then
        ko "$nome: file presenti" "serve $it e $en"
        return
    fi
    ok "$nome: file presenti"

    local ids_it ids_en
    ids_it="$(grep -o ' id="[^"]*"' "$it")"
    ids_en="$(grep -o ' id="[^"]*"' "$en")"
    [[ "$ids_it" == "$ids_en" ]] && ok "$nome: stesse ancore (id), nello stesso ordine" || ko "$nome: ancore diverse" "$(diff <(echo "$ids_it") <(echo "$ids_en") | head -5)"

    local anchors_it anchors_en
    anchors_it="$(grep -o 'href="#[^"]*"' "$it")"
    anchors_en="$(grep -o 'href="#[^"]*"' "$en")"
    [[ "$anchors_it" == "$anchors_en" ]] && ok "$nome: stessi link interni (#...)" || ko "$nome: link interni diversi"

    for tag in h1 h2 h3 ul ol li table tr td th p; do
        local a b
        a="$(conta "$tag" "$it")"
        b="$(conta "$tag" "$en")"
        [[ "$a" == "$b" ]] && ok "$nome: $a elementi <$tag>" || ko "$nome: <$tag> diversi" "it=$a en=$b"
    done

    # Numerazione dei titoli h2 (1., 2., ...): stessa sequenza.
    local num_it num_en
    num_it="$(grep -o '<h2[^>]*>[0-9]*\.' "$it" | grep -o '[0-9]*\.$' | tr '\n' ' ')"
    num_en="$(grep -o '<h2[^>]*>[0-9]*\.' "$en" | grep -o '[0-9]*\.$' | tr '\n' ' ')"
    [[ "$num_it" == "$num_en" ]] && ok "$nome: stessa numerazione dei titoli" || ko "$nome: numerazione diversa" "it=$num_it en=$num_en"

    # Stesse date: i numeri di 4 cifre (anni, versioni) compaiono uguali nei due testi.
    local y_it y_en
    y_it="$(grep -o '20[0-9][0-9]-[0-9][0-9]' "$it" | tr '\n' ' ')"
    y_en="$(grep -o '20[0-9][0-9]-[0-9][0-9]' "$en" | tr '\n' ' ')"
    [[ "$y_it" == "$y_en" ]] && ok "$nome: stesse versioni (AAAA-MM)" || ko "$nome: versioni diverse"

    # Stessi numeri nel testo visibile (giorni, anni, durate, soglie d'età, articoli), nello stesso ordine.
    # Unica differenza voluta: l'inglese spiega il Codice privacy con "Legislative Decree 196/2003", numeri
    # assenti nell'italiano; si tolgono prima del confronto.
    local n_it n_en
    n_it="$(solo_numeri "$it")"
    n_en="$(solo_numeri "$en" | sed 's/ 196 2003//')"
    [[ "$n_it" == "$n_en" ]] && ok "$nome: stessa sequenza di numeri nel testo" || ko "$nome: numeri diversi nel testo" "$(diff <(echo "$n_it" | tr ' ' '\n') <(echo "$n_en" | tr ' ' '\n') | head -6)"

    # Pagina inglese: lingua, canonical, nessun link alle pagine legali italiane, nessuna pagina italiana.
    grep -q '<html lang="en">' "$en" && ok "$nome: <html lang=\"en\">" || ko "$nome: manca lang=en"
    grep -q "<link rel=\"canonical\" href=\"https://liftindex.app/en/$2\">" "$en" && ok "$nome: canonical inglese" || ko "$nome: canonical sbagliato"
    # (il rimando alla versione italiana, con hreflang="it", è voluto)
    if grep -o '<a href="[^"]*"[^>]*>' "$en" | grep -v 'hreflang="it"' | grep -E 'href="(https://liftindex.app)?/(privacy|termini)\.html' >/dev/null; then
        ko "$nome: la versione inglese linka una pagina italiana"
    else
        ok "$nome: nessun link alle pagine legali italiane"
    fi
    # Alternate: ogni pagina elenca it, en e x-default (x-default = italiana), come <link rel="alternate">
    # nell'<head> con l'indirizzo atteso (i link del menu non contano).
    local base_it="https://liftindex.app/$1" base_en="https://liftindex.app/en/$2" alt_ok=1
    for f in "$it" "$en"; do
        for spec in "it|$base_it" "en|$base_en" "x-default|$base_it"; do
            if ! grep -q "<link rel=\"alternate\" hreflang=\"${spec%%|*}\" href=\"${spec#*|}\">" "$f"; then
                ko "$nome: manca <link rel=\"alternate\" hreflang=\"${spec%%|*}\" href=\"${spec#*|}\"> in $(basename "$f")"
                alt_ok=0
            fi
        done
    done
    [[ "$alt_ok" -eq 1 ]] && ok "$nome: alternate it, en e x-default in entrambe le pagine"
}

# tema PAGINA: stessa regola dell'app e del blog (themeMode, altrimenti il sistema), stesso foglio di stile
tema() {
    local f="$ROOT/public/$1"
    if [[ ! -f "$f" ]]; then ko "tema $1: file presente"; return; fi
    grep -q '<script src="/tema.js"></script>' "$f" && ok "tema $1: script esterno /tema.js" || ko "tema $1: manca <script src=\"/tema.js\">"
    grep -q '<link rel="stylesheet" href="/pagine.css">' "$f" && ok "tema $1: foglio /pagine.css" || ko "tema $1: manca /pagine.css"
    # script prima del foglio di stile, cosi' il tema c'e' prima del disegno
    [[ "$(grep -n 'tema.js' "$f" | head -1 | cut -d: -f1)" -lt "$(grep -n 'pagine.css' "$f" | head -1 | cut -d: -f1)" ]] 2>/dev/null && ok "tema $1: lo script precede il foglio" || ko "tema $1: ordine script/foglio"
    grep -q 'prefers-color-scheme' "$f" && ko "tema $1: ha ancora una regola prefers-color-scheme" || ok "tema $1: nessun prefers-color-scheme"
    grep -q '<script>' "$f" && ko "tema $1: script inline (la CSP non li ammette)" || ok "tema $1: nessuno script inline"
}

echo "tema"
for p in privacy.html termini.html en/privacy.html en/terms.html 404.html; do tema "$p"; done
for f in tema.js pagine.css; do
    [[ -f "$ROOT/public/$f" ]] && ok "public/$f presente" || ko "public/$f mancante"
done
# senza JS il tema segue il sistema: la regola scura vale solo se tema.js non ha messo data-theme
css="$ROOT/public/pagine.css"
grep -q 'prefers-color-scheme' "$css" 2>/dev/null && ok "pagine.css: ha il ripiego per il sistema scuro" || ko "pagine.css: manca il ripiego prefers-color-scheme"
if grep -o 'prefers-color-scheme[^{]*{[^{]*{' "$css" | grep -q ':root:not(\[data-theme\])'; then ok "pagine.css: il ripiego vale solo senza data-theme"; else ko "pagine.css: il ripiego non è limitato a :root:not([data-theme])"; fi
grep -q "html\[data-theme=\"dark\"\]" "$ROOT/public/pagine.css" 2>/dev/null && ok "pagine.css: scuro da data-theme" || ko "pagine.css: manca html[data-theme=\"dark\"]"

echo "privacy"
confronta privacy.html privacy.html "privacy"
echo "termini"
confronta termini.html terms.html "termini"

# Piani Gratis, Plus e Pro nei testi legali (17 novembre 2026): versione dei termini invariata, rimando
# alla pagina dei piani, niente «gratuito» generico né promesse sul futuro, informativa con piano e scadenza.
echo "piani"
cerca() { grep -q -- "$2" "$ROOT/public/$1" && ok "$3" || ko "$3" "manca «$2» in $1"; }
assenza() { grep -qi -- "$2" "$ROOT/public/$1" && ko "$3" "trovato «$2» in $1" || ok "$3"; }
cerca termini.html 'Versione 2026-11 · aggiornati il 17 novembre 2026' "termini IT: versione 2026-11, data 17 novembre 2026"
cerca en/terms.html 'Version 2026-11 · updated on 17 November 2026' "termini EN: versione 2026-11, data 17 novembre 2026"
cerca privacy.html 'Versione 2026-11 · aggiornata il 17 novembre 2026' "privacy IT: versione 2026-11, data 17 novembre 2026"
cerca en/privacy.html 'Version 2026-11 · updated on 17 November 2026' "privacy EN: versione 2026-11, data 17 novembre 2026"
cerca privacy.html '<li>2026-11, aggiornata il 17 novembre 2026:' "privacy IT: voce nella cronologia"
cerca en/privacy.html '<li>2026-11, updated on 17 November 2026:' "privacy EN: voce nella cronologia"
cerca termini.html 'href="/piani"' "termini IT: link alla pagina dei piani"
cerca en/terms.html 'href="/en/plans"' "termini EN: link alla pagina dei piani"
assenza termini.html 'servizio è gratuito' "termini IT: niente «il servizio è gratuito»"
assenza en/terms.html 'the service is free' "termini EN: niente «the service is free»"
assenza termini.html 'per sempre' "termini IT: nessuna promessa «per sempre»"
assenza en/terms.html 'forever' "termini EN: nessuna promessa «forever»"
assenza termini.html 'watch' "termini IT: nessun riferimento all'Apple Watch"
assenza privacy.html 'watch' "privacy IT: nessun riferimento all'Apple Watch"
cerca privacy.html '<tr><td>Piano dell.account</td>' "privacy IT: il piano dell'account nella tabella dei dati"
cerca en/privacy.html '<tr><td>Account type</td>' "privacy EN: il piano dell'account nella tabella dei dati"
grep -q "'terms' => '2026-11'" "$ROOT/backend/models/Consent.php" && ok "versione del consenso ai termini invariata (2026-11)" || ko "versione del consenso ai termini cambiata"
echo

echo "$checks controlli, $fails falliti"
[[ "$fails" -eq 0 ]]
