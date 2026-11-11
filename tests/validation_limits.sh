#!/usr/bin/env bash
#
# validation_limits.sh — esegue tests/validation_limits_test.php con il PHP dell'immagine web, in Docker.
#
#   tests/validation_limits.sh
#
# Non serve PHP sull'host né un database: sono funzioni pure.
# PHP_IMAGE sceglie l'immagine (default: la liftindex-web più recente già scaricata).

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PHP_IMAGE="${PHP_IMAGE:-$(docker image ls --format '{{.Repository}}:{{.Tag}}' | grep '^ghcr.io/costaaaaa/liftindex-web:' | sort -V | tail -n 1)}"
[[ -n "$PHP_IMAGE" ]] || { echo "Nessuna immagine PHP: imposta PHP_IMAGE" >&2; exit 2; }

docker run --rm -v "$ROOT:/w:ro" --entrypoint php "$PHP_IMAGE" /w/tests/validation_limits_test.php
