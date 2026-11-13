#!/usr/bin/env bash
#
# first_use.sh — controlla due regole del primo utilizzo:
#   - la scheda creata da un utente senza scheda attiva nasce attiva (se il client non chiede
#     altro); non risultano mai due schede attive, nemmeno con creazioni contemporanee;
#   - lo storico vuoto risponde 200 con "records": [] (non 404).
#
#   tests/first_use.sh http://localhost:8080/backend/
#
# Registra account usa e getta (token Bearer come l'app mobile) e li cancella alla fine.
# Non va lanciato in produzione: crea account veri. Il server di prova deve avere il limite di
# registrazioni per IP alzato (RL_REGISTER_MAX).
#
# Richiede curl e jq. Esce con 1 se un controllo fallisce.

# I filtri jq stanno fra apici semplici di proposito: $status è una variabile di jq
# shellcheck disable=SC2016
set -uo pipefail

BASE="${1:?uso: $(basename "$0") <url del backend, es. http://localhost:8080/backend/>}"
[[ "$BASE" == */ ]] || BASE="$BASE/"

PASS='Prova!PrimoUso2026'
SUFFIX="$(date +%s | tail -c 7)$RANDOM"
TOKENS=()
fails=0
checks=0

ok() { checks=$((checks + 1)); printf '  \033[32m✓\033[0m %s\n' "$1"; }
ko() { checks=$((checks + 1)); fails=$((fails + 1)); printf '  \033[31m✗\033[0m %s\n' "$1"; [[ -n "${2:-}" ]] && printf '      %s\n' "$2"; }

call() { # metodo path token [json] → "status corpo"
    local method="$1" path="$2" token="$3" body="${4:-}" out
    out="$(mktemp)"
    local args=(-s -o "$out" -w '%{http_code}' -X "$method" -H 'Content-Type: application/json')
    [[ -n "$token" ]] && args+=(-H "Authorization: Bearer $token")
    [[ -n "$body" ]] && args+=(--data "$body")
    local status
    status="$(curl "${args[@]}" "$BASE$path")"
    printf '%s %s' "$status" "$(cat "$out")"
    rm -f "$out"
}

body_of() { printf '%s' "${1#* }"; }

expect_n() { # descrizione ricevuto atteso
    if [[ "$2" == "$3" ]]; then ok "$1"; else ko "$1" "atteso $3, ricevuto: $2"; fi
}

check() { # descrizione "risposta di call" filtro_jq (sul corpo; $status è il codice HTTP)
    local status="${2%% *}"
    if echo "${2#* }" | jq -e --argjson status "$status" "$3" >/dev/null 2>&1; then ok "$1"; else ko "$1" "ricevuto: ${2:0:300}"; fi
}

new_account() { # utente → imposta TOKEN
    local user="$1"
    call POST api/user/register.php "" "$(jq -nc --arg u "$user" --arg e "$user@example.com" --arg p "$PASS" --arg b "$(date -d '-30 years' +%Y-%m-%d)" \
        '{username:$u, email:$e, password:$p, birth_date:$b, gender:"O", accept_terms:true}')" >/dev/null
    TOKEN="$(call POST api/user/mobile_login.php "" "$(jq -nc --arg u "$user" --arg p "$PASS" '{username:$u, password:$p, device_info:"first_use.sh"}')" \
        | cut -d' ' -f2- | jq -r '.token // empty')"
    [[ -n "$TOKEN" ]] || { echo "registrazione o login falliti per $user (limite di registrazioni per IP?)" >&2; exit 1; }
    TOKENS+=("$TOKEN")
}

cleanup() {
    local left=0 res t
    for t in "${TOKENS[@]}"; do
        res="$(call POST api/user/delete.php "$t" "$(jq -nc --arg p "$PASS" '{password:$p}')")"
        [[ "$(jq -r .success <<<"${res#* }" 2>/dev/null)" == true ]] || left=$((left + 1))
    done
    echo "Account di prova cancellati ($left rimasti)."
}
trap cleanup EXIT

new_plan() { call POST api/workout/create_plan.php "$1" "${2:-"{\"name\":\"Scheda\"}"}"; }
plan_id() { body_of "$1" | jq -r '.plan.id'; }
active_ids() { # token → id delle schede attive, uno per riga
    body_of "$(call GET api/workout/read_plans.php "$1")" | jq -r '.records[] | select(.is_active == 1 or .is_active == "1" or .is_active == true) | .id'
}
active_count() { active_ids "$1" | grep -c .; }

echo "Prima scheda"
new_account "fuA$SUFFIX"; A="$TOKEN"
R1="$(new_plan "$A")"
check "la prima scheda è creata e la risposta dice is_active 1" "$R1" '$status == 201 and (.plan.is_active | tonumber) == 1'
P1="$(plan_id "$R1")"
expect_n "in elenco è l'unica attiva" "$(active_ids "$A" | tr '\n' ' ')" "$P1 "

echo "Seconda scheda, con una già attiva"
R2="$(new_plan "$A")"
check "la seconda è creata e la risposta dice is_active 0" "$R2" '$status == 201 and (.plan.is_active | tonumber) == 0'
expect_n "la prima resta l'unica attiva" "$(active_ids "$A" | tr '\n' ' ')" "$P1 "

echo "Utente che ha cancellato tutte le schede"
call POST api/workout/delete_plan.php "$A" "{\"plan_id\":$P1}" >/dev/null
call POST api/workout/delete_plan.php "$A" "{\"plan_id\":$(plan_id "$R2")}" >/dev/null
R3="$(new_plan "$A")"
check "la nuova scheda nasce attiva" "$R3" '$status == 201 and (.plan.is_active | tonumber) == 1'
expect_n "è l'unica attiva" "$(active_ids "$A" | tr '\n' ' ')" "$(plan_id "$R3") "

echo "Utente con schede ma nessuna attiva"
new_account "fuB$SUFFIX"; B="$TOKEN"
RB1="$(new_plan "$B" '{"name":"Scheda ferma","is_active":0}')"
check "is_active 0 esplicito è rispettato anche senza schede attive" "$RB1" '$status == 201 and (.plan.is_active | tonumber) == 0'
expect_n "nessuna scheda attiva" "$(active_count "$B")" 0
RB2="$(new_plan "$B")"
check "senza is_active e senza nessuna attiva, la nuova nasce attiva" "$RB2" '$status == 201 and (.plan.is_active | tonumber) == 1'
expect_n "una sola attiva" "$(active_count "$B")" 1

echo "is_active 1 esplicito con un'altra già attiva"
RB3="$(new_plan "$B" '{"name":"Scheda scelta","is_active":1}')"
check "la scheda richiesta attiva è attiva" "$RB3" '$status == 201 and (.plan.is_active | tonumber) == 1'
expect_n "l'unica attiva è la nuova" "$(active_ids "$B" | tr '\n' ' ')" "$(plan_id "$RB3") "

echo "Creazioni contemporanee"
new_account "fuC$SUFFIX"; C="$TOKEN"
for i in 1 2 3 4 5 6; do
    new_plan "$C" "{\"name\":\"Parallela $i\"}" >/dev/null &
done
wait
expect_n "6 schede create" "$(body_of "$(call GET api/workout/read_plans.php "$C")" | jq '.records | length')" 6
expect_n "una sola attiva" "$(active_count "$C")" 1

echo "Creazioni e attivazioni contemporanee"
new_account "fuD$SUFFIX"; D="$TOKEN"
DP=()
for i in 1 2 3 4; do DP+=("$(plan_id "$(new_plan "$D" "{\"name\":\"Esistente $i\",\"is_active\":0}")")"); done
for i in 1 2 3 4; do
    new_plan "$D" "{\"name\":\"Nuova $i\"}" >/dev/null &
    call POST api/workout/activate_plan.php "$D" "{\"plan_id\":${DP[$((i - 1))]}}" >/dev/null &
done
wait
expect_n "8 schede" "$(body_of "$(call GET api/workout/read_plans.php "$D")" | jq '.records | length')" 8
expect_n "una sola attiva" "$(active_count "$D")" 1

echo "Modifica di una scheda con is_active 1"
new_account "fuE$SUFFIX"; E="$TOKEN"
EP1="$(plan_id "$(new_plan "$E")")"
EP2="$(plan_id "$(new_plan "$E")")"
check "update_plan con is_active 1 su una scheda non attiva risponde 200" \
    "$(call POST api/workout/update_plan.php "$E" "{\"plan_id\":$EP2,\"name\":\"Rinominata\",\"is_active\":1}")" '$status == 200'
expect_n "l'unica attiva è quella modificata" "$(active_ids "$E" | tr '\n' ' ')" "$EP2 "
call POST api/workout/update_plan.php "$E" "{\"plan_id\":$EP1,\"name\":\"Altra\",\"is_active\":0}" >/dev/null
expect_n "con is_active 0 su una non attiva resta attiva l'altra" "$(active_ids "$E" | tr '\n' ' ')" "$EP2 "
call POST api/workout/update_plan.php "$E" "{\"plan_id\":$EP2,\"name\":\"Spenta\",\"is_active\":0}" >/dev/null
expect_n "con is_active 0 la scheda si disattiva" "$(active_count "$E")" 0

echo "Storico"
new_account "fuH$SUFFIX"; H="$TOKEN"
check "utente nuovo: 200 con records []" "$(call GET api/workout_history/read.php "$H")" '$status == 200 and (.records | type) == "array" and (.records | length) == 0'
CAT="$(call GET api/exercise/read_all.php "$H")"
E1="$(echo "${CAT#* }" | jq -r '.records[0].id')"
HP="$(plan_id "$(new_plan "$H")")"
HD="$(call POST api/workout/create_days.php "$H" "{\"plan_id\":$HP,\"days\":[{\"name\":\"Giorno 1\"}]}" | cut -d' ' -f2- | jq -r '.days[0].id')"
call POST api/workout/add_exercise.php "$H" "{\"day_id\":$HD,\"exercise_id\":$E1,\"planned_sets\":[{\"set_number\":1,\"kind\":\"working\",\"reps_min\":10,\"reps_max\":10}],\"rest\":60}" >/dev/null
SAVE="$(call POST api/workout/record_workout.php "$H" "$(jq -nc --argjson e "$E1" --argjson d "$HD" --arg s "$(date -u -d '-30 min' +%Y-%m-%dT%H:%M:%SZ)" \
    '{workout_records:[{exercise_id:$e, day_id:$d, set_number:1, weight:20, reps:10}], start_time:$s, duration_seconds:1500}')")"
check "salvataggio di un allenamento" "$SAVE" '$status == 201'
check "storico pieno: 200 con 1 allenamento e i suoi esercizi" "$(call GET api/workout_history/read.php "$H")" \
    '$status == 200 and (.records | length) == 1 and (.records[0].exercises | length) == 1 and .message == null'

echo
if ((fails)); then printf '%d controlli su %d falliti.\n' "$fails" "$checks"; exit 1; fi
printf 'Tutti i %d controlli passano.\n' "$checks"
