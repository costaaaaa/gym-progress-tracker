#!/usr/bin/env bash
#
# signup_codes.sh — codici di registrazione, lato server: migrazione 40 (su un database con utenti, rilanciata e
# interrotta a metà), registrazione con codice (grafie, errori, nessun account creato, limite dei codici non
# utilizzabili per IP, ultimo posto conteso da registrazioni parallele), controllo anticipato, aggancio alla
# conferma dell'email (entro e dopo i 7 giorni, codice spento o scaduto, recupero password, cambio di indirizzo,
# livello già migliore), posti e account eliminati, pulizia notturna, user/read.php, esportazione e admin
# (elenco a pagine, dettaglio, crea, modifica, elimina). Le regole pure sono in signup_code_rules.sh.
#
#   tests/signup_codes.sh
#
# Avvia in Docker un MySQL usa e getta (tests/lib/throwaway_mysql.sh) e il backend con il server integrato di
# PHP (immagine web, più processi), e chiama gli endpoint veri; MAIL_DRIVER=log e i codici a 6 cifre si leggono
# dal log. Le prove sono in tests/signup_codes_test.php.
#
# Richiede docker. Esce con 1 se un controllo fallisce, con 2 se la preparazione fallisce.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS="$ROOT/backend/database/schema_alter_migrations.sql"

source "$ROOT/tests/lib/throwaway_mysql.sh"
tm_setup sc

ok() { total=$((total + 1)); echo "  ✓ $1"; }
ko() { total=$((total + 1)); failed=$((failed + 1)); echo "  ✗ $1"; }
sql_value() { tm_sql -N -e "$1" 2>/dev/null; }
section_sql() { awk -v n=40 '/^-- [0-9]+\. /{ split($2, a, "."); cur = a[1] } cur == n' "$MIGRATIONS"; }
tables() { sql_value "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'gym_progress_tracker' AND table_name IN ('gym_signup_codes','gym_signup_code_uses')"; }

echo "Migrazione 40 su un database con utenti esistenti"
# Torna allo stato prima della sezione 40
tm_sql -e "DROP TABLE gym_signup_code_uses; DROP TABLE gym_signup_codes;" || tm_die "impossibile riportare lo schema a prima della sezione 40"
tm_sql -e "INSERT INTO gym_users (username, email, password, created_at) VALUES ('migold1', 'migold1@example.test', 'x', '2026-01-05 10:00:00')" \
    || tm_die "utente esistente non inserito"
[[ -n "$(section_sql)" ]] || tm_die "sezione 40 assente in $MIGRATIONS"
if section_sql | tm_sql >/dev/null 2>&1; then ok "la sezione 40 si applica"; else ko "la sezione 40 si applica"; fi
[[ "$(tables)" == 2 ]] && ok "le due tabelle ci sono" || ko "le due tabelle ci sono"
if section_sql | tm_sql >/dev/null 2>&1; then ok "la sezione 40 si rilancia senza errori"; else ko "la sezione 40 si rilancia senza errori"; fi
# Interrotta a metà: c'è solo la tabella dei codici
tm_sql -e "DROP TABLE gym_signup_code_uses" || tm_die "impossibile simulare la sezione interrotta"
if section_sql | tm_sql >/dev/null 2>&1 && [[ "$(tables)" == 2 ]]; then ok "la sezione interrotta a metà si rilancia e completa"; else ko "la sezione interrotta a metà si rilancia e completa"; fi
[[ "$(sql_value "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'gym_progress_tracker' AND table_name = 'gym_users' AND column_name LIKE '%signup%'")" == 0 ]] \
    && ok "nessuna colonna nuova su gym_users" || ko "nessuna colonna nuova su gym_users"
[[ "$(sql_value "SELECT COUNT(*) FROM gym_users WHERE username = 'migold1'")" == 1 ]] \
    && ok "gli utenti esistenti non sono toccati" || ko "gli utenti esistenti non sono toccati"
[[ "$(sql_value "SELECT CONCAT(delete_rule, '/', unique_constraint_name) FROM information_schema.referential_constraints WHERE constraint_schema = 'gym_progress_tracker' AND table_name = 'gym_signup_code_uses' AND referenced_table_name = 'gym_users'")" == SET\ NULL/* ]] \
    && ok "chiave sull'utente: ON DELETE SET NULL" || ko "chiave sull'utente: ON DELETE SET NULL"
[[ "$(sql_value "SELECT delete_rule FROM information_schema.referential_constraints WHERE constraint_schema = 'gym_progress_tracker' AND table_name = 'gym_signup_code_uses' AND referenced_table_name = 'gym_signup_codes'")" == RESTRICT ]] \
    && ok "chiave sul codice: senza cascata (RESTRICT)" || ko "chiave sul codice: senza cascata (RESTRICT)"
[[ "$(sql_value "SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = 'gym_progress_tracker' AND table_name = 'gym_signup_code_uses' AND column_name = 'user_id' AND non_unique = 0")" == 1 ]] \
    && ok "user_id UNIQUE: un utente usa al massimo un codice" || ko "user_id UNIQUE: un utente usa al massimo un codice"
[[ "$(sql_value "SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = 'gym_progress_tracker' AND table_name = 'gym_signup_codes' AND column_name = 'code' AND non_unique = 0")" == 1 ]] \
    && ok "code UNIQUE" || ko "code UNIQUE"
tm_sql -e "INSERT INTO gym_signup_codes (code, tier, max_uses) VALUES ('X1', 'plus', 1)" || tm_die "codice di prova non inserito"
if tm_sql -e "INSERT INTO gym_signup_codes (code, tier, max_uses) VALUES ('X1', 'pro', 1)" >/dev/null 2>&1; then ko "due codici con lo stesso testo"; else ok "due codici con lo stesso testo: rifiutato"; fi
if tm_sql -e "INSERT INTO gym_signup_codes (code, tier, max_uses) VALUES ('X2', 'free', 1)" >/dev/null 2>&1; then ko "livello free in un codice"; else ok "livello free in un codice: rifiutato"; fi
tm_sql -e "INSERT INTO gym_signup_code_uses (code_id, user_id) SELECT c.id, u.id FROM gym_signup_codes c, gym_users u WHERE c.code = 'X1' AND u.username = 'migold1'" || tm_die "uso di prova non inserito"
if tm_sql -e "DELETE FROM gym_signup_codes WHERE code = 'X1'" >/dev/null 2>&1; then ko "eliminare un codice con usi"; else ok "un codice con usi non si elimina (chiave senza cascata)"; fi
tm_sql -e "DELETE FROM gym_users WHERE username = 'migold1'" || tm_die "utente non eliminato"
[[ "$(sql_value "SELECT COUNT(*) FROM gym_signup_code_uses WHERE user_id IS NULL")" == 1 ]] \
    && ok "eliminando l'utente l'uso resta con user_id NULL" || ko "eliminando l'utente l'uso resta con user_id NULL"
tm_sql -e "DELETE FROM gym_signup_code_uses; DELETE FROM gym_signup_codes" || tm_die "pulizia delle righe di prova"

echo "Registrazione, conferma, admin"
tm_php_phase signup_codes_test.php run

echo
echo "$total controlli, $failed falliti"
[[ "$failed" -eq 0 ]]
