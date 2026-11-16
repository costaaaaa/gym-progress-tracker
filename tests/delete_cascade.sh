#!/usr/bin/env bash
#
# delete_cascade.sh — controlla che cancellare una scheda (WorkoutPlan::delete) o un account
# (User::deleteAccount) non lasci righe orfane, e che la sezione 36 di schema_alter_migrations.sql
# ripulisca quelle già lasciate.
#
#   tests/delete_cascade.sh
#
# Con MySQL 9.7 (innodb_native_foreign_keys=OFF) la cascata attraverso quattro o più tabelle
# (utente > schede > giorni > esercizi > serie pianificate) non arriva in fondo. Il test avvia in Docker
# un MySQL usa e getta (senza porte pubblicate, dati in tmpfs) con lo schema del repo, esegue
# tests/delete_cascade_test.php con il PHP dell'immagine web e conta, per ogni chiave esterna di
# information_schema, le righe figlie senza genitore. Container e rete sono rimossi all'uscita.
# PHP_IMAGE sceglie l'immagine web (default: la liftindex-web più recente già scaricata), MYSQL_IMAGE
# quella di MySQL (default mysql:9.7).
#
# Richiede docker. Esce con 1 se un controllo fallisce, con 2 se la preparazione fallisce.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PHP_IMAGE="${PHP_IMAGE:-$(docker image ls --format '{{.Repository}}:{{.Tag}}' | grep '^ghcr.io/costaaaaa/liftindex-web:' | sort -V | tail -n 1)}"
MYSQL_IMAGE="${MYSQL_IMAGE:-mysql:9.7}"
[[ -n "$PHP_IMAGE" ]] || { echo "Nessuna immagine PHP: imposta PHP_IMAGE" >&2; exit 2; }

RUN="dc$RANDOM$RANDOM"
NET="$RUN-net"
DB="$RUN-mysql"
CAT="$RUN-cat"
PHP="$RUN-php"
DBPASS="pw$RANDOM$RANDOM"
TMP="$(mktemp -d)"
MIGRATIONS="$ROOT/backend/database/schema_alter_migrations.sql"
SECTION=36

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
docker run -d --name "$DB" --network "$NET" --memory 900m --tmpfs /var/lib/mysql -e MYSQL_ROOT_PASSWORD="$DBPASS" "$MYSQL_IMAGE" >/dev/null || exit 2

echo "Avvio MySQL..."
ready=0
for _ in $(seq 1 90); do
    if docker exec -e MYSQL_PWD="$DBPASS" "$DB" mysql -uroot -h 127.0.0.1 -e 'SELECT 1' >/dev/null 2>&1; then ready=1; break; fi
    sleep 1
done
[[ "$ready" == 1 ]] || die "MySQL non è partito"
docker exec -i -e MYSQL_PWD="$DBPASS" "$DB" mysql -uroot <"$ROOT/backend/database/gym_progress_tracker.sql" \
    || die "schema non caricato"

total=0
failed=0
run_phase() { # fase
    local out rc
    out="$(docker run --rm --name "$PHP" --network "$NET" -v "$TMP:/w:ro" -v "$ROOT/tests:/t:ro" \
        -e DB_HOST="$DB" -e DB_NAME=gym_progress_tracker -e DB_USER=root -e DB_PASSWORD="$DBPASS" \
        --entrypoint php "$PHP_IMAGE" /t/delete_cascade_test.php /w/backend "$1")"
    rc=$?
    echo "$out" | grep -v '^CONTROLLI '
    [[ "$rc" -le 1 ]] || die "la fase $1 è andata in errore (codice $rc)"
    local line
    line="$(echo "$out" | grep '^CONTROLLI ' | tail -n 1)"
    total=$((total + $(echo "$line" | awk '{print $2}')))
    failed=$((failed + $(echo "$line" | awk '{print $4}')))
}

run_phase cases

echo
echo "Sezione $SECTION su orfani già presenti"
run_phase seed-orphans
section_sql="$(awk -v n="$SECTION" '/^-- [0-9]+\. /{ split($2, a, "."); cur = a[1] } cur == n' "$MIGRATIONS")"
[[ -n "$section_sql" ]] || { echo "Sezione $SECTION assente in $MIGRATIONS" >&2; failed=$((failed + 1)); }
for pass in 1 2; do
    if ! out="$(printf '%s\n' "$section_sql" | docker exec -i -e MYSQL_PWD="$DBPASS" "$DB" mysql -uroot gym_progress_tracker 2>&1)"; then
        echo "Errore nella sezione $SECTION (esecuzione $pass): $out" >&2
        failed=$((failed + 1))
    fi
done
total=$((total + 1))
run_phase check-orphans

echo
echo "$total controlli, $failed falliti"
[[ "$failed" -eq 0 ]]
