#!/usr/bin/env bash
#
# time_zone.sh — fusi orari degli allenamenti (#55): `date` è l'ora locale del luogo, time_zone dice
# quale, "oggi" e la settimana seguono il fuso del dispositivo (header X-Timezone), senza fuso tutto
# resta in Europe/Rome come prima.
#
#   tests/time_zone.sh http://100.102.68.47:8080/backend/
#
# Registra account usa e getta (token Bearer) e li cancella alla fine.
# Non va lanciato in produzione: crea account veri.
#
# Richiede curl, jq e date GNU. Esce con 1 se un controllo fallisce.

set -uo pipefail

BASE="${1:?uso: $(basename "$0") <url del backend, es. http://localhost:8080/backend/>}"
[[ "$BASE" == */ ]] || BASE="$BASE/"

PASS='Prova!Fuso2026'
SUFFIX="$(date +%s | tail -c 7)$RANDOM"
fails=0
checks=0
XTZ=""   # valore dell'header X-Timezone per la prossima call (vuoto = nessun header)

ok() { checks=$((checks + 1)); printf '  \033[32m✓\033[0m %s\n' "$1"; }
ko() { checks=$((checks + 1)); fails=$((fails + 1)); printf '  \033[31m✗\033[0m %s\n' "$1"; [[ -n "${2:-}" ]] && printf '      %s\n' "$2"; }

call() { # metodo path token [json] → "status corpo"
    local method="$1" path="$2" token="$3" body="${4:-}"
    local args=(-s -o /tmp/time_zone.$$ -w '%{http_code}' -X "$method" -H 'Content-Type: application/json')
    [[ -n "$token" ]] && args+=(-H "Authorization: Bearer $token")
    [[ -n "$XTZ" ]] && args+=(-H "X-Timezone: $XTZ")
    [[ -n "$body" ]] && args+=(--data "$body")
    local status
    status="$(curl "${args[@]}" "$BASE$path")"
    printf '%s %s' "$status" "$(cat /tmp/time_zone.$$)"
    rm -f /tmp/time_zone.$$
}

check() { # descrizione "risposta di call" filtro_jq
    if echo "${2#* }" | jq -e "$3" >/dev/null 2>&1; then ok "$1"; else ko "$1" "ricevuto: ${2:0:300}"; fi
}

same() { # descrizione ottenuto atteso
    if [[ "$2" == "$3" ]]; then ok "$1"; else ko "$1" "ottenuto: '$2' — atteso: '$3'"; fi
}

TOKENS=()
make_user() { # nome → imposta T e DAY (account nuovo, con una scheda), lo ricorda per la pulizia
    local name="tz$1$SUFFIX" plan
    call POST api/user/register.php "" "$(jq -nc --arg u "$name" --arg e "$name@example.com" --arg p "$PASS" --arg b "$(date -d '-30 years' +%Y-%m-%d)" \
        '{username:$u, email:$e, password:$p, birth_date:$b, gender:"O", accept_terms:true}')" >/dev/null
    T="$(call POST api/user/mobile_login.php "" "$(jq -nc --arg u "$name" --arg p "$PASS" '{username:$u, password:$p, device_info:"time_zone.sh"}')" \
        | cut -d' ' -f2- | jq -r '.token // empty')"
    [[ -n "$T" ]] || { echo "registrazione o login falliti (limite di registrazioni per IP?)" >&2; exit 1; }
    TOKENS+=("$T")
    E1="$(call GET api/exercise/read_all.php "$T" | cut -d' ' -f2- | jq -r '.records[0].id')"
    plan="$(call POST api/workout/create_plan.php "$T" '{"name":"Scheda fuso"}' | cut -d' ' -f2- | jq -r '.plan.id')"
    DAY="$(call POST api/workout/create_days.php "$T" "{\"plan_id\":$plan,\"days\":[{\"name\":\"Giorno 1\"}]}" | cut -d' ' -f2- | jq -r '.days[0].id')"
    call POST api/workout/add_exercise.php "$T" "{\"day_id\":$DAY,\"exercise_id\":$E1,\"sets\":3,\"reps\":\"10\",\"rest\":60}" >/dev/null
}

cleanup() {
    XTZ=""
    local t
    for t in "${TOKENS[@]}"; do
        call POST api/user/delete.php "$t" "$(jq -nc --arg p "$PASS" '{password:$p}')" >/dev/null
    done
    echo "Account di prova cancellati."
}
trap cleanup EXIT

iso() { date -u -d "@$1" +%Y-%m-%dT%H:%M:%S.000Z; }
local_in() { TZ="$1" date -d "@$2" '+%Y-%m-%d %H:%M:%S'; }   # fuso istante → data locale

# body peso start_time [ended_at] [backdated] [time_zone]
body() {
    local recs='[]' i
    for i in 1 2 3; do recs="$(jq -c --argjson e "$E1" --argjson d "$DAY" --argjson i "$i" --argjson w "$1" '. + [{exercise_id:$e, day_id:$d, set_number:$i, weight:$w, reps:10}]' <<<"$recs")"; done
    jq -nc --argjson r "$recs" --arg s "$2" --arg e "${3:-}" --argjson b "${4:-false}" --arg z "${5:-}" \
        '{workout_records:$r, start_time:$s} + (if $e != "" then {ended_at:$e} else {} end) + (if $b then {backdated:true} else {} end) + (if $z != "" then {time_zone:$z} else {} end)'
}

history_field() { # id campo → valore nello storico
    call GET api/workout_history/read.php "$T" | cut -d' ' -f2- | jq -r --argjson id "$1" --arg f "$2" '[.records[] | select(.id == $id)][0][$f] // empty'
}

save() { # body → id
    local r
    r="$(call POST api/workout/record_workout.php "$T" "$1")"
    echo "${r#* }" | jq -r '.id // empty'
}

echo "Salvataggio: la data è l'ora locale del fuso"
S="$(date -d '10 minutes ago' +%s)"

make_user a
XTZ="America/New_York"
ID="$(save "$(body 20 "$(iso "$S")")")"
same "header New York: date = ora locale di New York" "$(history_field "$ID" date)" "$(local_in America/New_York "$S")"

XTZ=""
ID="$(save "$(body 21 "$(iso "$S")")")"
same "senza header: l'ultimo fuso visto sull'account" "$(history_field "$ID" date)" "$(local_in America/New_York "$S")"

XTZ="America/New_York"
ID="$(save "$(body 22 "$(iso "$S")" "" false Asia/Tokyo)")"
same "time_zone nel payload batte l'header" "$(history_field "$ID" date)" "$(local_in Asia/Tokyo "$S")"

ID="$(save "$(body 23 "$(iso "$S")" "" false Mars/Olympus)")"
same "time_zone non valido nel payload: si passa all'header" "$(history_field "$ID" date)" "$(local_in America/New_York "$S")"

same "storico: time_zone del luogo" "$(history_field "$ID" time_zone)" "America/New_York"
same "storico: started_at con l'offset di New York" "$(history_field "$ID" started_at)" "$(TZ=America/New_York date -d "@$S" '+%Y-%m-%dT%H:%M:%S%:z')"

EXP="$(call GET api/user/export.php "$T")"
check "export: allenamento con time_zone e started_at" "$EXP" '.workouts | map(select(.time_zone == "America/New_York" and (.started_at | test("-0[45]:00$")))) | length >= 1'

make_user b
XTZ=""
ID="$(save "$(body 24 "$(iso "$S")")")"
same "account nuovo, senza header né time_zone: ora di Roma, come prima" "$(history_field "$ID" date)" "$(local_in Europe/Rome "$S")"
same "storico: time_zone Europe/Rome" "$(history_field "$ID" time_zone)" "Europe/Rome"

XTZ="+02:00"
ID="$(save "$(body 25 "$(iso "$S")")")"
same "header con un offset (non IANA): ignorato, Roma" "$(history_field "$ID" date)" "$(local_in Europe/Rome "$S")"

echo
if (( fails )); then
    echo "✗ $fails controlli su $checks falliti"
    exit 1
fi
echo "✓ $checks controlli ok"
