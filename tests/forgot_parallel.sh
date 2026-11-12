#!/usr/bin/env bash
#
# forgot_parallel.sh — controlla che richieste di recupero password contemporanee per lo stesso
# indirizzo lascino un solo link attivo (api/user/forgot_password.php).
#
#   tests/forgot_parallel.sh
#
# Non serve staging: avvia in Docker un MySQL usa e getta (dati in tmpfs) con lo schema del repo e il
# backend vero con `php -S` a più worker, sulla stessa rete Docker. Nessuna porta pubblicata sull'host,
# nessuna email vera (MAIL_DRIVER=log). Container e rete vengono rimossi all'uscita.
# PHP_IMAGE sceglie l'immagine web (default: la liftindex-web più recente già scaricata),
# MYSQL_IMAGE quella di MySQL (default mysql:9.7).
#
# Richiede docker. Esce con 1 se un controllo fallisce.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PHP_IMAGE="${PHP_IMAGE:-$(docker image ls --format '{{.Repository}}:{{.Tag}}' | grep '^ghcr.io/costaaaaa/liftindex-web:' | sort -V | tail -n 1)}"
MYSQL_IMAGE="${MYSQL_IMAGE:-mysql:9.7}"
[[ -n "$PHP_IMAGE" ]] || { echo "Nessuna immagine PHP: imposta PHP_IMAGE" >&2; exit 2; }

USERS=20     # account di prova
PARALLEL=16  # richieste contemporanee per account
RUN="fp$RANDOM$RANDOM"
NET="$RUN-net"
DB="$RUN-mysql"
WEB="$RUN-web"
DBPASS="pw$RANDOM$RANDOM"
TMP="$(mktemp -d)"
fails=0
checks=0

ok() { checks=$((checks + 1)); printf '  \033[32m✓\033[0m %s\n' "$1"; }
ko() { checks=$((checks + 1)); fails=$((fails + 1)); printf '  \033[31m✗\033[0m %s\n' "$1"; [[ -n "${2:-}" ]] && printf '      %s\n' "$2"; }

cleanup() {
    docker rm -f "$WEB" "$DB" >/dev/null 2>&1
    docker network rm "$NET" >/dev/null 2>&1
    rm -rf "$TMP"
}
trap cleanup EXIT

# sql "query" → stampa il risultato senza intestazioni
sql() { docker exec -i "$DB" mysql -uroot -p"$DBPASS" -N -B gym_progress_tracker -e "$1" 2>/dev/null; }

# Il repo non ha config/database.php (è ignorato): si serve una copia del backend con quello dell'immagine
# web, che legge la connessione dall'ambiente.
cp -r "$ROOT/backend" "$TMP/backend" || exit 2
docker run --rm --entrypoint cat "$PHP_IMAGE" /var/www/app/backend/config/database.php >"$TMP/backend/config/database.php" \
    || { echo "database.php non trovato nell'immagine" >&2; exit 2; }

docker network create "$NET" >/dev/null || exit 2
docker run -d --name "$DB" --network "$NET" --tmpfs /var/lib/mysql \
    -e MYSQL_ROOT_PASSWORD="$DBPASS" "$MYSQL_IMAGE" >/dev/null || exit 2

echo "Avvio MySQL..."
ready=0
for _ in $(seq 1 90); do
    if docker exec "$DB" mysql -uroot -p"$DBPASS" -h 127.0.0.1 -e 'SELECT 1' >/dev/null 2>&1; then ready=1; break; fi
    sleep 1
done
[[ "$ready" == 1 ]] || { echo "MySQL non è partito" >&2; exit 2; }
docker exec -i "$DB" mysql -uroot -p"$DBPASS" <"$ROOT/backend/database/gym_progress_tracker.sql" \
    || { echo "schema non caricato" >&2; exit 2; }

docker run -d --name "$WEB" --network "$NET" \
    -v "$TMP/backend:/w/backend:ro" \
    -e DB_HOST="$DB" -e DB_NAME=gym_progress_tracker -e DB_USER=root -e DB_PASSWORD="$DBPASS" \
    -e RL_FORGOT_IP_MAX=100000 -e MAIL_DRIVER=log -e PHP_CLI_SERVER_WORKERS=$((USERS * PARALLEL + 8)) \
    --entrypoint php "$PHP_IMAGE" -S 0.0.0.0:8080 -t /w/backend >/dev/null || exit 2
for _ in $(seq 1 30); do
    docker exec "$WEB" curl -s -o /dev/null http://127.0.0.1:8080/ 2>/dev/null && break
    sleep 1
done

# Account di prova, inseriti direttamente nel database.
for i in $(seq 1 "$USERS"); do
    sql "INSERT INTO gym_users (username, email, password) VALUES ('fp$i', 'fp$i@example.test', 'x')"
done

# forgot UTENTE... → una raffica di PARALLEL richieste per ciascun utente, tutte insieme.
forgot() {
    docker exec "$WEB" sh -c '
        for i in "$@"; do
            for n in $(seq 1 '"$PARALLEL"'); do
                curl -s -o /dev/null -X POST -H "Content-Type: application/json" \
                    --data "{\"email\":\"fp$i@example.test\"}" http://127.0.0.1:8080/api/user/forgot_password.php &
            done
        done
        wait' sh "$@"
    sleep 2 # il lavoro dopo la risposta (token e email) può finire dopo la risposta stessa
}

rows() { sql "SELECT COUNT(*) FROM gym_password_resets WHERE user_id = (SELECT id FROM gym_users WHERE email = 'fp$1@example.test')"; }

echo "$PARALLEL richieste contemporanee per ciascuno dei $USERS account"
all=$(seq 1 "$USERS")
# shellcheck disable=SC2086
forgot $all
for i in $all; do
    n="$(rows "$i")"
    if [[ "$n" == 1 ]]; then ok "account $i: una sola riga"; else ko "account $i: righe trovate: $n (attesa: 1)"; fi
done

echo "Seconda richiesta subito dopo"
# shellcheck disable=SC2086
forgot $all
for i in $all; do
    n="$(rows "$i")"
    if [[ "$n" == 1 ]]; then ok "account $i: nessuna riga in più"; else ko "account $i: righe trovate: $n (attesa: 1)"; fi
done

echo "Link più vecchio della finestra"
for i in $all; do
    sql "UPDATE gym_password_resets SET created_at = created_at - INTERVAL 20 MINUTE WHERE user_id = (SELECT id FROM gym_users WHERE email = 'fp$i@example.test')"
done
# shellcheck disable=SC2086
forgot $all
for i in $all; do
    uid="(SELECT id FROM gym_users WHERE email = 'fp$i@example.test')"
    total="$(rows "$i")"
    active="$(sql "SELECT COUNT(*) FROM gym_password_resets WHERE user_id = $uid AND used_at IS NULL")"
    used="$(sql "SELECT COUNT(*) FROM gym_password_resets WHERE user_id = $uid AND used_at IS NOT NULL")"
    if [[ "$total" == 2 && "$active" == 1 && "$used" == 1 ]]; then
        ok "account $i: nuovo link attivo, vecchio segnato usato"
    else
        ko "account $i: righe $total, attive $active, usate $used (attese: 2, 1, 1)"
    fi
done

echo
if [[ "$fails" -eq 0 ]]; then
    printf '\033[32mTutti i controlli passati (%d/%d)\033[0m\n' "$checks" "$checks"
else
    printf '\033[31m%d controlli falliti su %d\033[0m\n' "$fails" "$checks"
    exit 1
fi
