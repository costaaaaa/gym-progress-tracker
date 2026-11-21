#!/usr/bin/env bash
#
# focus_tools.sh — strumenti della serie del Focus, lato server: migrazione 45 (le colonne
# gym_users.focus_tool_technique e focus_tool_suggested_weight: su un database con utenti, rilanciata), default degli
# account nuovi, focus_tools in user/read.php e user/update_settings.php (oggetto parziale, chiave sconosciuta o valore
# non booleano: 400 e nessuna modifica) e in user/export.php. Le prove sono in tests/focus_tools_test.php.
#
#   tests/focus_tools.sh
#
# Avvia in Docker un MySQL usa e getta (tests/lib/throwaway_mysql.sh) e il backend con il server integrato di PHP
# (immagine web), e chiama gli endpoint veri.
#
# Richiede docker. Esce con 1 se un controllo fallisce, con 2 se la preparazione fallisce.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS="$ROOT/backend/database/schema_alter_migrations.sql"

source "$ROOT/tests/lib/throwaway_mysql.sh"
tm_setup ft

ok() { total=$((total + 1)); echo "  ✓ $1"; }
ko() { total=$((total + 1)); failed=$((failed + 1)); echo "  ✗ $1"; }
sql_value() { tm_sql -N -e "$1" 2>/dev/null; }
section_sql() { awk -v n=45 '/^-- [0-9]+\. /{ split($2, a, "."); cur = a[1] } cur == n' "$MIGRATIONS"; }
column_info() { sql_value "SELECT CONCAT(column_type, '/', is_nullable, '/', IFNULL(column_default, 'NULL')) FROM information_schema.columns WHERE table_schema = 'gym_progress_tracker' AND table_name = 'gym_users' AND column_name = '$1'"; }
tools_of() { sql_value "SELECT CONCAT(focus_tool_technique, focus_tool_suggested_weight) FROM gym_users WHERE username = '$1'"; }
COLUMNS="focus_tool_technique focus_tool_suggested_weight"

echo "Migrazione 45 su un database con utenti esistenti"
# Torna allo stato prima della sezione 45
tm_sql -e "ALTER TABLE gym_users DROP COLUMN focus_tool_technique, DROP COLUMN focus_tool_suggested_weight" >/dev/null 2>&1
[[ -z "$(column_info focus_tool_technique)$(column_info focus_tool_suggested_weight)" ]] && ok "(prova) le colonne non ci sono prima della sezione" || ko "(prova) le colonne non ci sono prima della sezione"
tm_sql -e "INSERT INTO gym_users (username, email, password, created_at) VALUES ('ftold1', 'ftold1@example.test', 'x', '2026-01-05 10:00:00')" \
    || tm_die "utente esistente non inserito"
[[ -n "$(section_sql)" ]] || tm_die "sezione 45 assente in $MIGRATIONS"
if section_sql | tm_sql >/dev/null 2>&1; then ok "la sezione 45 si applica"; else ko "la sezione 45 si applica"; fi
for c in $COLUMNS; do
    [[ "$(column_info $c)" == "tinyint(1)/NO/1" ]] && ok "$c: tinyint(1), NOT NULL, default 1" || ko "$c: tinyint(1), NOT NULL, default 1 ($(column_info $c))"
done
[[ "$(sql_value "SELECT GROUP_CONCAT(column_name ORDER BY ordinal_position) FROM information_schema.columns WHERE table_schema = 'gym_progress_tracker' AND table_name = 'gym_users' AND ordinal_position > (SELECT ordinal_position FROM information_schema.columns WHERE table_schema = 'gym_progress_tracker' AND table_name = 'gym_users' AND column_name = 'module_offer_at') LIMIT 1" | cut -d, -f1-2)" == "focus_tool_technique,focus_tool_suggested_weight" ]] \
    && ok "le colonne stanno subito dopo module_offer_at" || ko "le colonne stanno subito dopo module_offer_at"
[[ "$(tools_of ftold1)" == 11 ]] && ok "l'utente esistente ha le due colonne a 1" || ko "l'utente esistente ha le due colonne a 1 ($(tools_of ftold1))"
tm_sql -e "INSERT INTO gym_users (username, email, password) VALUES ('ftnew1', 'ftnew1@example.test', 'x')" || tm_die "utente nuovo non inserito"
[[ "$(tools_of ftnew1)" == 11 ]] && ok "un account nuovo ha le due colonne a 1 (default)" || ko "un account nuovo ha le due colonne a 1 (default)"
tm_sql -e "UPDATE gym_users SET focus_tool_technique = 0 WHERE username = 'ftold1'" || tm_die "scelta non scritta"
if section_sql | tm_sql >/dev/null 2>&1; then ok "la sezione 45 si rilancia senza errori"; else ko "la sezione 45 si rilancia senza errori"; fi
[[ "$(tools_of ftold1)" == 01 ]] && ok "il rilancio non tocca una scelta già fatta" || ko "il rilancio non tocca una scelta già fatta ($(tools_of ftold1))"
tm_sql -e "DELETE FROM gym_users WHERE username IN ('ftold1', 'ftnew1')" || tm_die "utenti di prova non eliminati"

echo "Endpoint"
tm_php_phase focus_tools_test.php run

echo
echo "$total controlli, $failed falliti"
[[ "$failed" -eq 0 ]]
