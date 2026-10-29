#!/usr/bin/env bash
#
# weekly_sets.sh — esegue tests/weekly_sets_test.php con il PHP dell'immagine web, in Docker.
#
#   tests/weekly_sets.sh
#
# Non serve PHP sull'host né un database: le regole sono funzioni pure.
# PHP_IMAGE sceglie l'immagine (default: la liftindex-web più recente già scaricata).

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PHP_IMAGE="${PHP_IMAGE:-$(docker image ls --format '{{.Repository}}:{{.Tag}}' | grep '^ghcr.io/costaaaaa/liftindex-web:' | sort -V | tail -n 1)}"
[[ -n "$PHP_IMAGE" ]] || { echo "Nessuna immagine PHP: imposta PHP_IMAGE" >&2; exit 2; }

docker run --rm -v "$ROOT:/w:ro" --entrypoint php "$PHP_IMAGE" /w/tests/weekly_sets_test.php
