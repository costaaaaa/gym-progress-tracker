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
# e mobile chiudono davvero; token di reset falsi rifiutati. Alla fine cancella gli account.
# Non va lanciato in produzione: crea account veri.
#
# Richiede curl e jq. Esce con 1 se un controllo fallisce.

set -uo pipefail

BASE="${1:?uso: $(basename "$0") <url del backend, es. http://localhost:8080/backend/>}"
[[ "$BASE" == */ ]] || BASE="$BASE/"

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
    rm -f "$JAR"
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
res="$(call POST api/workout/add_exercise.php "$A" "{\"day_id\":$DID,\"exercise_id\":$EX,\"sets\":3,\"reps\":\"10\",\"rest\":90}")"
expect "A aggiunge un esercizio" 201 "$res"
WEID="$(echo "${res#* }" | jq -r '.workout_exercise.id')"

check "B non vede la scheda di A" "$(call GET api/workout/read_plans.php "$B")" "[.records[]? | select(.id == $PID)] | length == 0"
expect "B non la rinomina" 404 "$(call POST api/workout/update_plan.php "$B" "{\"plan_id\":$PID,\"name\":\"Mia\"}")"
expect "B non la attiva" 404 "$(call POST api/workout/activate_plan.php "$B" "{\"plan_id\":$PID}")"
expect "B non aggiunge giorni" 404 "$(call POST api/workout/create_days.php "$B" "{\"plan_id\":$PID,\"days\":[{\"name\":\"Intruso\"}]}")"
expect "B non aggiunge esercizi al giorno" 404 "$(call POST api/workout/add_exercise.php "$B" "{\"day_id\":$DID,\"exercise_id\":$EX,\"sets\":3,\"reps\":\"10\",\"rest\":90}")"
expect "B non modifica l'esercizio" 404 "$(call POST api/workout/update_exercise.php "$B" "{\"day_id\":$DID,\"exercise_id\":$WEID,\"sets\":9,\"reps\":\"1\",\"rest\":0}")"
expect "B non lo sposta" 404 "$(call POST api/workout/reorder_exercise.php "$B" "{\"day_id\":$DID,\"exercise_id\":$WEID,\"direction\":\"up\"}")"
expect "B non lo cancella" 404 "$(call POST api/workout/delete_exercise.php "$B" "{\"day_id\":$DID,\"exercise_id\":$WEID}")"
expect "B non cancella la scheda" 404 "$(call POST api/workout/delete_plan.php "$B" "{\"plan_id\":$PID}")"
check "la scheda di A è intatta" "$(call GET api/workout/read_plans.php "$A")" \
    "[.records[] | select(.id == $PID and .name == \"Scheda di A\") | .days[] | select(.id == $DID) | .exercises[] | select(.id == $WEID and (.sets | tonumber) == 3)] | length == 1"

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

echo "Reset password"
expect "token malformato rifiutato" 400 "$(call POST api/user/reset_password.php "" "{\"token\":\"abc\",\"new_password\":\"$NEW_PASS!\"}")"
expect "token ben formato ma inventato rifiutato" 400 "$(call POST api/user/reset_password.php "" "{\"token\":\"$(openssl rand -hex 32)\",\"new_password\":\"$NEW_PASS!\"}")"

echo
if [[ $fails -eq 0 ]]; then echo "TUTTO OK ($checks controlli)"; else echo "FALLITI $fails su $checks"; exit 1; fi
