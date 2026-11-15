#!/usr/bin/env bash
#
# birth_date.sh — esegue tests/birth_date_test.php con il PHP dell'immagine web, in Docker, con il
# fuso di PHP (date.timezone) = UTC, Europe/Rome, America/Los_Angeles, Asia/Tokyo; il test controlla
# che sia quello atteso e ripete i controlli per sei fusi dell'utente. Fallisce se uno dei fusi fallisce.
#
#   tests/birth_date.sh
#
# Non serve PHP sull'host né un database: il test chiama solo birth_date_error().
# PHP_IMAGE sceglie l'immagine (default: la liftindex-web più recente già scaricata).

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PHP_IMAGE="${PHP_IMAGE:-$(docker image ls --format '{{.Repository}}:{{.Tag}}' | grep '^ghcr.io/costaaaaa/liftindex-web:' | sort -V | tail -n 1)}"
[[ -n "$PHP_IMAGE" ]] || { echo "Nessuna immagine PHP: imposta PHP_IMAGE" >&2; exit 2; }

status=0
for tz in UTC Europe/Rome America/Los_Angeles Asia/Tokyo; do
    echo "== date.timezone=$tz"
    docker run --rm -v "$ROOT:/w:ro" --entrypoint php "$PHP_IMAGE" -d date.timezone="$tz" /w/tests/birth_date_test.php "$tz" || status=1
done
exit $status
