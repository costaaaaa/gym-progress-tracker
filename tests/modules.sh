#!/usr/bin/env bash
#
# modules.sh — moduli facoltativi dell'account (gym_users.module_body, module_recovery, module_levels, module_groups,
# module_ai e modules_chosen_at), lato server: migrazione 42 (su un database con utenti, rilanciata: gli account
# esistenti hanno tutto attivo e modules_chosen_at pieno, un rilancio non tocca scelte né account nuovi), default
# degli account nuovi, user/read.php (modules e modules_chosen), user/login.php (modules; mobile_login.php no),
# user/update_settings.php (oggetto parziale, chiave sconosciuta, valore non booleano, forma sbagliata: 400 e nessuna
# modifica) e la sezione del profilo di user/export.php. Nessun endpoint blocca nulla in base ai moduli: qui si
# controlla solo la preferenza. Le prove sono in tests/modules_test.php.
#
#   tests/modules.sh
#
# Avvia in Docker un MySQL usa e getta (tests/lib/throwaway_mysql.sh) e il backend con il server integrato di PHP
# (immagine web), e chiama gli endpoint veri.
#
# Richiede docker. Esce con 1 se un controllo fallisce, con 2 se la preparazione fallisce.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS="$ROOT/backend/database/schema_alter_migrations.sql"

source "$ROOT/tests/lib/throwaway_mysql.sh"
tm_setup mo

ok() { total=$((total + 1)); echo "  ✓ $1"; }
ko() { total=$((total + 1)); failed=$((failed + 1)); echo "  ✗ $1"; }
sql_value() { tm_sql -N -e "$1" 2>/dev/null; }
section_sql() { awk -v n=42 '/^-- [0-9]+\. /{ split($2, a, "."); cur = a[1] } cur == n' "$MIGRATIONS"; }
column_info() { sql_value "SELECT CONCAT(column_type, '/', is_nullable, '/', IFNULL(column_default, 'NULL')) FROM information_schema.columns WHERE table_schema = 'gym_progress_tracker' AND table_name = 'gym_users' AND column_name = '$1'"; }
modules_of() { sql_value "SELECT CONCAT(module_body, module_recovery, module_levels, module_groups, module_ai) FROM gym_users WHERE username = '$1'"; }
COLUMNS="module_body module_recovery module_levels module_groups module_ai modules_chosen_at"

echo "Migrazione 42 su un database con utenti esistenti"
# Torna allo stato prima della sezione 42
tm_sql -e "ALTER TABLE gym_users DROP COLUMN module_body, DROP COLUMN module_recovery, DROP COLUMN module_levels, DROP COLUMN module_groups, DROP COLUMN module_ai, DROP COLUMN modules_chosen_at" >/dev/null 2>&1
[[ -z "$(column_info module_body)$(column_info modules_chosen_at)" ]] && ok "(prova) le colonne non ci sono prima della sezione" || ko "(prova) le colonne non ci sono prima della sezione"
tm_sql -e "INSERT INTO gym_users (username, email, password, created_at) VALUES ('modold1', 'modold1@example.test', 'x', '2026-01-05 10:00:00')" \
    || tm_die "utente esistente non inserito"
[[ -n "$(section_sql)" ]] || tm_die "sezione 42 assente in $MIGRATIONS"
if section_sql | tm_sql >/dev/null 2>&1; then ok "la sezione 42 si applica"; else ko "la sezione 42 si applica"; fi
for c in module_body module_recovery module_levels module_groups module_ai; do
    [[ "$(column_info $c)" == "tinyint(1)/NO/1" ]] && ok "$c: tinyint(1), NOT NULL, default 1" || ko "$c: tinyint(1), NOT NULL, default 1 ($(column_info $c))"
done
[[ "$(column_info modules_chosen_at)" == "datetime/YES/NULL" ]] \
    && ok "modules_chosen_at: datetime, NULL, senza default" || ko "modules_chosen_at: datetime, NULL, senza default ($(column_info modules_chosen_at))"
[[ "$(modules_of modold1)" == 11111 ]] && ok "l'utente esistente ha tutti i moduli attivi" || ko "l'utente esistente ha tutti i moduli attivi ($(modules_of modold1))"
[[ "$(sql_value "SELECT modules_chosen_at IS NOT NULL AND modules_chosen_at > NOW() - INTERVAL 1 HOUR FROM gym_users WHERE username = 'modold1'")" == 1 ]] \
    && ok "l'utente esistente ha modules_chosen_at = adesso" || ko "l'utente esistente ha modules_chosen_at = adesso"
tm_sql -e "INSERT INTO gym_users (username, email, password) VALUES ('modnew1', 'modnew1@example.test', 'x')" || tm_die "utente nuovo non inserito"
[[ "$(modules_of modnew1)" == 11111 ]] && ok "un account nuovo ha tutto attivo (default)" || ko "un account nuovo ha tutto attivo (default)"
[[ "$(sql_value "SELECT modules_chosen_at IS NULL FROM gym_users WHERE username = 'modnew1'")" == 1 ]] \
    && ok "un account nuovo ha modules_chosen_at NULL" || ko "un account nuovo ha modules_chosen_at NULL"
BEFORE="$(sql_value "SELECT modules_chosen_at FROM gym_users WHERE username = 'modold1'")"
tm_sql -e "UPDATE gym_users SET module_groups = 0, module_ai = 0 WHERE username = 'modold1'" || tm_die "scelta non scritta"
if section_sql | tm_sql >/dev/null 2>&1; then ok "la sezione 42 si rilancia senza errori"; else ko "la sezione 42 si rilancia senza errori"; fi
[[ "$(modules_of modold1)" == 11100 ]] && ok "il rilancio non tocca una scelta già fatta" || ko "il rilancio non tocca una scelta già fatta ($(modules_of modold1))"
[[ "$(sql_value "SELECT modules_chosen_at FROM gym_users WHERE username = 'modold1'")" == "$BEFORE" ]] \
    && ok "il rilancio non cambia modules_chosen_at" || ko "il rilancio non cambia modules_chosen_at"
[[ "$(sql_value "SELECT modules_chosen_at IS NULL FROM gym_users WHERE username = 'modnew1'")" == 1 ]] \
    && ok "il rilancio non riempie modules_chosen_at di un account nuovo" || ko "il rilancio non riempie modules_chosen_at di un account nuovo"
[[ "$(column_info modules_chosen_at)" == "datetime/YES/NULL" ]] \
    && ok "dopo il rilancio modules_chosen_at è ancora senza default" || ko "dopo il rilancio modules_chosen_at è ancora senza default"
# Interrotta a metà: colonne aggiunte ma default temporaneo ancora presente
tm_sql -e "ALTER TABLE gym_users ALTER COLUMN modules_chosen_at SET DEFAULT (CURRENT_TIMESTAMP)" >/dev/null 2>&1
if section_sql | tm_sql >/dev/null 2>&1; then ok "la sezione 42 si rilancia dopo un'interruzione"; else ko "la sezione 42 si rilancia dopo un'interruzione"; fi
[[ "$(column_info modules_chosen_at)" == "datetime/YES/NULL" ]] \
    && ok "il rilancio toglie il default rimasto" || ko "il rilancio toglie il default rimasto ($(column_info modules_chosen_at))"
tm_sql -e "DELETE FROM gym_users WHERE username IN ('modold1', 'modnew1')" || tm_die "utenti di prova non eliminati"

echo "Endpoint"
tm_php_phase modules_test.php run

echo
echo "$total controlli, $failed falliti"
[[ "$failed" -eq 0 ]]
