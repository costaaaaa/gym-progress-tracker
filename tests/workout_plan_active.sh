#!/usr/bin/env bash
#
# workout_plan_active.sh — controlla che updateAtMostOneActive (is_active 1) e activateExclusively su una
# scheda inesistente o di un altro utente ritornino false con plan_gone vero e lascino attiva solo la
# scheda che lo era (WorkoutPlan.php).
#
#   tests/workout_plan_active.sh
#
# Non serve staging: avvia in Docker un MySQL usa e getta (dati in tmpfs) con lo schema del repo e
# esegue tests/workout_plan_active_test.php con il PHP dell'immagine web. Container e rete vengono
# rimossi all'uscita. PHP_IMAGE sceglie l'immagine web (default: la liftindex-web più recente già
# scaricata), MYSQL_IMAGE quella di MySQL (default mysql:9.7).
#
# Richiede docker. Esce con 1 se un controllo fallisce, con 2 se la preparazione fallisce.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PHP_IMAGE="${PHP_IMAGE:-$(docker image ls --format '{{.Repository}}:{{.Tag}}' | grep '^ghcr.io/costaaaaa/liftindex-web:' | sort -V | tail -n 1)}"
MYSQL_IMAGE="${MYSQL_IMAGE:-mysql:9.7}"
[[ -n "$PHP_IMAGE" ]] || { echo "Nessuna immagine PHP: imposta PHP_IMAGE" >&2; exit 2; }

RUN="wpa$RANDOM$RANDOM"
NET="$RUN-net"
DB="$RUN-mysql"
CAT="$RUN-cat"
PHP="$RUN-php"
DBPASS="pw$RANDOM$RANDOM"
TMP="$(mktemp -d)"

cleanup() {
    docker rm -f "$DB" "$CAT" "$PHP" >/dev/null 2>&1
    docker network rm "$NET" >/dev/null 2>&1
    rm -rf "$TMP"
}
trap cleanup EXIT

die() { echo "$1" >&2; exit 2; }

# Il repo non ha config/database.php (è ignorato): si usa quello dell'immagine web, che legge l'ambiente.
cp -r "$ROOT/backend" "$TMP/backend" || exit 2
docker run --rm --name "$CAT" --entrypoint cat "$PHP_IMAGE" /var/www/app/backend/config/database.php >"$TMP/backend/config/database.php" \
    || die "database.php non trovato nell'immagine"

docker network create "$NET" >/dev/null || exit 2
docker run -d --name "$DB" --network "$NET" --tmpfs /var/lib/mysql -e MYSQL_ROOT_PASSWORD="$DBPASS" "$MYSQL_IMAGE" >/dev/null || exit 2

echo "Avvio MySQL..."
ready=0
for _ in $(seq 1 90); do
    if docker exec -e MYSQL_PWD="$DBPASS" "$DB" mysql -uroot -h 127.0.0.1 -e 'SELECT 1' >/dev/null 2>&1; then ready=1; break; fi
    sleep 1
done
[[ "$ready" == 1 ]] || die "MySQL non è partito"
docker exec -i -e MYSQL_PWD="$DBPASS" "$DB" mysql -uroot <"$ROOT/backend/database/gym_progress_tracker.sql" \
    || die "schema non caricato"

docker run --rm --name "$PHP" --network "$NET" -v "$TMP:/w:ro" -v "$ROOT/tests:/t:ro" \
    -e DB_HOST="$DB" -e DB_NAME=gym_progress_tracker -e DB_USER=root -e DB_PASSWORD="$DBPASS" \
    --entrypoint php "$PHP_IMAGE" /t/workout_plan_active_test.php /w/backend
rc=$?
# 1 = un controllo fallito; qualunque altro errore (PHP fatale, docker) è un problema di preparazione.
[[ "$rc" -le 1 ]] && exit "$rc"
exit 2
