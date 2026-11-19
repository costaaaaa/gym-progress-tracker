#!/usr/bin/env bash
#
# export_units.sh — l'export dei dati (user/export.php) segue l'unità dell'account: intestazione `units`, pesi di serie,
# peso corporeo e circonferenze in lb/pollici per chi ha lb, identici a prima per chi ha kg, lifetime_volume_kg sempre in kg.
#
#   tests/export_units.sh          # le prove
#   tests/export_units.sh dump     # stampa l'export dell'utente in kg (per confrontarlo con un'altra versione)
#
# Avvia in Docker un MySQL usa e getta (tests/lib/throwaway_mysql.sh) e il backend con il server integrato di PHP
# (immagine web), e chiama l'endpoint vero con un token Bearer. Le prove sono in tests/export_units_test.php.
# Le conversioni in sé si provano in tests/units.sh.
#
# Richiede docker. Esce con 1 se un controllo fallisce, con 2 se la preparazione fallisce.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

source "$ROOT/tests/lib/throwaway_mysql.sh"
tm_setup eu

tm_php_phase export_units_test.php "${1:-run}"

echo
echo "$total controlli, $failed falliti"
[[ "$failed" -eq 0 ]]
