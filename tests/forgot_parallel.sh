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
# Con `php -S` il lavoro dopo la risposta (token ed email) finisce prima che il client riceva la
# risposta; con PHP-FPM in produzione la risposta parte prima.
#
# Richiede docker. Esce con 1 se un controllo fallisce, con 2 se la preparazione fallisce.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PHP_IMAGE="${PHP_IMAGE:-$(docker image ls --format '{{.Repository}}:{{.Tag}}' | grep '^ghcr.io/costaaaaa/liftindex-web:' | sort -V | tail -n 1)}"
MYSQL_IMAGE="${MYSQL_IMAGE:-mysql:9.7}"
[[ -n "$PHP_IMAGE" ]] || { echo "Nessuna immagine PHP: imposta PHP_IMAGE" >&2; exit 2; }

USERS=20         # account delle prime tre sezioni
PARALLEL=16      # richieste contemporanee per account
RACE_USERS=40    # account della sezione «cambio password e nuova richiesta insieme»
RACE_PARALLEL=4  # richieste di recupero contemporanee per account in quella sezione
SOLO=$((RACE_USERS + 1)) # account del cambio password senza altre richieste
GROUP=5          # account per raffica: le raffiche partono a gruppi per non saturare la macchina
WORKERS=$((GROUP * (PARALLEL + 1)))
(( GROUP * (RACE_PARALLEL + 1) <= WORKERS )) || WORKERS=$((GROUP * (RACE_PARALLEL + 1)))
RESETTOKEN="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcd" # + 2 cifre: 64 caratteri
NEWPASS='Nuova!Prova2026x'
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

die() { echo "$1" >&2; exit 2; }

# sql "query" → stampa il risultato senza intestazioni
sql() { docker exec -e MYSQL_PWD="$DBPASS" "$DB" mysql -uroot -N -B gym_progress_tracker -e "$1"; }
# prep "istruzione" → istruzione di preparazione: se fallisce lo script si ferma
prep() { sql "$1" >/dev/null || die "istruzione fallita: $1"; }
# num "query" → stampa un numero; se la query fallisce o non dà un numero lo script si ferma
num() {
    local v
    v="$(sql "$1")" || die "query fallita: $1"
    [[ "$v" =~ ^[0-9]+$ ]] || die "risultato non numerico (\"$v\"): $1"
    echo "$v"
}
# uid_of N → sottoquery con l'id dell'account di prova N
uid_of() { echo "(SELECT id FROM gym_users WHERE email = 'fp$1@example.test')"; }

# Il repo non ha config/database.php (è ignorato): si serve una copia del backend con quello dell'immagine
# web, che legge la connessione dall'ambiente.
cp -r "$ROOT/backend" "$TMP/backend" || exit 2
docker run --rm --entrypoint cat "$PHP_IMAGE" /var/www/app/backend/config/database.php >"$TMP/backend/config/database.php" \
    || { echo "database.php non trovato nell'immagine" >&2; exit 2; }

docker network create "$NET" >/dev/null || exit 2
docker run -d --name "$DB" --network "$NET" --tmpfs /var/lib/mysql \
    -e MYSQL_ROOT_PASSWORD="$DBPASS" "$MYSQL_IMAGE" --max-connections=$((WORKERS + 20)) >/dev/null || exit 2

echo "Avvio MySQL..."
ready=0
for _ in $(seq 1 90); do
    if docker exec -e MYSQL_PWD="$DBPASS" "$DB" mysql -uroot -h 127.0.0.1 -e 'SELECT 1' >/dev/null 2>&1; then ready=1; break; fi
    sleep 1
done
[[ "$ready" == 1 ]] || die "MySQL non è partito"
docker exec -i -e MYSQL_PWD="$DBPASS" "$DB" mysql -uroot <"$ROOT/backend/database/gym_progress_tracker.sql" \
    || die "schema non caricato"

docker run -d --name "$WEB" --network "$NET" \
    -v "$TMP/backend:/w/backend:ro" \
    -e DB_HOST="$DB" -e DB_NAME=gym_progress_tracker -e DB_USER=root -e DB_PASSWORD="$DBPASS" \
    -e RL_FORGOT_IP_MAX=100000 -e RL_RESET_IP_MAX=100000 -e MAIL_DRIVER=log \
    -e PHP_CLI_SERVER_WORKERS=$WORKERS \
    --entrypoint php "$PHP_IMAGE" -S 0.0.0.0:8080 -t /w/backend >/dev/null || exit 2
ready=0
for _ in $(seq 1 30); do
    if docker exec "$WEB" curl -s -o /dev/null http://127.0.0.1:8080/ 2>/dev/null; then ready=1; break; fi
    sleep 1
done
[[ "$ready" == 1 ]] || die "il server web non risponde"

# Account di prova, inseriti direttamente nel database.
for i in $(seq 1 "$SOLO"); do
    prep "INSERT INTO gym_users (username, email, password) VALUES ('fp$i', 'fp$i@example.test', 'x')"
done

# burst RESET QUANTE UTENTE... → per ciascun utente QUANTE richieste di recupero, tutte insieme (a gruppi
# di GROUP utenti); con RESET=1 anche un cambio password per ciascuno (token $RESETTOKEN, password
# $NEWPASS). Ogni gruppo finisce, lavoro dopo la risposta compreso, prima del successivo. Scrive su
# $TMP/codes una riga "F|R account codice" per richiesta.
burst() {
    local reset="$1" count="$2" group
    shift 2
    : >"$TMP/codes"
    while (( $# > 0 )); do
        group=("${@:1:GROUP}")
        shift "${#group[@]}"
        docker exec -e RESET="$reset" -e COUNT="$count" -e TOKEN_PREFIX="$RESETTOKEN" -e NEWPASS="$NEWPASS" "$WEB" sh -c '
            for i in "$@"; do
                for n in $(seq 1 "$COUNT"); do
                    curl -s -o /dev/null -w "F $i %{http_code}\n" -X POST -H "Content-Type: application/json" \
                        --data "{\"email\":\"fp$i@example.test\"}" http://127.0.0.1:8080/api/user/forgot_password.php &
                done
                if [ "$RESET" = 1 ]; then
                    curl -s -o /dev/null -w "R $i %{http_code}\n" -X POST -H "Content-Type: application/json" \
                        --data "{\"token\":\"$(printf "%s%02d" "$TOKEN_PREFIX" "$i")\",\"new_password\":\"$NEWPASS\"}" \
                        http://127.0.0.1:8080/api/user/reset_password.php &
                fi
            done
            wait' sh "${group[@]}" >>"$TMP/codes"
    done
}

# Tutte le richieste del tipo $1 (F o R) devono aver risposto con i codici ammessi $2 (regex).
check_codes() {
    local kind="$1" allowed="$2" label="$3" total bad
    total="$(grep -c "^$kind " "$TMP/codes")"
    bad="$(grep "^$kind " "$TMP/codes" | awk '{print $3}' | grep -Ev "^($allowed)$" | sort | uniq -c | tr '\n' ' ')"
    if [[ -z "$bad" && "$total" -gt 0 ]]; then ok "$label: $total richieste, tutte con risposta attesa"
    else ko "$label: $total richieste, codici inattesi: ${bad:-nessuna risposta}"; fi
}

rows() { num "SELECT COUNT(*) FROM gym_password_resets WHERE user_id = $(uid_of "$1")"; }

# emails N ATTESE → una riga "[mail:log]" nel log del server per ogni email partita verso l'account N.
emails() {
    local n
    n="$(docker logs "$WEB" 2>&1 | grep -c "\[mail:log\] a=fp$1@example.test ")"
    if [[ "$n" == "$2" ]]; then ok "account $1: email inviate: $n"; else ko "account $1: email inviate: $n (attese: $2)"; fi
}

echo "$PARALLEL richieste contemporanee per ciascuno dei $USERS account"
all=$(seq 1 "$USERS")
# shellcheck disable=SC2086
burst 0 "$PARALLEL" $all
check_codes F 200 "raffica"
for i in $all; do
    n="$(rows "$i")" || exit 2
    if [[ "$n" == 1 ]]; then ok "account $i: una sola riga"; else ko "account $i: righe trovate: $n (attesa: 1)"; fi
    emails "$i" 1
done

echo "Seconda richiesta subito dopo"
# shellcheck disable=SC2086
burst 0 "$PARALLEL" $all
check_codes F 200 "raffica"
for i in $all; do
    n="$(rows "$i")" || exit 2
    if [[ "$n" == 1 ]]; then ok "account $i: nessuna riga in più"; else ko "account $i: righe trovate: $n (attesa: 1)"; fi
    emails "$i" 1
done

echo "Link più vecchio della finestra"
for i in $all; do
    prep "UPDATE gym_password_resets SET created_at = created_at - INTERVAL 20 MINUTE WHERE user_id = $(uid_of "$i")"
done
# shellcheck disable=SC2086
burst 0 "$PARALLEL" $all
check_codes F 200 "raffica"
for i in $all; do
    uid="$(uid_of "$i")"
    total="$(rows "$i")" || exit 2
    active="$(num "SELECT COUNT(*) FROM gym_password_resets WHERE user_id = $uid AND used_at IS NULL")" || exit 2
    used="$(num "SELECT COUNT(*) FROM gym_password_resets WHERE user_id = $uid AND used_at IS NOT NULL")" || exit 2
    if [[ "$total" == 2 && "$active" == 1 && "$used" == 1 ]]; then
        ok "account $i: nuovo link attivo, vecchio segnato usato"
    else
        ko "account $i: righe $total, attive $active, usate $used (attese: 2, 1, 1)"
    fi
    emails "$i" 2
done

# known_link N → l'account N ha la password 'x' e un solo link attivo, creato 20 minuti fa, con il token
# che burst manda per lui.
known_link() {
    local uid tok
    uid="$(uid_of "$1")"
    tok="$(printf '%s%02d' "$RESETTOKEN" "$1")"
    prep "UPDATE gym_users SET password = 'x' WHERE email = 'fp$1@example.test'"
    prep "UPDATE gym_password_resets SET used_at = NOW() WHERE user_id = $uid AND used_at IS NULL"
    prep "INSERT INTO gym_password_resets (user_id, token_hash, created_at, expires_at)
         VALUES ($uid, SHA2('$tok', 256), NOW() - INTERVAL 20 MINUTE, NOW() + INTERVAL 40 MINUTE)"
}

# Senza altre richieste il cambio password con il token noto riesce: nella sezione dopo un 400 viene
# quindi dalla richiesta di recupero arrivata prima, non dalla preparazione.
echo "Cambio password da solo"
known_link "$SOLO"
burst 1 0 "$SOLO"
check_codes R 200 "cambio password"
changed="$(num "SELECT password <> 'x' FROM gym_users WHERE id = $(uid_of "$SOLO")")" || exit 2
if [[ "$changed" == 1 ]]; then ok "password cambiata"; else ko "password non cambiata"; fi

echo "Cambio password e nuova richiesta insieme"
race=$(seq 1 "$RACE_USERS")
for i in $race; do
    known_link "$i"
done
# shellcheck disable=SC2086
burst 1 "$RACE_PARALLEL" $race
check_codes F 200 "recupero"
check_codes R "200|400" "cambio password"
errlog="$(docker logs "$WEB" 2>&1 | grep -c 'after_response\|Reset password error')"
[[ "$errlog" == 0 ]] || docker logs "$WEB" 2>&1 | grep "after_response\|Reset password error" >&2
if [[ "$errlog" == 0 ]]; then ok "nessun errore nel log del server"; else ko "righe di errore nel log del server: $errlog"; fi
for i in $race; do
    uid="$(uid_of "$i")"
    active="$(num "SELECT COUNT(*) FROM gym_password_resets WHERE user_id = $uid AND used_at IS NULL")" || exit 2
    changed="$(num "SELECT password <> 'x' FROM gym_users WHERE id = $uid")" || exit 2
    if [[ "$active" -le 1 ]]; then ok "account $i: al massimo un link attivo"; else ko "account $i: link attivi: $active"; fi
    # Il cambio password risponde 200 se ha preso il link prima della richiesta di recupero, 400 dopo.
    rcode="$(awk -v a="$i" '$1 == "R" && $2 == a {print $3}' "$TMP/codes")"
    if [[ "$rcode" == 200 && "$changed" == 1 ]] || [[ "$rcode" == 400 && "$changed" == 0 ]]; then
        ok "account $i: cambio password $rcode, password coerente"
    else
        ko "account $i: cambio password $rcode, password cambiata: $changed"
    fi
done

echo
if [[ "$fails" -eq 0 ]]; then
    printf '\033[32mTutti i controlli passati (%d/%d)\033[0m\n' "$checks" "$checks"
else
    printf '\033[31m%d controlli falliti su %d\033[0m\n' "$fails" "$checks"
    exit 1
fi
