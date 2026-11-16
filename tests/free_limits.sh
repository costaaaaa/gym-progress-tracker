#!/usr/bin/env bash
#
# free_limits.sh — controlla i limiti del livello Gratis (2 schede, 4 giorni per scheda, 10 esercizi
# personali) e quelli di Plus e Pro, la sola lettura delle schede dopo una discesa di livello,
# workout/delete_day.php, tier/limits/features di user/read.php e la forma ridotta del dashboard.
#
#   tests/free_limits.sh
#
# Avvia in Docker un MySQL usa e getta (tests/lib/throwaway_mysql.sh) e il backend con il server
# integrato di PHP (immagine web), e chiama gli endpoint veri con un token Bearer. Gli account di
# prova nascono nel database (nessuna registrazione) e il livello si cambia con SQL diretto.
# Le prove sono in tests/free_limits_test.php.
#
# Richiede docker. Esce con 1 se un controllo fallisce, con 2 se la preparazione fallisce.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

source "$ROOT/tests/lib/throwaway_mysql.sh"
tm_setup fl

tm_php_phase free_limits_test.php run

echo
echo "$total controlli, $failed falliti"
[[ "$failed" -eq 0 ]]
