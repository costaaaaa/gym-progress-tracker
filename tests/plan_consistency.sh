#!/usr/bin/env bash
#
# plan_consistency.sh — controlla che le API delle schede restino coerenti: create_days.php salva
# tutti i giorni o nessuno, create_plan.php lascia una sola scheda attiva, update_plan.php senza
# is_active non cambia lo stato della scheda, e le richieste corrette danno le risposte di sempre.
#
#   tests/plan_consistency.sh
#
# Avvia in Docker un MySQL usa e getta (tests/lib/throwaway_mysql.sh) e il backend con il server
# integrato di PHP (immagine web), e chiama gli endpoint veri con un token Bearer. Le prove sono in
# tests/plan_consistency_test.php.
#
# Richiede docker. Esce con 1 se un controllo fallisce, con 2 se la preparazione fallisce.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

source "$ROOT/tests/lib/throwaway_mysql.sh"
tm_setup pc

tm_php_phase plan_consistency_test.php run

echo
echo "$total controlli, $failed falliti"
[[ "$failed" -eq 0 ]]
