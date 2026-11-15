#!/usr/bin/env bash
#
# birth_date.sh — esegue tests/birth_date_test.php con il PHP dell'immagine web, in Docker, nei fusi
# UTC, Europe/Rome, America/Los_Angeles e Asia/Tokyo.
#
#   tests/birth_date.sh
#
# Non serve PHP sull'host né un database: il test chiama solo birth_date_error().
# PHP_IMAGE sceglie l'immagine (default: la liftindex-web più recente già scaricata).

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PHP_IMAGE="${PHP_IMAGE:-$(docker image ls --format '{{.Repository}}:{{.Tag}}' | grep '^ghcr.io/costaaaaa/liftindex-web:' | sort -V | tail -n 1)}"
[[ -n "$PHP_IMAGE" ]] || { echo "Nessuna immagine PHP: imposta PHP_IMAGE" >&2; exit 2; }

rc=0
for tz in UTC Europe/Rome America/Los_Angeles Asia/Tokyo; do
    docker run --rm -e "TZ=$tz" -v "$ROOT:/w:ro" --entrypoint php "$PHP_IMAGE" /w/tests/birth_date_test.php || rc=1
done
exit $rc
