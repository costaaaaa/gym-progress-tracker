#!/usr/bin/env bash
#
# home.sh — il server della Home, lato server: migrazione 44 (su un database con utenti e allenamenti, rilanciata),
# il giorno di scheda salvato con l'allenamento (workout/record_workout.php) e letto da workout_history/read.php
# (day_id e day_name), i quattro campi in più di workout_stats/dashboard.php (today, trained_today, week_days nei
# fusi UTC, Europe/Rome, America/Los_Angeles e Asia/Tokyo, next_day), le preferenze della Home in user/read.php e
# user/update_settings.php (home_layout, module_offer, module_offer_answer) e l'export dei dati. Le prove sono in
# tests/home_test.php; le regole pure sono in tests/home_rules.sh.
#
#   tests/home.sh
#
# Avvia in Docker un MySQL usa e getta (tests/lib/throwaway_mysql.sh) e il backend con il server integrato di PHP
# (immagine web), e chiama gli endpoint veri.
#
# Richiede docker. Esce con 1 se un controllo fallisce, con 2 se la preparazione fallisce.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS="$ROOT/backend/database/schema_alter_migrations.sql"

source "$ROOT/tests/lib/throwaway_mysql.sh"
tm_setup ho

ok() { total=$((total + 1)); echo "  ✓ $1"; }
ko() { total=$((total + 1)); failed=$((failed + 1)); echo "  ✗ $1"; }
sql_value() { tm_sql -N -e "$1" 2>/dev/null; }
section_sql() { awk -v n=44 '/^-- [0-9]+\. /{ split($2, a, "."); cur = a[1] } cur == n' "$MIGRATIONS"; }
column_info() { sql_value "SELECT CONCAT(column_type, '/', is_nullable, '/', IFNULL(column_default, 'NULL')) FROM information_schema.columns WHERE table_schema = 'gym_progress_tracker' AND table_name = '$1' AND column_name = '$2'"; }
foreign_keys() { sql_value "SELECT COUNT(*) FROM information_schema.key_column_usage WHERE table_schema = 'gym_progress_tracker' AND table_name = 'gym_workout_history' AND column_name = 'day_id' AND referenced_table_name IS NOT NULL"; }

echo "Migrazione 44 su un database con utenti e allenamenti"
# Torna allo stato prima della sezione 44
tm_sql -e "ALTER TABLE gym_workout_history DROP COLUMN day_id; ALTER TABLE gym_users DROP COLUMN home_layout, DROP COLUMN module_offers_declined, DROP COLUMN module_offer_at" >/dev/null 2>&1
[[ -z "$(column_info gym_workout_history day_id)$(column_info gym_users home_layout)$(column_info gym_users module_offers_declined)$(column_info gym_users module_offer_at)" ]] \
    && ok "(prova) le colonne non ci sono prima della sezione" || ko "(prova) le colonne non ci sono prima della sezione"
tm_sql -e "INSERT INTO gym_users (username, email, password, created_at) VALUES ('homold1', 'homold1@example.test', 'x', '2026-01-05 10:00:00');
           INSERT INTO gym_workout_history (user_id, date) SELECT id, '2026-01-06 10:00:00' FROM gym_users WHERE username = 'homold1'" \
    || tm_die "utente e allenamento esistenti non inseriti"
[[ -n "$(section_sql)" ]] || tm_die "sezione 44 assente in $MIGRATIONS"
if section_sql | tm_sql >/dev/null 2>&1; then ok "la sezione 44 si applica"; else ko "la sezione 44 si applica"; fi
[[ "$(column_info gym_workout_history day_id)" == "int/YES/NULL" ]] && ok "day_id: int, NULL, senza default" || ko "day_id: int, NULL, senza default ($(column_info gym_workout_history day_id))"
[[ "$(foreign_keys)" == 0 ]] && ok "day_id non ha chiave esterna" || ko "day_id non ha chiave esterna"
[[ "$(column_info gym_users home_layout)" == "json/YES/NULL" ]] && ok "home_layout: json, NULL" || ko "home_layout: json, NULL ($(column_info gym_users home_layout))"
[[ "$(column_info gym_users module_offers_declined)" == "json/YES/NULL" ]] && ok "module_offers_declined: json, NULL" || ko "module_offers_declined: json, NULL ($(column_info gym_users module_offers_declined))"
[[ "$(column_info gym_users module_offer_at)" == "datetime/YES/NULL" ]] && ok "module_offer_at: datetime, NULL" || ko "module_offer_at: datetime, NULL ($(column_info gym_users module_offer_at))"
[[ "$(sql_value "SELECT day_id IS NULL FROM gym_workout_history WHERE user_id = (SELECT id FROM gym_users WHERE username = 'homold1')")" == 1 ]] \
    && ok "l'allenamento esistente ha day_id NULL" || ko "l'allenamento esistente ha day_id NULL"
[[ "$(sql_value "SELECT home_layout IS NULL AND module_offers_declined IS NULL AND module_offer_at IS NULL FROM gym_users WHERE username = 'homold1'")" == 1 ]] \
    && ok "l'utente esistente ha le preferenze della Home a NULL" || ko "l'utente esistente ha le preferenze della Home a NULL"
tm_sql -e "UPDATE gym_workout_history SET day_id = 7 WHERE user_id = (SELECT id FROM gym_users WHERE username = 'homold1');
           UPDATE gym_users SET home_layout = '[]', module_offers_declined = '[\"body\"]', module_offer_at = '2026-02-01 10:00:00' WHERE username = 'homold1'" \
    || tm_die "valori di prova non scritti"
if section_sql | tm_sql >/dev/null 2>&1; then ok "la sezione 44 si rilancia senza errori"; else ko "la sezione 44 si rilancia senza errori"; fi
[[ "$(sql_value "SELECT day_id FROM gym_workout_history WHERE user_id = (SELECT id FROM gym_users WHERE username = 'homold1')")" == 7 ]] \
    && ok "il rilancio non tocca day_id" || ko "il rilancio non tocca day_id"
[[ "$(sql_value "SELECT CONCAT(home_layout, module_offers_declined, module_offer_at) FROM gym_users WHERE username = 'homold1'")" == '[]["body"]2026-02-01 10:00:00' ]] \
    && ok "il rilancio non tocca le preferenze della Home" || ko "il rilancio non tocca le preferenze della Home"
tm_sql -e "DELETE FROM gym_users WHERE username = 'homold1'" || tm_die "utente di prova non eliminato"

echo "Endpoint"
tm_php_phase home_test.php run

echo
echo "$total controlli, $failed falliti"
[[ "$failed" -eq 0 ]]
