#!/usr/bin/env bash
#
# email_verify.sh — verifica dell'email, lato server: registrazione con codice a 6 cifre, conferma, reinvio e
# limiti, un codice nuovo annulla il vecchio, blocco dal giorno 8 (403 email_unverified, con sessione web e con
# token Bearer, mai 401) con il giro di tutti gli endpoint, cambio di indirizzo (account non confermato e
# confermato), recupero password, esportazione, pulizia notturna degli account mai confermati e migrazione 39.
#
#   tests/email_verify.sh
#
# Avvia in Docker un MySQL usa e getta (tests/lib/throwaway_mysql.sh) e il backend con il server integrato di
# PHP (immagine web), e chiama gli endpoint veri; MAIL_DRIVER=log e i codici si leggono dal log. Le date si
# spostano con SQL diretto. Le prove sono in tests/email_verify_test.php.
#
# Richiede docker. Esce con 1 se un controllo fallisce, con 2 se la preparazione fallisce.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS="$ROOT/backend/database/schema_alter_migrations.sql"

source "$ROOT/tests/lib/throwaway_mysql.sh"
tm_setup ev

ok() { total=$((total + 1)); echo "  ✓ $1"; }
ko() { total=$((total + 1)); failed=$((failed + 1)); echo "  ✗ $1"; }
sql_value() { tm_sql -N -e "$1" 2>/dev/null; }
section_sql() { awk -v n=39 '/^-- [0-9]+\. /{ split($2, a, "."); cur = a[1] } cur == n' "$MIGRATIONS"; }

echo "Migrazione 39 su un database con utenti esistenti"
# Torna allo stato prima della sezione 39: senza le colonne e senza la tabella dei codici
tm_sql -e "ALTER TABLE gym_users DROP COLUMN email_verified_at, DROP COLUMN pending_email, DROP COLUMN unverified_notice_stage, DROP COLUMN unverified_notice_at; DROP TABLE gym_email_codes;" \
    || tm_die "impossibile riportare lo schema a prima della sezione 39"
tm_sql -e "INSERT INTO gym_users (username, email, password, created_at) VALUES
    ('migold1', 'migold1@example.test', 'x', '2026-01-05 10:00:00'), ('migold2', 'migold2@example.test', 'x', '2026-03-09 08:30:00')" \
    || tm_die "utenti esistenti non inseriti"
[[ -n "$(section_sql)" ]] || tm_die "sezione 39 assente in $MIGRATIONS"
if section_sql | tm_sql >/dev/null 2>&1; then ok "la sezione 39 si applica"; else ko "la sezione 39 si applica"; fi
[[ "$(sql_value "SELECT COUNT(*) FROM gym_users WHERE email_verified_at = created_at")" == 2 ]] \
    && ok "gli utenti esistenti risultano confermati (email_verified_at = created_at)" || ko "gli utenti esistenti risultano confermati"
[[ "$(sql_value "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'gym_progress_tracker' AND table_name = 'gym_users' AND column_name IN ('email_verified_at','pending_email','unverified_notice_stage','unverified_notice_at')")" == 4 ]] \
    && ok "le quattro colonne nuove ci sono" || ko "le quattro colonne nuove ci sono"
[[ "$(sql_value "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'gym_progress_tracker' AND table_name = 'gym_email_codes'")" == 1 ]] \
    && ok "la tabella gym_email_codes c'è" || ko "la tabella gym_email_codes c'è"
[[ "$(sql_value "SELECT unverified_notice_stage FROM gym_users WHERE username = 'migold1'")" == 0 ]] \
    && ok "unverified_notice_stage parte da 0" || ko "unverified_notice_stage parte da 0"
# Un account nato dopo la migrazione non è confermato; rilanciare la sezione non lo tocca
tm_sql -e "INSERT INTO gym_users (username, email, password) VALUES ('mignew', 'mignew@example.test', 'x')" || tm_die "utente nuovo non inserito"
if section_sql | tm_sql >/dev/null 2>&1; then ok "la sezione 39 si rilancia senza errori"; else ko "la sezione 39 si rilancia senza errori"; fi
[[ "$(sql_value "SELECT email_verified_at IS NULL FROM gym_users WHERE username = 'mignew'")" == 1 ]] \
    && ok "rilanciata, l'account nato dopo resta non confermato" || ko "rilanciata, l'account nato dopo resta non confermato"
[[ "$(sql_value "SELECT COUNT(*) FROM gym_users WHERE email_verified_at = created_at AND username LIKE 'migold%'")" == 2 ]] \
    && ok "rilanciata, gli account vecchi restano come erano" || ko "rilanciata, gli account vecchi restano come erano"
# Sezione interrotta dopo l'ALTER (colonna presente, tabella dei codici assente, utenti con NULL): il rilancio riempie
tm_sql -e "DROP TABLE gym_email_codes; UPDATE gym_users SET email_verified_at = NULL WHERE username LIKE 'migold%'" \
    || tm_die "impossibile simulare la sezione interrotta"
if section_sql | tm_sql >/dev/null 2>&1; then ok "la sezione interrotta dopo l'ALTER si rilancia"; else ko "la sezione interrotta dopo l'ALTER si rilancia"; fi
[[ "$(sql_value "SELECT COUNT(*) FROM gym_users WHERE email_verified_at = created_at AND username LIKE 'migold%'")" == 2 ]] \
    && ok "interrotta e rilanciata, gli account esistenti risultano confermati" || ko "interrotta e rilanciata, gli account esistenti risultano confermati"
[[ "$(sql_value "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'gym_progress_tracker' AND table_name = 'gym_email_codes'")" == 1 ]] \
    && ok "interrotta e rilanciata, la tabella dei codici c'è" || ko "interrotta e rilanciata, la tabella dei codici c'è"
# Gli account di questa fase non servono alla fase PHP
tm_sql -e "DELETE FROM gym_users WHERE username LIKE 'mig%'" || tm_die "pulizia degli utenti di prova della migrazione"

echo "Endpoint, blocco, cambio di indirizzo, pulizia"
tm_php_phase email_verify_test.php run

echo
echo "$total controlli, $failed falliti"
[[ "$failed" -eq 0 ]]
