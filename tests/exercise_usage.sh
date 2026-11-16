#!/usr/bin/env bash
#
# exercise_usage.sh — controlla che Exercise::usageCount() (e il conteggio di adminList()) contino anche
# le righe di gamification legate all'esercizio, che l'eliminazione dell'esercizio cancellerebbe in silenzio.
#
#   tests/exercise_usage.sh
#
# Avvia in Docker un MySQL usa e getta (tests/lib/throwaway_mysql.sh) ed esegue
# tests/exercise_usage_test.php con il PHP dell'immagine web.
#
# Richiede docker. Esce con 1 se un controllo fallisce, con 2 se la preparazione fallisce.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

source "$ROOT/tests/lib/throwaway_mysql.sh"
tm_setup eu

tm_php_phase exercise_usage_test.php ""

echo
echo "$total controlli, $failed falliti"
[[ "$failed" -eq 0 ]]
