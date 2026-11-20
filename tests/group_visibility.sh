#!/usr/bin/env bash
#
# group_visibility.sh — visibilità nei gruppi, lato server: migrazione 43 (le quattro colonne gym_users.group_show_workouts,
# group_show_volume, group_show_streak, group_show_level: su un database con utenti, rilanciata), default degli account
# nuovi, group_visibility in user/read.php e user/update_settings.php (oggetto parziale, chiave sconosciuta o valore non
# booleano: 400 e nessuna modifica) e la classifica di groups/read.php con la reciprocità dato per dato (visibility
# effettiva di chi guarda, righe e campi null, modulo Livelli non attivo, membri sempre tutti). Le prove sono in
# tests/group_visibility_test.php.
#
#   tests/group_visibility.sh
#
# Avvia in Docker un MySQL usa e getta (tests/lib/throwaway_mysql.sh) e il backend con il server integrato di PHP
# (immagine web), e chiama gli endpoint veri.
#
# Richiede docker. Esce con 1 se un controllo fallisce, con 2 se la preparazione fallisce.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS="$ROOT/backend/database/schema_alter_migrations.sql"

source "$ROOT/tests/lib/throwaway_mysql.sh"
tm_setup gv

ok() { total=$((total + 1)); echo "  ✓ $1"; }
ko() { total=$((total + 1)); failed=$((failed + 1)); echo "  ✗ $1"; }
sql_value() { tm_sql -N -e "$1" 2>/dev/null; }
section_sql() { awk -v n=43 '/^-- [0-9]+\. /{ split($2, a, "."); cur = a[1] } cur == n' "$MIGRATIONS"; }
column_info() { sql_value "SELECT CONCAT(column_type, '/', is_nullable, '/', IFNULL(column_default, 'NULL')) FROM information_schema.columns WHERE table_schema = 'gym_progress_tracker' AND table_name = 'gym_users' AND column_name = '$1'"; }
shown_of() { sql_value "SELECT CONCAT(group_show_workouts, group_show_volume, group_show_streak, group_show_level) FROM gym_users WHERE username = '$1'"; }
COLUMNS="group_show_workouts group_show_volume group_show_streak group_show_level"

echo "Migrazione 43 su un database con utenti esistenti"
# Torna allo stato prima della sezione 43
tm_sql -e "ALTER TABLE gym_users DROP COLUMN group_show_workouts, DROP COLUMN group_show_volume, DROP COLUMN group_show_streak, DROP COLUMN group_show_level" >/dev/null 2>&1
[[ -z "$(column_info group_show_workouts)$(column_info group_show_level)" ]] && ok "(prova) le colonne non ci sono prima della sezione" || ko "(prova) le colonne non ci sono prima della sezione"
tm_sql -e "INSERT INTO gym_users (username, email, password, created_at) VALUES ('gvold1', 'gvold1@example.test', 'x', '2026-01-05 10:00:00')" \
    || tm_die "utente esistente non inserito"
[[ -n "$(section_sql)" ]] || tm_die "sezione 43 assente in $MIGRATIONS"
if section_sql | tm_sql >/dev/null 2>&1; then ok "la sezione 43 si applica"; else ko "la sezione 43 si applica"; fi
for c in $COLUMNS; do
    [[ "$(column_info $c)" == "tinyint(1)/NO/1" ]] && ok "$c: tinyint(1), NOT NULL, default 1" || ko "$c: tinyint(1), NOT NULL, default 1 ($(column_info $c))"
done
[[ "$(shown_of gvold1)" == 1111 ]] && ok "l'utente esistente ha le quattro colonne a 1" || ko "l'utente esistente ha le quattro colonne a 1 ($(shown_of gvold1))"
tm_sql -e "INSERT INTO gym_users (username, email, password) VALUES ('gvnew1', 'gvnew1@example.test', 'x')" || tm_die "utente nuovo non inserito"
[[ "$(shown_of gvnew1)" == 1111 ]] && ok "un account nuovo ha le quattro colonne a 1 (default)" || ko "un account nuovo ha le quattro colonne a 1 (default)"
tm_sql -e "UPDATE gym_users SET group_show_volume = 0, group_show_level = 0 WHERE username = 'gvold1'" || tm_die "scelta non scritta"
if section_sql | tm_sql >/dev/null 2>&1; then ok "la sezione 43 si rilancia senza errori"; else ko "la sezione 43 si rilancia senza errori"; fi
[[ "$(shown_of gvold1)" == 1010 ]] && ok "il rilancio non tocca una scelta già fatta" || ko "il rilancio non tocca una scelta già fatta ($(shown_of gvold1))"
tm_sql -e "DELETE FROM gym_users WHERE username IN ('gvold1', 'gvnew1')" || tm_die "utenti di prova non eliminati"

echo "Endpoint"
tm_php_phase group_visibility_test.php run

echo
echo "$total controlli, $failed falliti"
[[ "$failed" -eq 0 ]]
