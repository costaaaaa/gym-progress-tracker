#!/usr/bin/env bash
#
# achievement_endpoints.sh — controlla che i nomi dei traguardi escano nella lingua dell'account:
# gamification/profile.php e unlocked_achievements di workout/record_workout.php, con un account
# italiano e uno inglese.
#
#   tests/achievement_endpoints.sh
#
# Avvia in Docker un MySQL usa e getta (tests/lib/throwaway_mysql.sh) e il backend con il server
# integrato di PHP (immagine web). Le prove sono in tests/achievement_endpoints_test.php.
#
# Richiede docker. Esce con 1 se un controllo fallisce, con 2 se la preparazione fallisce.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

source "$ROOT/tests/lib/throwaway_mysql.sh"
tm_setup ae

tm_php_phase achievement_endpoints_test.php run

echo
echo "$total controlli, $failed falliti"
[[ "$failed" -eq 0 ]]
