#!/usr/bin/env bash
#
# blog_mcp.sh — esegue tests/blog_mcp_test.php con il PHP dell'immagine web, in Docker.
#
#   tests/blog_mcp.sh
#
# Non serve PHP sull'host né un database: il test genera da riga di comando
# le due pagine sul collegamento degli assistenti AI (italiana e inglese).
# PHP_IMAGE sceglie l'immagine (default: la liftindex-web più recente già scaricata).

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PHP_IMAGE="${PHP_IMAGE:-$(docker image ls --format '{{.Repository}}:{{.Tag}}' | grep '^ghcr.io/costaaaaa/liftindex-web:' | sort -V | tail -n 1)}"
[[ -n "$PHP_IMAGE" ]] || { echo "Nessuna immagine PHP: imposta PHP_IMAGE" >&2; exit 2; }

docker run --rm -v "$ROOT:/w:ro" --entrypoint php "$PHP_IMAGE" /w/tests/blog_mcp_test.php
