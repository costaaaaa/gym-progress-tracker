# throwaway_mysql.sh — preparazione comune dei test con MySQL usa e getta (da includere con `source`,
# non da eseguire). Usato da delete_cascade.sh e schema_avanzi.sh.
#
# tm_setup avvia in Docker una rete privata e un MySQL (senza porte pubblicate, dati in tmpfs,
# --memory 900m) con lo schema del repo, e prepara in $TMP una copia di backend/ con il
# config/database.php dell'immagine web (il repo non ce l'ha: è ignorato). Il chiamante deve avere
# impostato ROOT (radice del repo). Container, rete e cartella temporanea sono rimossi all'uscita.
# tm_php_phase esegue un file di tests/ con il PHP dell'immagine web e somma i controlli.
# PHP_IMAGE sceglie l'immagine web (default: la liftindex-web più recente già scaricata), MYSQL_IMAGE
# quella di MySQL (default mysql:9.7).
#
# tm_run_section usa MIGRATIONS (percorso di schema_alter_migrations.sql), che il chiamante imposta.
#
# Dopo tm_setup sono disponibili: TMP, NET, DB, DBPASS, PHP_IMAGE, e i contatori total e failed.

PHP_IMAGE="${PHP_IMAGE:-$(docker image ls --format '{{.Repository}}:{{.Tag}}' | grep '^ghcr.io/costaaaaa/liftindex-web:' | sort -V | tail -n 1)}"
MYSQL_IMAGE="${MYSQL_IMAGE:-mysql:9.7}"

tm_die() { echo "$1" >&2; exit 2; }

tm_cleanup() {
    docker rm -f "$DB" "$CAT" "$PHP" >/dev/null 2>&1
    docker network rm "$NET" >/dev/null 2>&1
    rm -rf "$TMP"
}

# Prefisso dei nomi dei container: $1 (sigla del test)
tm_setup() {
    [[ -n "$PHP_IMAGE" ]] || { echo "Nessuna immagine PHP: imposta PHP_IMAGE" >&2; exit 2; }
    RUN="$1$RANDOM$RANDOM"
    NET="$RUN-net"
    DB="$RUN-mysql"
    CAT="$RUN-cat"
    PHP="$RUN-php"
    DBPASS="pw$RANDOM$RANDOM"
    TMP="$(mktemp -d)"
    trap tm_cleanup EXIT

    # Il repo non ha config/database.php (è ignorato): si usa quello dell'immagine web, che legge l'ambiente.
    cp -r "$ROOT/backend" "$TMP/backend" || exit 2
    docker run --rm --name "$CAT" --entrypoint cat "$PHP_IMAGE" /var/www/app/backend/config/database.php >"$TMP/backend/config/database.php" \
        || tm_die "database.php non trovato nell'immagine"

    docker network create "$NET" >/dev/null || exit 2
    docker run -d --name "$DB" --network "$NET" --memory 900m --tmpfs /var/lib/mysql -e MYSQL_ROOT_PASSWORD="$DBPASS" "$MYSQL_IMAGE" >/dev/null || exit 2

    echo "Avvio MySQL..."
    local ready=0
    for _ in $(seq 1 90); do
        if docker exec -e MYSQL_PWD="$DBPASS" "$DB" mysql -uroot -h 127.0.0.1 -e 'SELECT 1' >/dev/null 2>&1; then ready=1; break; fi
        sleep 1
    done
    [[ "$ready" == 1 ]] || tm_die "MySQL non è partito"
    # Basta lo schema completo: secondo DB_UPGRADE_README.md contiene già tutto; le sezioni di
    # schema_alter_migrations.sql servono solo ai database già esistenti.
    docker exec -i -e MYSQL_PWD="$DBPASS" "$DB" mysql -uroot <"$ROOT/backend/database/gym_progress_tracker.sql" \
        || tm_die "schema non caricato"

    total=0
    failed=0
}

# Client mysql nel database di prova: l'SQL arriva da stdin (o con -e), gli argomenti vanno a mysql
tm_sql() {
    docker exec -i -e MYSQL_PWD="$DBPASS" "$DB" mysql -uroot gym_progress_tracker "${@}"
}

# Una fase del test: $1 = file in tests/, poi gli argomenti (la cartella backend va per prima).
# Stampa l'output e aggiorna total e failed dalla riga «CONTROLLI <n> FALLITI <m>» del test.
tm_php_phase() {
    local file="$1" phase="$2" out rc line
    out="$(docker run --rm --name "$PHP" --network "$NET" -v "$TMP:/w:ro" -v "$ROOT/tests:/t:ro" \
        -e DB_HOST="$DB" -e DB_NAME=gym_progress_tracker -e DB_USER=root -e DB_PASSWORD="$DBPASS" \
        --entrypoint php "$PHP_IMAGE" "/t/$file" /w/backend "$phase")"
    rc=$?
    echo "$out" | grep -v '^CONTROLLI '
    [[ "$rc" -le 1 ]] || tm_die "la fase $phase è andata in errore (codice $rc)"
    line="$(echo "$out" | grep '^CONTROLLI ' | tail -n 1)"
    [[ "$line" =~ ^CONTROLLI\ [0-9]+\ FALLITI\ [0-9]+$ ]] || tm_die "la fase $phase non ha stampato la riga CONTROLLI"
    total=$((total + $(echo "$line" | awk '{print $2}')))
    failed=$((failed + $(echo "$line" | awk '{print $4}')))
}

# Esegue due volte la sezione $1 di $MIGRATIONS (le sezioni devono essere idempotenti) nel database di
# prova. Conta un controllo per esecuzione (e uno se la sezione manca): total e failed restano coerenti.
tm_run_section() {
    local n="$1" sql out pass
    sql="$(awk -v n="$n" '/^-- [0-9]+\. /{ split($2, a, "."); cur = a[1] } cur == n' "$MIGRATIONS")"
    if [[ -z "$sql" ]]; then
        echo "Sezione $n assente in $MIGRATIONS" >&2
        total=$((total + 1))
        failed=$((failed + 1))
        return
    fi
    for pass in 1 2; do
        total=$((total + 1))
        if ! out="$(printf '%s\n' "$sql" | tm_sql 2>&1)"; then
            echo "Errore nella sezione $n (esecuzione $pass): $out" >&2
            failed=$((failed + 1))
        fi
    done
}
