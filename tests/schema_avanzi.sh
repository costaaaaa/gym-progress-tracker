#!/usr/bin/env bash
#
# schema_avanzi.sh — controlla che il backend non legga né scriva più gym_workout_history.exercises
# (copia JSON dell'allenamento) né la tabella gym_progress, e che la sezione 37 di
# schema_alter_migrations.sql renda facoltativa la colonna.
#
#   tests/schema_avanzi.sh
#
# Avvia in Docker un MySQL usa e getta (tests/lib/throwaway_mysql.sh) e il backend con il server
# integrato di PHP (immagine web), e chiama gli endpoint veri con un token Bearer:
# record_workout, workout_history/read, update_date, delete, user/export. Due fasi sullo stesso
# database:
#   1. database come uno già in produzione (colonna ancora obbligatoria) più la sezione 37, eseguita
#      due volte: l'allenamento si salva con `exercises` NULL e tutti i percorsi funzionano;
#   2. colonna `exercises` e tabella `gym_progress` eliminate: gli stessi percorsi devono passare lo
#      stesso, prova che nessun codice le tocca più (serve al rilascio che le elimina davvero).
# Le prove sono in tests/schema_avanzi_test.php.
#
# Richiede docker. Esce con 1 se un controllo fallisce, con 2 se la preparazione fallisce.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS="$ROOT/backend/database/schema_alter_migrations.sql"
SECTION=37

source "$ROOT/tests/lib/throwaway_mysql.sh"
tm_setup av

# Come un database di produzione prima della sezione 37: colonna obbligatoria
tm_sql -e 'ALTER TABLE gym_workout_history MODIFY `exercises` text NOT NULL' || die "colonna non preparata"

echo
echo "Sezione $SECTION (due esecuzioni) e percorsi con la colonna facoltativa"
section_sql="$(awk -v n="$SECTION" '/^-- [0-9]+\. /{ split($2, a, "."); cur = a[1] } cur == n' "$MIGRATIONS")"
[[ -n "$section_sql" ]] || { echo "Sezione $SECTION assente in $MIGRATIONS" >&2; failed=$((failed + 1)); }
for pass in 1 2; do
    if ! out="$(printf '%s\n' "$section_sql" | tm_sql 2>&1)"; then
        echo "Errore nella sezione $SECTION (esecuzione $pass): $out" >&2
        failed=$((failed + 1))
    fi
done
total=$((total + 1))
tm_php_phase schema_avanzi_test.php with-column

echo
echo "Colonna exercises e tabella gym_progress eliminate"
tm_sql -e 'ALTER TABLE gym_workout_history DROP COLUMN `exercises`; DROP TABLE gym_progress' || die "eliminazione non riuscita"
tm_php_phase schema_avanzi_test.php dropped

echo
echo "$total controlli, $failed falliti"
[[ "$failed" -eq 0 ]]
