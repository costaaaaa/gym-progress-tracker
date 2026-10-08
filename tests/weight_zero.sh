#!/usr/bin/env bash
#
# weight_zero.sh — controlla il peso a 0 (corpo libero, macchinari senza carico) e i limiti dei
# set di record_workout.php.
#
#   tests/weight_zero.sh http://localhost:8080/backend/
#
# Regole: una serie con peso 0 e ripetizioni vale per XP di esercizio e PR; a peso 0 il record
# è sulle ripetizioni, con zavorra su peso e 1RM. Peso fuori da 0..999,99, ripetizioni vuote e
# set_number non valido rispondono 400; serie/ripetizioni/recupero di un esercizio in scheda e
# data di inizio allenamento fuori range pure. Registra un account usa e getta (token Bearer) e lo
# cancella alla fine. Non va lanciato in produzione: crea account veri.
#
# Richiede curl e jq. Esce con 1 se un controllo fallisce.

set -uo pipefail

BASE="${1:?uso: $(basename "$0") <url del backend, es. http://localhost:8080/backend/>}"
[[ "$BASE" == */ ]] || BASE="$BASE/"

PASS='Prova!WeightZero2026'
SUFFIX="$(date +%s | tail -c 7)$RANDOM"
fails=0
checks=0

ok() { checks=$((checks + 1)); printf '  \033[32m✓\033[0m %s\n' "$1"; }
ko() { checks=$((checks + 1)); fails=$((fails + 1)); printf '  \033[31m✗\033[0m %s\n' "$1"; [[ -n "${2:-}" ]] && printf '      %s\n' "$2"; }

call() { # metodo path token [json] → "status corpo"
    local method="$1" path="$2" token="$3" body="${4:-}"
    local args=(-s -o /tmp/weight_zero.$$ -w '%{http_code}' -X "$method" -H 'Content-Type: application/json')
    [[ -n "$token" ]] && args+=(-H "Authorization: Bearer $token")
    [[ -n "$body" ]] && args+=(--data "$body")
    local status
    status="$(curl "${args[@]}" "$BASE$path")"
    printf '%s %s' "$status" "$(cat /tmp/weight_zero.$$)"
    rm -f /tmp/weight_zero.$$
}

# xpg = XP guadagnati senza il bonus streak (30 alla 3ª sessione della settimana)
JQ_DEFS='def xpg: .xp_gained - (if .week_completed_now then 30 else 0 end);'

check() { # descrizione "risposta di call" filtro_jq
    if echo "${2#* }" | jq -e "$JQ_DEFS $3" >/dev/null 2>&1; then ok "$1"; else ko "$1" "ricevuto: ${2:0:300}"; fi
}

status_is() { # descrizione "risposta di call" status
    if [[ "${2%% *}" == "$3" ]]; then ok "$1"; else ko "$1" "ricevuto: ${2:0:300}"; fi
}

USER="wz$SUFFIX"
call POST api/user/register.php "" "$(jq -nc --arg u "$USER" --arg e "$USER@example.com" --arg p "$PASS" --arg b "$(date -d '-30 years' +%Y-%m-%d)" \
    '{username:$u, email:$e, password:$p, birth_date:$b, gender:"O", accept_terms:true}')" >/dev/null
T="$(call POST api/user/mobile_login.php "" "$(jq -nc --arg u "$USER" --arg p "$PASS" '{username:$u, password:$p, device_info:"weight_zero.sh"}')" \
    | cut -d' ' -f2- | jq -r '.token // empty')"
[[ -n "$T" ]] || { echo "registrazione o login falliti (limite di registrazioni per IP?)" >&2; exit 1; }

cleanup() {
    call POST api/user/delete.php "$T" "$(jq -nc --arg p "$PASS" '{password:$p}')" >/dev/null
    echo "Account di prova cancellato."
}
trap cleanup EXIT

E1="$(call GET api/exercise/read_all.php "$T" | cut -d' ' -f2- | jq -r '.records[0].id')"
PLAN="$(call POST api/workout/create_plan.php "$T" '{"name":"Scheda peso 0"}' | cut -d' ' -f2- | jq -r '.plan.id')"
DAY="$(call POST api/workout/create_days.php "$T" "{\"plan_id\":$PLAN,\"days\":[{\"name\":\"Giorno 1\"}]}" | cut -d' ' -f2- | jq -r '.days[0].id')"
call POST api/workout/add_exercise.php "$T" "{\"day_id\":$DAY,\"exercise_id\":$E1,\"sets\":2,\"reps\":\"10\",\"rest\":60}" >/dev/null

body() { # peso ripetizioni  (due serie, sessione iniziata 25 minuti fa)
    jq -nc --argjson e "$E1" --argjson d "$DAY" --argjson w "$1" --arg r "$2" --arg s "$(date -u -d '-25 min' +%Y-%m-%dT%H:%M:%SZ)" \
        '{workout_records:[range(1;3) as $i | {exercise_id:$e, day_id:$d, set_number:$i, weight:$w, reps:$r}], start_time:$s}'
}

echo "Peso a 0"
check "1ª sessione a peso 0: salvata, 20 XP, volume 0" "$(call POST api/workout/record_workout.php "$T" "$(body 0 8)")" \
    '.success and .sets_saved == 2 and .xp_session_awarded == true and xpg == 20 and .session_volume_kg == 0'
check "più ripetizioni a peso 0: PR sulle ripetizioni (15 XP)" "$(call POST api/workout/record_workout.php "$T" "$(body 0 10)")" \
    'xpg == 15'
check "stesse ripetizioni: nessun PR" "$(call POST api/workout/record_workout.php "$T" "$(body 0 10)")" \
    'xpg == 0'
check "con zavorra (5 kg): PR di peso (15 XP)" "$(call POST api/workout/record_workout.php "$T" "$(body 5 6)")" \
    'xpg == 15 and .session_volume_kg == 60'
check "XP di esercizio: 10 + 15 + 15 = 40, livello 2" "$(call GET api/gamification/profile.php "$T")" \
    "[.exercises[] | select(.exercise_id == $E1)][0] | (.xp | tonumber) == 40 and (.level | tonumber) == 2"

echo "Limiti dei set"
status_is "peso 999,99 accettato" "$(call POST api/workout/record_workout.php "$T" "$(body 999.99 1)")" 201
status_is "peso 1000: 400" "$(call POST api/workout/record_workout.php "$T" "$(body 1000 8)")" 400
status_is "peso negativo: 400" "$(call POST api/workout/record_workout.php "$T" "$(body -1 8)")" 400
status_is "peso null: 400" "$(call POST api/workout/record_workout.php "$T" "$(body null 8)")" 400
status_is "ripetizioni vuote: 400" "$(call POST api/workout/record_workout.php "$T" "$(body 20 '')")" 400
status_is "set_number 0: 400" "$(call POST api/workout/record_workout.php "$T" \
    "$(jq -nc --argjson e "$E1" --argjson d "$DAY" '{workout_records:[{exercise_id:$e, day_id:$d, set_number:0, weight:20, reps:"8"}]}')")" 400

echo "Parametri dell'esercizio e data di inizio"
ex() { # serie ripetizioni recupero → corpo per add_exercise
    jq -nc --argjson d "$DAY" --argjson e "$E1" --argjson s "$1" --arg r "$2" --argjson t "$3" \
        '{day_id:$d, exercise_id:$e, sets:$s, reps:$r, rest:$t}'
}
status_is "recupero 0 accettato" "$(call POST api/workout/add_exercise.php "$T" "$(ex 3 10 0)")" 201
WE="$(call POST api/workout/add_exercise.php "$T" "$(ex 3 10 60)" | cut -d' ' -f2- | jq -r '.workout_exercise.id')"
status_is "serie 0: 400" "$(call POST api/workout/add_exercise.php "$T" "$(ex 0 10 60)")" 400
status_is "serie 21: 400" "$(call POST api/workout/add_exercise.php "$T" "$(ex 21 10 60)")" 400
status_is "recupero negativo: 400" "$(call POST api/workout/add_exercise.php "$T" "$(ex 3 10 -1)")" 400
status_is "ripetizioni oltre 20 caratteri: 400" "$(call POST api/workout/add_exercise.php "$T" "$(ex 3 123456789012345678901 60)")" 400
status_is "update con recupero 0 accettato" "$(call POST api/workout/update_exercise.php "$T" "$(jq -nc --argjson d "$DAY" --argjson w "$WE" '{day_id:$d, exercise_id:$w, sets:4, reps:"8-10", rest:0}')")" 200
status_is "update con serie 0: 400" "$(call POST api/workout/update_exercise.php "$T" "$(jq -nc --argjson d "$DAY" --argjson w "$WE" '{day_id:$d, exercise_id:$w, sets:0, reps:"8", rest:60}')")" 400
reg() { # data di inizio → "status corpo" della registrazione; l'account creato viene cancellato subito
    local u="wz${SUFFIX}r$RANDOM" r
    r="$(call POST api/user/register.php "" "$(jq -nc --arg u "$u" --arg e "$u@example.com" --arg p "$PASS" --arg b "$(date -d '-30 years' +%Y-%m-%d)" --arg t "$1" \
        '{username:$u, email:$e, password:$p, birth_date:$b, gender:"O", accept_terms:true, training_start_date:$t}')")"
    if [[ "${r%% *}" == 201 ]]; then
        local t2
        t2="$(call POST api/user/mobile_login.php "" "$(jq -nc --arg u "$u" --arg p "$PASS" '{username:$u, password:$p}')" | cut -d' ' -f2- | jq -r '.token // empty')"
        call POST api/user/delete.php "$t2" "$(jq -nc --arg p "$PASS" '{password:$p}')" >/dev/null
    fi
    echo "$r"
}
status_is "registrazione con mese 13: 400" "$(reg 2026-13-01)" 400
status_is "registrazione con data futura: 400" "$(reg "$(date -d '+1 year' +%Y-%m-%d)")" 400
status_is "registrazione con data valida: 201" "$(reg 2024-03-01)" 201

echo
if [[ $fails -eq 0 ]]; then printf '\033[32mTutti i %d controlli passati.\033[0m\n' "$checks"; else printf '\033[31m%d controlli su %d falliti.\033[0m\n' "$fails" "$checks"; exit 1; fi
