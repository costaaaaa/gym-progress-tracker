#!/usr/bin/env bash
#
# delete_cascade.sh — controlla che cancellare una scheda (WorkoutPlan::delete) o un account
# (User::deleteAccount) non lasci righe orfane, e che la sezione 36 di schema_alter_migrations.sql
# ripulisca quelle già lasciate.
#
#   tests/delete_cascade.sh
#
# Con MySQL 9.7 (innodb_native_foreign_keys=OFF) la cascata attraverso quattro o più tabelle
# (utente > schede > giorni > esercizi > serie pianificate) non arriva in fondo. Il test avvia in Docker
# un MySQL usa e getta (senza porte pubblicate, dati in tmpfs) con lo schema del repo, esegue
# tests/delete_cascade_test.php con il PHP dell'immagine web e conta, per ogni chiave esterna di
# information_schema, le righe figlie senza genitore. Container e rete sono rimossi all'uscita.
# PHP_IMAGE sceglie l'immagine web (default: la liftindex-web più recente già scaricata), MYSQL_IMAGE
# quella di MySQL (default mysql:9.7).
#
# Richiede docker. Esce con 1 se un controllo fallisce, con 2 se la preparazione fallisce.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS="$ROOT/backend/database/schema_alter_migrations.sql"
SECTION=36

# Preparazione comune (MySQL usa e getta, PHP dell'immagine web): tests/lib/throwaway_mysql.sh
source "$ROOT/tests/lib/throwaway_mysql.sh"
tm_setup dc

run_phase() { tm_php_phase delete_cascade_test.php "$1"; } # fase

run_phase cases

echo
echo "Sezione $SECTION su orfani già presenti"
run_phase seed-orphans
section_sql="$(awk -v n="$SECTION" '/^-- [0-9]+\. /{ split($2, a, "."); cur = a[1] } cur == n' "$MIGRATIONS")"
[[ -n "$section_sql" ]] || { echo "Sezione $SECTION assente in $MIGRATIONS" >&2; failed=$((failed + 1)); }
for pass in 1 2; do
    if ! out="$(printf '%s\n' "$section_sql" | tm_sql 2>&1)"; then
        echo "Errore nella sezione $SECTION (esecuzione $pass): $out" >&2
        failed=$((failed + 1))
    fi
done
total=$((total + 1))
run_phase check-orphans

echo
echo "$total controlli, $failed falliti"
[[ "$failed" -eq 0 ]]
