#!/usr/bin/env bash
#
# email_verify_rules.sh — esegue tests/email_verify_rules_test.php (codice di 6 cifre, limiti di reinvio,
# scadenza dei 7 giorni, regola della pulizia degli account non confermati) con il PHP dell'immagine web,
# in Docker, con il fuso di PHP (date.timezone) = UTC, Europe/Rome, America/Los_Angeles, Asia/Tokyo.
# Fallisce se uno dei fusi fallisce.
#
#   tests/email_verify_rules.sh
#
# Non serve PHP sull'host né un database: le regole sono funzioni pure.
# PHP_IMAGE sceglie l'immagine (default: la liftindex-web più recente già scaricata).

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PHP_IMAGE="${PHP_IMAGE:-$(docker image ls --format '{{.Repository}}:{{.Tag}}' | grep '^ghcr.io/costaaaaa/liftindex-web:' | sort -V | tail -n 1)}"
[[ -n "$PHP_IMAGE" ]] || { echo "Nessuna immagine PHP: imposta PHP_IMAGE" >&2; exit 2; }

status=0
for tz in UTC Europe/Rome America/Los_Angeles Asia/Tokyo; do
    echo "== date.timezone=$tz"
    docker run --rm -v "$ROOT:/w:ro" --entrypoint php "$PHP_IMAGE" -d date.timezone="$tz" /w/tests/email_verify_rules_test.php "$tz" || status=1
done
exit $status
