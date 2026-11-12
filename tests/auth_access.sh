#!/usr/bin/env bash
#
# auth_access.sh — controlla che un utente non tocchi i dati di un altro e che sessioni e token
# smettano di valere quando devono.
#
#   tests/auth_access.sh http://localhost:8080/backend/
#
# Registra due account usa e getta (A proprietario, B estraneo) e usa i token Bearer come l'app
# mobile; per la sessione web usa un cookie jar. Controlla: schede, giorni ed esercizi in scheda,
# storico allenamenti e misure corporee di A non si leggono, modificano o cancellano da B; il
# cambio password chiude la sessione web e gli altri token di A ma non quello in uso; logout web
# e mobile chiudono davvero; il cookie di sessione nasce solo al login (nessun Set-Cookie per chi non
# ha fatto l'accesso), dura 30 giorni solo con `remember: true`, viene cancellato al logout e
# conserva la sua scadenza al cambio password; il login da un'origine estranea è rifiutato senza
# cookie; token di reset falsi rifiutati; recupero password con la stessa risposta per indirizzi
# registrati o no e per richieste ravvicinate. Alla fine cancella gli account.
# Non va lanciato in produzione: crea account veri.
#
# OWN_ORIGIN è un'origine in CORS_ALLOWED_ORIGINS (default: quella dell'URL del backend, come con
# `npm run dev` su http://localhost:3000/backend/ o in staging).
#
# Richiede curl e jq. Esce con 1 se un controllo fallisce.

set -uo pipefail

BASE="${1:?uso: $(basename "$0") <url del backend, es. http://localhost:8080/backend/>}"
[[ "$BASE" == */ ]] || BASE="$BASE/"
OWN_ORIGIN="${OWN_ORIGIN:-$(printf '%s' "$BASE" | grep -oE '^https?://[^/]+')}"

FOREIGN_ORIGIN=https://origine-estranea.example
PASS='Prova!Accessi2026'
NEW_PASS='Prova!Accessi2027'
SUFFIX="$(date +%s | tail -c 7)$RANDOM"
JAR="/tmp/auth_access.jar.$$"
fails=0
checks=0

ok()   { checks=$((checks + 1)); printf '  \033[32m✓\033[0m %s\n' "$1"; }
ko()   { checks=$((checks + 1)); fails=$((fails + 1)); printf '  \033[31m✗\033[0m %s\n' "$1"; [[ -n "${2:-}" ]] && printf '      %s\n' "$2"; }

# call METODO path token [json] → stampa "status corpo". Con token "web" usa il cookie jar.
call() {
    local method="$1" path="$2" token="$3" body="${4:-}"
    local args=(-s -o /tmp/auth_access.$$ -w '%{http_code}' -X "$method" -H 'Content-Type: application/json')
    if [[ "$token" == web ]]; then
        args+=(-b "$JAR" -c "$JAR")
    elif [[ -n "$token" ]]; then
        args+=(-H "Authorization: Bearer $token")
    fi
    [[ -n "$body" ]] && args+=(--data "$body")
    local status
    status="$(curl "${args[@]}" "$BASE$path")"
    printf '%s %s' "$status" "$(cat /tmp/auth_access.$$)"
    rm -f /tmp/auth_access.$$
}

# expect "descrizione" status_atteso "risposta di call"
expect() {
    local desc="$1" want="$2" got="$3"
    if [[ "${got%% *}" == "$want" ]]; then ok "$desc"; else ko "$desc" "atteso $want, ricevuto: ${got:0:200}"; fi
}

# check "descrizione" "risposta di call" filtro_jq → ok se il filtro è vero sul corpo
check() {
    if echo "${2#* }" | jq -e "$3" >/dev/null 2>&1; then ok "$1"; else ko "$1" "ricevuto: ${2:0:200}"; fi
}

login() { # utente password → token
    call POST api/user/mobile_login.php "" "$(jq -nc --arg u "$1" --arg p "$2" '{username:$u, password:$p, device_info:"auth_access.sh"}')" \
        | cut -d' ' -f2- | jq -r '.token // empty'
}

web_login() { # utente password → risposta di call (la sessione resta nel cookie jar)
    call POST api/user/login.php web "$(jq -nc --arg u "$1" --arg p "$2" '{username:$u, password:$p}')"
}

register_and_login() { # nome → token
    local user="$1"
    call POST api/user/register.php "" "$(jq -nc --arg u "$user" --arg e "$user@example.com" --arg p "$PASS" --arg b "$(date -d '-30 years' +%Y-%m-%d)" \
        '{username:$u, email:$e, password:$p, birth_date:$b, gender:"O", accept_terms:true}')" >/dev/null
    login "$user" "$PASS"
}

A_USER="atA$SUFFIX"; B_USER="atB$SUFFIX"
echo "Account di prova: $A_USER $B_USER"
A="$(register_and_login "$A_USER")"
B="$(register_and_login "$B_USER")"
[[ -n "$A" && -n "$B" ]] || { echo "registrazione o login falliti (limite di registrazioni per IP?)" >&2; exit 1; }
A_PASS="$PASS"

cleanup() {
    local t
    t="$(login "$A_USER" "$A_PASS")"
    call POST api/user/delete.php "$t" "$(jq -nc --arg p "$A_PASS" '{password:$p}')" >/dev/null
    call POST api/user/delete.php "$B" "$(jq -nc --arg p "$PASS" '{password:$p}')" >/dev/null
    rm -f "$JAR" "${JAR2:-}" "${HEADERS:-}"
    echo "Account di prova cancellati."
}
trap cleanup EXIT

echo "Senza login"
expect "schede: 401" 401 "$(call GET api/workout/read_plans.php "")"
expect "storico: 401" 401 "$(call GET api/workout_history/read.php "")"
expect "misure: 401" 401 "$(call GET api/user_stats/read.php "")"
expect "token inventato: 401" 401 "$(call GET api/user/read.php "$(printf '%064d' 0)")"

echo "Schede"
res="$(call POST api/workout/create_plan.php "$A" '{"name":"Scheda di A"}')"
expect "A crea una scheda" 201 "$res"
PID="$(echo "${res#* }" | jq -r '.plan.id')"
res="$(call POST api/workout/create_days.php "$A" "{\"plan_id\":$PID,\"days\":[{\"name\":\"Giorno A\"}]}")"
expect "A crea un giorno" 201 "$res"
DID="$(echo "${res#* }" | jq -r '.days[0].id')"
EX="$(call GET api/exercise/read_all.php "$A" | cut -d' ' -f2- | jq -r '[.records[] | select(.status == "approved")][0].id')"
res="$(call POST api/workout/add_exercise.php "$A" "{\"day_id\":$DID,\"exercise_id\":$EX,\"planned_sets\":[{\"set_number\":1,\"kind\":\"working\",\"reps_min\":10,\"reps_max\":10},{\"set_number\":2,\"kind\":\"working\",\"reps_min\":10,\"reps_max\":10},{\"set_number\":3,\"kind\":\"working\",\"reps_min\":10,\"reps_max\":10}],\"rest\":90}")"
expect "A aggiunge un esercizio" 201 "$res"
WEID="$(echo "${res#* }" | jq -r '.workout_exercise.id')"

check "B non vede la scheda di A" "$(call GET api/workout/read_plans.php "$B")" "[.records[]? | select(.id == $PID)] | length == 0"
expect "B non la rinomina" 404 "$(call POST api/workout/update_plan.php "$B" "{\"plan_id\":$PID,\"name\":\"Mia\"}")"
expect "B non la attiva" 404 "$(call POST api/workout/activate_plan.php "$B" "{\"plan_id\":$PID}")"
expect "B non aggiunge giorni" 404 "$(call POST api/workout/create_days.php "$B" "{\"plan_id\":$PID,\"days\":[{\"name\":\"Intruso\"}]}")"
expect "B non aggiunge esercizi al giorno" 404 "$(call POST api/workout/add_exercise.php "$B" "{\"day_id\":$DID,\"exercise_id\":$EX,\"planned_sets\":[{\"set_number\":1,\"kind\":\"working\",\"reps_min\":10,\"reps_max\":10},{\"set_number\":2,\"kind\":\"working\",\"reps_min\":10,\"reps_max\":10},{\"set_number\":3,\"kind\":\"working\",\"reps_min\":10,\"reps_max\":10}],\"rest\":90}")"
expect "B non modifica l'esercizio" 404 "$(call POST api/workout/update_exercise.php "$B" "{\"day_id\":$DID,\"exercise_id\":$WEID,\"planned_sets\":[{\"set_number\":1,\"kind\":\"working\",\"reps_min\":1,\"reps_max\":1}],\"rest\":0}")"
expect "B non lo sposta" 404 "$(call POST api/workout/reorder_exercise.php "$B" "{\"day_id\":$DID,\"exercise_id\":$WEID,\"direction\":\"up\"}")"
expect "B non lo cancella" 404 "$(call POST api/workout/delete_exercise.php "$B" "{\"day_id\":$DID,\"exercise_id\":$WEID}")"
expect "B non cancella la scheda" 404 "$(call POST api/workout/delete_plan.php "$B" "{\"plan_id\":$PID}")"
check "la scheda di A è intatta" "$(call GET api/workout/read_plans.php "$A")" \
    "[.records[] | select(.id == $PID and .name == \"Scheda di A\") | .days[] | select(.id == $DID) | .exercises[] | select(.id == $WEID and (.planned_sets | length) == 3)] | length == 1"

echo "Storico allenamenti"
res="$(call POST api/workout/record_workout.php "$A" "{\"workout_records\":[{\"day_id\":$DID,\"exercise_id\":$EX,\"set_number\":1,\"weight\":50,\"reps\":10}]}")"
expect "A registra un allenamento" 201 "$res"
HID="$(echo "${res#* }" | jq -r '.id')"
check "B non lo vede" "$(call GET api/workout_history/read.php "$B")" "[.records[]? | select(.id == $HID)] | length == 0"
expect "B non ne cambia la data" 404 "$(call POST api/workout_history/update_date.php "$B" "{\"id\":$HID,\"new_date\":\"$(date -d '-1 day' +%Y-%m-%d)\"}")"
expect "B non lo cancella" 404 "$(call POST api/workout_history/delete.php "$B" "{\"id\":$HID}")"
expect "B non salva serie sul giorno di A" 403 "$(call POST api/workout/record_workout.php "$B" "{\"workout_records\":[{\"day_id\":$DID,\"exercise_id\":$EX,\"set_number\":1,\"weight\":50,\"reps\":10}]}")"
check "l'allenamento di A è intatto" "$(call GET api/workout_history/read.php "$A")" "[.records[] | select(.id == $HID)] | length == 1"

echo "Misure corporee"
expect "A dà il consenso per i dati sulla salute" 200 "$(call POST api/user/consent.php "$A" '{"purpose":"health_data","action":"grant"}')"
res="$(call POST api/user_stats/create.php "$A" "{\"date\":\"$(date +%Y-%m-%d)\",\"weight\":80}")"
expect "A salva una misura" 201 "$res"
SID="$(echo "${res#* }" | jq -r '.user_stat.id')"
expect "B senza consenso non legge misure" 200 "$(call GET api/user_stats/read.php "$B")"
check "e non vede quella di A" "$(call GET api/user_stats/read.php "$B")" "[.records[]? | select(.id == $SID)] | length == 0"
call POST api/user_stats/delete.php "$B" "{\"id\":$SID}" >/dev/null
check "B non cancella la misura di A" "$(call GET api/user_stats/read.php "$A")" "[.records[] | select(.id == $SID and (.weight | tonumber) == 80)] | length == 1"

echo "Sessione web e token"
expect "A entra dal web" 200 "$(web_login "$A_USER" "$A_PASS")"
expect "la sessione web vale" 200 "$(call GET api/user/read.php web)"
A2="$(login "$A_USER" "$A_PASS")"
expect "secondo dispositivo di A collegato" 200 "$(call GET api/user/read.php "$A2")"
expect "logout web via GET rifiutato" 405 "$(call GET api/user/logout.php web)"
expect "e la sessione resta" 200 "$(call GET api/user/read.php web)"
# CSRF oltre a SameSite: una scrittura con la sessione web da un'origine estranea è rifiutata (la lettura no)
with_origin() { # origine METODO path → "status corpo"
    curl -s -w '\n%{http_code}' -b "$JAR" -X "$2" -H 'Content-Type: application/json' \
        -H "Origin: $1" --data '{}' "$BASE$3" \
        | { body="$(cat)"; printf '%s %s' "${body##*$'\n'}" "${body%$'\n'*}"; }
}
foreign_origin() { with_origin "$FOREIGN_ORIGIN" "$@"; }
rejected="$(foreign_origin POST api/workout/create_plan.php)"
expect "scrittura con sessione da un'origine estranea rifiutata" 403 "$rejected"
check "il rifiuto è tradotto (common.forbidden)" "$rejected" '.message == "Non hai i permessi per questa azione."'
expect "lettura con sessione da un'origine estranea ammessa (la CORS ne nega la risposta)" 200 "$(foreign_origin GET api/user/read.php)"
expect "scrittura con sessione dall'origine nostra ($OWN_ORIGIN) ammessa" 400 "$(with_origin "$OWN_ORIGIN" POST api/workout/create_plan.php)"
expect "scrittura con sessione senza Origin ammessa" 400 "$(call POST api/workout/create_plan.php web '{}')"
sleep 1  # password_changed_at e l'ora del login si confrontano al secondo
expect "A cambia password dal primo dispositivo" 200 "$(call POST api/user/change_password.php "$A" "$(jq -nc --arg c "$PASS" --arg n "$NEW_PASS" '{current_password:$c, new_password:$n}')")"
A_PASS="$NEW_PASS"
expect "il token in uso resta valido" 200 "$(call GET api/user/read.php "$A")"
expect "il secondo dispositivo è scollegato" 401 "$(call GET api/user/read.php "$A2")"
expect "la sessione web è chiusa" 401 "$(call GET api/user/read.php web)"
expect "la vecchia password non entra" 401 "$(call POST api/user/mobile_login.php "" "$(jq -nc --arg u "$A_USER" --arg p "$PASS" '{username:$u, password:$p}')")"
expect "A rientra dal web con la nuova" 200 "$(web_login "$A_USER" "$A_PASS")"
expect "logout web" 200 "$(call POST api/user/logout.php web)"
expect "dopo il logout la sessione non vale" 401 "$(call GET api/user/read.php web)"
expect "logout mobile" 200 "$(call POST api/user/mobile_logout.php "$A")"
expect "dopo il logout il token non vale" 401 "$(call GET api/user/read.php "$A")"

echo "Cookie di sessione"
# web_post_headers path json [origine] → stampa lo status e lascia gli header in $HEADERS. Non riusa
# with_origin: qui servono il corpo del login, il cookie jar scritto (-c) e gli header (-D).
HEADERS="/tmp/auth_access.headers.$$"
JAR2="/tmp/auth_access.jar2.$$"
web_post_headers() {
    local args=(-s -o /dev/null -D "$HEADERS" -w '%{http_code}' -X POST -H 'Content-Type: application/json' -b "$JAR2" -c "$JAR2" --data "$2")
    [[ -n "${3:-}" ]] && args+=(-H "Origin: $3")
    curl "${args[@]}" "$BASE$1"
}
session_cookie_lines() { tr -d '\r' <"$HEADERS" | grep -i '^set-cookie: *PHPSESSID=' || true; }
cookie_login_body() { # true|false (remember) → corpo del login di A
    jq -nc --arg u "$A_USER" --arg p "$A_PASS" --argjson r "$1" '{username:$u, password:$p} + (if $r then {remember:true} else {} end)'
}
# scadenza del cookie in secondi da adesso (vuota se manca)
cookie_ttl() {
    local expires
    expires="$(grep -oiE 'expires=[^;]+' <<<"$1" | head -n 1 | cut -d= -f2-)"
    [[ -n "$expires" ]] && echo $(( $(date -d "$expires" +%s) - $(date +%s) ))
}
is_about_30_days() { # secondi (anche vuoti)
    [[ -n "$1" && "$1" -gt $((30 * 86400 - 120)) && "$1" -le $((30 * 86400 + 120)) ]]
}
# verdict "descrizione" rc dettaglio → ok se rc è 0, altrimenti ko con il dettaglio. Il controllo si
# scrive `rc=1; <condizione> && rc=0` (con `<condizione>; rc=$?` shellcheck segnala SC2319).
verdict() { if [[ "$2" == 0 ]]; then ok "$1"; else ko "$1" "${3:-}"; fi; }

curl -s -o /dev/null -D "$HEADERS" "$BASE"api/user/read.php
rc=1; [[ -z "$(session_cookie_lines)" ]] && rc=0
verdict "richiesta anonima: nessun Set-Cookie di sessione" "$rc" "$(session_cookie_lines)"

status="$(web_post_headers api/user/login.php "$(cookie_login_body false)")"
line="$(session_cookie_lines)"
rc=1; [[ "$status" == 200 && -n "$line" ]] && rc=0
verdict "login senza remember: 200 e cookie" "$rc" "status $status, cookie: $line"
rc=1; [[ "$(printf '%s\n' "$line" | grep -c .)" == 1 ]] && rc=0
verdict "un solo Set-Cookie di sessione" "$rc" "$line"
rc=1; ! grep -qiE 'expires=|max-age=' <<<"$line" && rc=0
verdict "login senza remember: cookie senza scadenza" "$rc" "$line"
rc=1; grep -qi 'httponly' <<<"$line" && grep -qi 'samesite=lax' <<<"$line" && rc=0
verdict "cookie HttpOnly e SameSite=Lax" "$rc" "$line"

rm -f "$JAR2"
status="$(web_post_headers api/user/login.php "$(cookie_login_body true)")"
line="$(session_cookie_lines)"
ttl="$(cookie_ttl "$line")"
rc=1; [[ "$status" == 200 ]] && is_about_30_days "$ttl" && rc=0
verdict "login con remember: cookie con scadenza a circa 30 giorni" "$rc" "status $status, scadenza fra ${ttl:-?} s: $line"

sleep 1  # password_changed_at e l'ora del login si confrontano al secondo
status="$(web_post_headers api/user/change_password.php "$(jq -nc --arg c "$A_PASS" --arg n "$PASS" '{current_password:$c, new_password:$n}')")"
A_PASS="$PASS"
line="$(session_cookie_lines)"
ttl="$(cookie_ttl "$line")"
rc=1; [[ "$status" == 200 ]] && is_about_30_days "$ttl" && rc=0
verdict "cambio password con remember: il cookie nuovo ha ancora la scadenza di 30 giorni" "$rc" "status $status, scadenza fra ${ttl:-?} s: $line"
expect "dopo il cambio password la sessione nuova vale" 200 "$(curl -s -o /dev/null -w '%{http_code}' -b "$JAR2" "$BASE"api/user/read.php)"

status="$(web_post_headers api/user/logout.php '{}')"
line="$(session_cookie_lines)"
rc=1; [[ "$status" == 200 ]] && grep -qiE 'max-age=0|expires=thu, 01 jan 1970' <<<"$line" && rc=0
verdict "logout: il cookie di sessione è cancellato" "$rc" "status $status: $line"

rm -f "$JAR2"
status="$(web_post_headers api/user/login.php "$(cookie_login_body false)" "$FOREIGN_ORIGIN")"
line="$(session_cookie_lines)"
rc=1; [[ "$status" == 403 && -z "$line" ]] && rc=0
verdict "login da un'origine estranea: 403 e nessun cookie" "$rc" "status $status: $line"
status="$(web_post_headers api/user/login.php "$(cookie_login_body false)" "$OWN_ORIGIN")"
rc=1; [[ "$status" == 200 && -n "$(session_cookie_lines)" ]] && rc=0
verdict "login dall'origine nostra ($OWN_ORIGIN): 200 e cookie" "$rc" "status $status"

echo "Reset password"
expect "token malformato rifiutato" 400 "$(call POST api/user/reset_password.php "" "{\"token\":\"abc\",\"new_password\":\"$NEW_PASS!\"}")"
expect "token ben formato ma inventato rifiutato" 400 "$(call POST api/user/reset_password.php "" "{\"token\":\"$(openssl rand -hex 32)\",\"new_password\":\"$NEW_PASS!\"}")"

echo "Recupero password"
# Questo script NON verifica la regola del link recente (PasswordReset::RECENT_SECONDS: un solo link
# attivo, il primo resta valido; la verifica tests/forgot_parallel.sh): il link si vede solo nell'email,
# da HTTP non si distingue. Controlla solo che la risposta sia sempre la stessa, per indirizzo
# registrato e non, alla prima richiesta e alle successive.
forgot() { call POST api/user/forgot_password.php "" "$(jq -nc --arg e "$1" '{email:$e}')"; }
first="$(forgot "$B_USER@example.com")"
second="$(forgot "$B_USER@example.com")"
unknown="$(forgot "nessuno$SUFFIX@example.com")"
expect "indirizzo registrato: 200" 200 "$first"
rc=1; [[ "$second" == "$first" && "$unknown" == "$first" ]] && rc=0
verdict "stessa risposta alla richiesta ravvicinata e per un indirizzo non registrato" "$rc" "1ª: ${first:0:200} | 2ª: ${second:0:200} | non registrato: ${unknown:0:200}"

echo
if [[ $fails -eq 0 ]]; then echo "TUTTO OK ($checks controlli)"; else echo "FALLITI $fails su $checks"; exit 1; fi
