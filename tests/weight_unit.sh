#!/usr/bin/env bash
#
# weight_unit.sh — unità di peso dell'account (gym_users.weight_unit, 'kg' o 'lb'), lato server: migrazione 41 (su un
# database con utenti, rilanciata), default kg, user/read.php, user/update_settings.php (valori validi e non validi),
# user/register.php con e senza il campo (non valido: 400 e nessun account), e la proposta dell'unità per il modulo di
# registrazione da Accept-Language (user/suggested_unit.php: lb solo se il primo tag ha regione US). I dati restano in kg:
# qui si controlla solo la preferenza. Le prove sono in tests/weight_unit_test.php.
#
#   tests/weight_unit.sh
#
# Avvia in Docker un MySQL usa e getta (tests/lib/throwaway_mysql.sh) e il backend con il server integrato di PHP
# (immagine web), e chiama gli endpoint veri.
#
# Richiede docker. Esce con 1 se un controllo fallisce, con 2 se la preparazione fallisce.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS="$ROOT/backend/database/schema_alter_migrations.sql"

source "$ROOT/tests/lib/throwaway_mysql.sh"
tm_setup wu

ok() { total=$((total + 1)); echo "  ✓ $1"; }
ko() { total=$((total + 1)); failed=$((failed + 1)); echo "  ✗ $1"; }
sql_value() { tm_sql -N -e "$1" 2>/dev/null; }
section_sql() { awk -v n=41 '/^-- [0-9]+\. /{ split($2, a, "."); cur = a[1] } cur == n' "$MIGRATIONS"; }
column_info() { sql_value "SELECT CONCAT(column_type, '/', is_nullable, '/', IFNULL(column_default, 'NULL')) FROM information_schema.columns WHERE table_schema = 'gym_progress_tracker' AND table_name = 'gym_users' AND column_name = 'weight_unit'"; }

echo "Migrazione 41 su un database con utenti esistenti"
# Torna allo stato prima della sezione 41
tm_sql -e "ALTER TABLE gym_users DROP COLUMN weight_unit" >/dev/null 2>&1
[[ -z "$(column_info)" ]] && ok "(prova) la colonna non c'è prima della sezione" || ko "(prova) la colonna non c'è prima della sezione"
tm_sql -e "INSERT INTO gym_users (username, email, password, created_at) VALUES ('migold1', 'migold1@example.test', 'x', '2026-01-05 10:00:00')" \
    || tm_die "utente esistente non inserito"
[[ -n "$(section_sql)" ]] || tm_die "sezione 41 assente in $MIGRATIONS"
if section_sql | tm_sql >/dev/null 2>&1; then ok "la sezione 41 si applica"; else ko "la sezione 41 si applica"; fi
[[ "$(column_info)" == "enum('kg','lb')/NO/kg" ]] && ok "colonna enum('kg','lb'), NOT NULL, default kg" || ko "colonna enum('kg','lb'), NOT NULL, default kg ($(column_info))"
[[ "$(sql_value "SELECT weight_unit FROM gym_users WHERE username = 'migold1'")" == kg ]] \
    && ok "l'utente esistente ha kg" || ko "l'utente esistente ha kg"
if section_sql | tm_sql >/dev/null 2>&1; then ok "la sezione 41 si rilancia senza errori"; else ko "la sezione 41 si rilancia senza errori"; fi
tm_sql -e "UPDATE gym_users SET weight_unit = 'lb' WHERE username = 'migold1'" || tm_die "unità non scritta"
section_sql | tm_sql >/dev/null 2>&1
[[ "$(sql_value "SELECT weight_unit FROM gym_users WHERE username = 'migold1'")" == lb ]] \
    && ok "il rilancio non tocca una scelta già fatta" || ko "il rilancio non tocca una scelta già fatta"
if tm_sql -e "UPDATE gym_users SET weight_unit = 'st' WHERE username = 'migold1'" >/dev/null 2>&1; then ko "unità fuori elenco nel database"; else ok "unità fuori elenco: rifiutata dal database"; fi
tm_sql -e "DELETE FROM gym_users WHERE username = 'migold1'" || tm_die "utente di prova non eliminato"

echo "Endpoint"
tm_php_phase weight_unit_test.php run

echo
echo "$total controlli, $failed falliti"
[[ "$failed" -eq 0 ]]
