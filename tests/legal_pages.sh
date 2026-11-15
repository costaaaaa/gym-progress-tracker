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

echo "privacy"
confronta privacy.html privacy.html "privacy"
echo "termini"
confronta termini.html terms.html "termini"

echo
echo "$checks controlli, $fails falliti"
[[ "$fails" -eq 0 ]]
