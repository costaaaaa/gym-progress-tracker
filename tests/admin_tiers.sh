#!/usr/bin/env bash
#
# admin_tiers.sh — sezione «Livello utente» di /admin (api/admin/tiers.php): ricerca degli utenti e
# assegnazione del livello (free, plus, pro) con un ultimo giorno valido facoltativo.
#
#   ADMIN_USER=io ADMIN_PASS=... tests/admin_tiers.sh http://localhost:8080/backend/
#   DB_SQL_CMD='docker exec -i -e MYSQL_PWD=... db mysql -uroot gym_progress_tracker' \
#     ADMIN_USER=io ADMIN_PASS=... tests/admin_tiers.sh http://localhost:8080/backend/
#
# Registra due account usa e getta (A, B) e alla fine li cancella. La parte admin gira solo con
# ADMIN_USER e ADMIN_PASS di un account reso admin con `tools/admin.php grant`: senza, la salta.
# DB_SQL_CMD (facoltativo) è un comando che legge SQL da stdin sul database dell'istanza: serve per
# i controlli che l'API non permette (scadenza già passata, più di 20 risultati); senza, si saltano.
# Non va lanciato in produzione né in staging: crea account veri.
#
# Richiede curl e jq. Esce con 1 se un controllo fallisce.

set -uo pipefail

BASE="${1:?uso: $(basename "$0") <url del backend, es. http://localhost:8080/backend/>}"
[[ "$BASE" == */ ]] || BASE="$BASE/"

PASS='Prova!Livello2026'
SUFFIX="$(date +%s | tail -c 7)$RANDOM"
fails=0
checks=0

ok()   { checks=$((checks + 1)); printf '  \033[32m✓\033[0m %s\n' "$1"; }
ko()   { checks=$((checks + 1)); fails=$((fails + 1)); printf '  \033[31m✗\033[0m %s\n' "$1"; [[ -n "${2:-}" ]] && printf '      %s\n' "$2"; }
skip() { printf '  - %s (saltato)\n' "$1"; }

# call METODO path token [json] → stampa "status corpo"
call() {
    local method="$1" path="$2" token="$3" body="${4:-}"
    local args=(-s -o /tmp/admin_tiers.$$ -w '%{http_code}' -X "$method" -H 'Content-Type: application/json')
    [[ -n "$token" ]] && args+=(-H "Authorization: Bearer $token")
    [[ -n "$body" ]] && args+=(--data "$body")
    local status
    status="$(curl "${args[@]}" "$BASE$path")"
    printf '%s %s' "$status" "$(cat /tmp/admin_tiers.$$)"
    rm -f /tmp/admin_tiers.$$
}

expect() { # descrizione status_atteso "risposta di call"
    if [[ "${3%% *}" == "$2" ]]; then ok "$1"; else ko "$1" "atteso $2, ricevuto: ${3:0:200}"; fi
}

check() { # descrizione "risposta di call" 'filtro jq che deve essere vero'
    if echo "${2#* }" | jq -e "$3" >/dev/null 2>&1; then ok "$1"; else ko "$1" "ricevuto: ${2:0:200}"; fi
}

login() { # utente password → token
    call POST api/user/mobile_login.php "" "$(jq -nc --arg u "$1" --arg p "$2" '{username:$u, password:$p, device_info:"admin_tiers.sh"}')" \
        | cut -d' ' -f2- | jq -r '.token // empty'
}

register_and_login() { # nome → token
    call POST api/user/register.php "" "$(jq -nc --arg u "$1" --arg e "$1@example.com" --arg p "$PASS" --arg b "$(date -d '-30 years' +%Y-%m-%d)" \
        '{username:$u, email:$e, password:$p, birth_date:$b, gender:"O", accept_terms:true}')" >/dev/null
    login "$1" "$PASS"
}

sql() { echo "$1" | bash -c "$DB_SQL_CMD" >/dev/null; }

A_USER="tiA$SUFFIX"; B_USER="tiB$SUFFIX"
echo "Account di prova: $A_USER $B_USER"
A="$(register_and_login "$A_USER")"
B="$(register_and_login "$B_USER")"
[[ -n "$A" && -n "$B" ]] || { echo "registrazione o login falliti (limite di registrazioni per IP?)" >&2; exit 1; }

cleanup() {
    for t in "$A" "$B"; do
        call POST api/user/delete.php "$t" "$(jq -nc --arg p "$PASS" '{password:$p}')" >/dev/null
    done
    [[ -n "${DB_SQL_CMD:-}" ]] && sql "DELETE FROM gym_users WHERE username LIKE 'tiM${SUFFIX}_%'"
    echo "Account di prova cancellati."
}
trap cleanup EXIT

echo "Accesso"
expect "B (non admin) non cerca: 404" 404 "$(call GET "api/admin/tiers.php?q=$A_USER" "$B")"
expect "B (non admin) non assegna: 404" 404 "$(call POST api/admin/tiers.php "$B" "{\"action\":\"set_tier\",\"id\":1,\"tier\":\"pro\"}")"
expect "senza login: 404" 404 "$(call GET "api/admin/tiers.php?q=$A_USER" "")"

if [[ -z "${ADMIN_USER:-}" || -z "${ADMIN_PASS:-}" ]]; then
    skip "parte admin: mancano ADMIN_USER e ADMIN_PASS"
else
    ADM="$(login "$ADMIN_USER" "$ADMIN_PASS")"
    if [[ -z "$ADM" ]]; then
        ko "login admin" "ADMIN_USER/ADMIN_PASS non validi"
    else
        tiers() { call GET "api/admin/tiers.php?q=$1" "$ADM"; }
        set_tier() { call POST api/admin/tiers.php "$ADM" "$1"; } # json
        A_ID="$(tiers "$A_USER" | cut -d' ' -f2- | jq -r '.users[0].id')"
        # set_json tier [last_day] → corpo della richiesta per A
        set_json() { jq -nc --argjson i "$A_ID" --arg t "$1" --arg d "${2:-}" '{action:"set_tier", id:$i, tier:$t} + (if $d == "" then {} else {last_day:$d} end)'; }
        features() { call GET api/user/read.php "$A" | cut -d' ' -f2- | jq -c '.features'; }
        FUTURE="$(date -u -d '+30 days' +%F)"

        echo "Ricerca"
        res="$(tiers "$A_USER")"
        expect "per username: 200" 200 "$res"
        check "trova A con id, email, free, senza scadenza" "$res" \
            ".users | length == 1 and .[0].id == $A_ID and .[0].username == \"$A_USER\" and (.[0].email | ascii_downcase) == \"${A_USER,,}@example.com\" and .[0].tier == \"free\" and .[0].last_day == null and .[0].effective_tier == \"free\""
        check "per email" "$(tiers "$A_USER@")" ".users | length == 1 and .[0].id == $A_ID"
        check "ignora maiuscole e spazi attorno" "$(tiers "%20$(echo "$A_USER" | tr a-z A-Z)%20")" ".users | any(.id == $A_ID)"
        check "q vuoto: lista vuota" "$(tiers '')" '.users == []'
        check "senza q: lista vuota" "$(call GET api/admin/tiers.php "$ADM")" '.users == []'
        check "q di un carattere: lista vuota" "$(tiers 't')" '.users == []'
        check "i caratteri jolly non fanno da jolly (%%)" "$(tiers '%25%25')" '.users == []'
        check "né il trattino basso (__)" "$(tiers '__')" '.users == []'
        check "nessun risultato: lista vuota" "$(tiers "nessuno$SUFFIX")" '.users == []'
        if [[ -n "${DB_SQL_CMD:-}" ]]; then
            sql "INSERT INTO gym_users (username, email, password) SELECT CONCAT('tiM${SUFFIX}_', LPAD(n, 2, '0')), CONCAT('tiM${SUFFIX}_', LPAD(n, 2, '0'), '@example.test'), 'x' FROM (WITH RECURSIVE s(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM s WHERE n < 25) SELECT n FROM s) t"
            res="$(tiers "tiM${SUFFIX}_")"
            check "25 corrispondenze: al massimo 20, in ordine di username" "$res" \
                ".users | length == 20 and ([.[].username] == ([.[].username] | sort)) and .[0].username == \"tiM${SUFFIX}_01\""
        else
            skip "limite di 20 risultati (serve DB_SQL_CMD)"
        fi

        echo "Assegnazione"
        res="$(set_tier "$(set_json plus "$FUTURE")")"
        expect "plus con data: 200" 200 "$res"
        check "risponde con la riga aggiornata" "$res" ".user.id == $A_ID and .user.tier == \"plus\" and .user.last_day == \"$FUTURE\" and .user.effective_tier == \"plus\" and (.user.email | ascii_downcase) == \"${A_USER,,}@example.com\""
        check "la ricerca la conferma" "$(tiers "$A_USER")" ".users[0].tier == \"plus\" and .users[0].last_day == \"$FUTURE\""
        if [[ "$(features)" == '["focus_session_edit"]' ]]; then ok "A ha le funzioni del livello plus"; else ko "A ha le funzioni del livello plus" "features: $(features)"; fi
        TODAY="$(date -u +%F)"
        check "oggi (UTC) come ultimo giorno è valido" "$(set_tier "$(set_json pro "$TODAY")")" ".user.tier == \"pro\" and .user.last_day == \"$TODAY\" and .user.effective_tier == \"pro\""
        res="$(set_tier "$(set_json pro)")"
        check "pro senza data: senza scadenza" "$res" '.user.tier == "pro" and .user.last_day == null and .user.effective_tier == "pro"'
        check "last_day null o vuoto: come senza data" "$(set_tier "{\"action\":\"set_tier\",\"id\":$A_ID,\"tier\":\"plus\",\"last_day\":\"\"}")" '.user.tier == "plus" and .user.last_day == null'
        check "free: senza scadenza" "$(set_tier "$(set_json free)")" '.user.tier == "free" and .user.last_day == null and .user.effective_tier == "free"'
        if [[ "$(features)" == '[]' ]]; then ok "con free A non ha funzioni extra"; else ko "con free A non ha funzioni extra" "features: $(features)"; fi

        echo "Dati non validi"
        before="$(tiers "$A_USER")"
        YESTERDAY="$(date -u -d '-1 day' +%F)"
        for c in "data passata|plus|$YESTERDAY|invalid_date" "data non valida (31 febbraio)|plus|2099-02-31|invalid_date" \
                 "data in un altro formato|plus|13/11/2099|invalid_date" "free con data|free|$FUTURE|invalid_date" \
                 "livello sconosciuto|gold||invalid_tier" "livello sconosciuto con data|gold|$FUTURE|invalid_tier"; do
            IFS='|' read -r desc tier day code <<<"$c"
            res="$(set_tier "$(set_json "$tier" "$day")")"
            expect "$desc: 400" 400 "$res"
            check "  con il codice $code" "$res" ".success == false and .code == \"$code\" and (.message | length > 0)"
        done
        check "livello mancante: invalid_tier" "$(set_tier "{\"action\":\"set_tier\",\"id\":$A_ID}")" '.code == "invalid_tier"'
        check "data che non è testo: invalid_date" "$(set_tier "{\"action\":\"set_tier\",\"id\":$A_ID,\"tier\":\"plus\",\"last_day\":20991231}")" '.code == "invalid_date"'
        check "i rifiuti non cambiano nulla" "$(tiers "$A_USER")" ". == ${before#* }"
        res="$(set_tier '{"action":"set_tier","id":999999999,"tier":"plus"}')"
        expect "utente inesistente: 404" 404 "$res"
        check "  con il codice user_not_found" "$res" '.code == "user_not_found"'
        res="$(set_tier "{\"action\":\"boh\",\"id\":$A_ID,\"tier\":\"plus\"}")"
        expect "azione sconosciuta: 400" 400 "$res"
        check "  con il codice invalid_action" "$res" '.code == "invalid_action"'
        expect "senza azione: 400" 400 "$(set_tier "{\"id\":$A_ID,\"tier\":\"plus\"}")"
        expect "metodo diverso: 405" 405 "$(call PUT api/admin/tiers.php "$ADM" '{}')"

        echo "Scadenza"
        if [[ -n "${DB_SQL_CMD:-}" ]]; then
            sql "UPDATE gym_users SET tier = 'pro', tier_until = '2000-01-01 00:00:00' WHERE id = $A_ID"
            check "livello scaduto: salvato pro, in vigore free, ultimo giorno 1999-12-31" "$(tiers "$A_USER")" \
                '.users[0].tier == "pro" and .users[0].last_day == "1999-12-31" and .users[0].effective_tier == "free"'
            if [[ "$(features)" == '[]' ]]; then ok "e A non ha le funzioni del livello"; else ko "e A non ha le funzioni del livello" "features: $(features)"; fi
            check "si può riassegnare un livello scaduto" "$(set_tier "$(set_json plus "$FUTURE")")" '.user.tier == "plus" and .user.effective_tier == "plus"'
        else
            skip "livello scaduto (serve DB_SQL_CMD)"
        fi
    fi
fi

echo
echo "$checks controlli, $fails falliti"
[[ $fails -eq 0 ]]
