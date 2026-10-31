#!/usr/bin/env bash
#
# warmup_sets.sh — controlla le serie di riscaldamento nella scheda e nell'allenamento (#66):
# warmup_sets si salva e si legge sulla scheda, con la validazione 0-10; le serie segnate
# is_warmup restano nello storico ma sono escluse da weekly_sets, volume settimanale,
# workout_stats/volume.php, record personali e volume a vita.
#
#   tests/warmup_sets.sh http://localhost:8080/backend/
#
# Registra un account usa e getta e lo cancella alla fine. Non va lanciato in produzione: crea
# account veri. Richiede curl e jq. Esce con 1 se un controllo fallisce.

set -uo pipefail

BASE="${1:?uso: $(basename "$0") <url del backend, es. http://localhost:8080/backend/>}"
[[ "$BASE" == */ ]] || BASE="$BASE/"

PASS='Prova!Warmup2026'
SUFFIX="$(date +%s | tail -c 7)$RANDOM"
fails=0
checks=0

ok() { checks=$((checks + 1)); printf '  \033[32m✓\033[0m %s\n' "$1"; }
ko() { checks=$((checks + 1)); fails=$((fails + 1)); printf '  \033[31m✗\033[0m %s\n' "$1"; [[ -n "${2:-}" ]] && printf '      %s\n' "$2"; }

call() { # metodo path token [json] → "status corpo"
    local method="$1" path="$2" token="$3" body="${4:-}"
    local out status
    out="$(mktemp)"
    local args=(-s -o "$out" -w '%{http_code}' -X "$method" -H 'Content-Type: application/json')
    [[ -n "$token" ]] && args+=(-H "Authorization: Bearer $token")
    [[ -n "$body" ]] && args+=(--data "$body")
    status="$(curl "${args[@]}" "$BASE$path")"
    printf '%s %s' "$status" "$(cat "$out")"
    rm -f "$out"
}

check() { # descrizione "risposta di call" filtro_jq (sul corpo; $status = codice HTTP)
    local status="${2%% *}"
    if echo "${2#* }" | jq -e --argjson status "$status" "$3" >/dev/null 2>&1; then ok "$1"; else ko "$1" "ricevuto: ${2:0:300}"; fi
}

register_and_login() {
    local user="$1"
    call POST api/user/register.php "" "$(jq -nc --arg u "$user" --arg e "$user@example.com" --arg p "$PASS" --arg b "$(date -d '-30 years' +%Y-%m-%d)" \
        '{username:$u, email:$e, password:$p, birth_date:$b, gender:"O", accept_terms:true}')" >/dev/null
    call POST api/user/mobile_login.php "" "$(jq -nc --arg u "$user" --arg p "$PASS" '{username:$u, password:$p, device_info:"warmup_sets.sh"}')" \
        | cut -d' ' -f2- | jq -r '.token // empty'
}

A="$(register_and_login "wuA$SUFFIX")"
[[ -n "$A" ]] || { echo "registrazione o login falliti (limite di registrazioni per IP?)" >&2; exit 1; }

cleanup() {
    call POST api/user/delete.php "$A" "$(jq -nc --arg p "$PASS" '{password:$p}')" >/dev/null
    echo "Account di prova cancellato."
}
trap cleanup EXIT

id_of() { call GET api/exercise/read_all.php "$A" | cut -d' ' -f2- | jq -r --arg n "$1" '.records[] | select(.name == $n) | .id' | head -n 1; }
DEADLIFT="$(id_of 'Stacco da Terra (Bilanciere)')"
[[ -n "$DEADLIFT" ]] || { echo "esercizio del catalogo non trovato" >&2; exit 1; }

plan="$(call POST api/workout/create_plan.php "$A" '{"name":"Scheda riscaldamento"}' | cut -d' ' -f2- | jq -r '.plan.id')"
call POST api/workout/activate_plan.php "$A" "{\"plan_id\":$plan}" >/dev/null
DAY="$(call POST api/workout/create_days.php "$A" "{\"plan_id\":$plan,\"days\":[{\"name\":\"Giorno 1\"}]}" | cut -d' ' -f2- | jq -r '.days[0].id')"

ps() { # riscaldamento allenanti ripetizioni → planned_sets (riscaldamento senza target, allenanti reps x reps)
    jq -nc --argjson w "$1" --argjson n "$2" --argjson r "$3" \
        '[range(1; $w + 1) | {set_number:., kind:"warmup"}] + [range($w + 1; $w + $n + 1) | {set_number:., kind:"working", reps_min:$r, reps_max:$r}]'
}
add_body() { jq -nc --argjson d "$DAY" --argjson e "$DEADLIFT" --argjson p "$1" '{day_id:$d, exercise_id:$e, planned_sets:$p, rest:90}'; }
upd_body() { jq -nc --argjson d "$DAY" --argjson w "$EX_ID" --argjson p "$1" '{day_id:$d, exercise_id:$w, planned_sets:$p, rest:90}'; }
plan_ex() { echo "200 $(call GET api/workout/read_plans.php "$A" | cut -d' ' -f2-)"; }

echo "Scheda: serie di riscaldamento in planned_sets"
check "11 serie di riscaldamento: 400" \
    "$(call POST api/workout/add_exercise.php "$A" "$(add_body "$(ps 11 3 8)")")" \
    '$status == 400'
check "riscaldamento dopo una serie allenante: 400" \
    "$(call POST api/workout/add_exercise.php "$A" "$(add_body '[{"set_number":1,"kind":"working","reps_min":8,"reps_max":8},{"set_number":2,"kind":"warmup"}]')")" \
    '$status == 400'
check "riscaldamento con un target di ripetizioni: 400" \
    "$(call POST api/workout/add_exercise.php "$A" "$(add_body '[{"set_number":1,"kind":"warmup","reps_min":10,"reps_max":10},{"set_number":2,"kind":"working","reps_min":8,"reps_max":8}]')")" \
    '$status == 400'

R="$(call POST api/workout/add_exercise.php "$A" "$(add_body "$(ps 2 3 8)")")"
check "esercizio con 2 serie di riscaldamento e 3 allenanti: creato e restituito" "$R" \
    '$status == 201 and ([.workout_exercise.planned_sets[] | .kind] == ["warmup","warmup","working","working","working"])'
EX_ID="$(echo "${R#* }" | jq -r '.workout_exercise.id')"

check "read_plans: 2 serie di riscaldamento senza target, poi 3 allenanti 8-8" "$(plan_ex)" \
    '.records[0].days[0].exercises[0].planned_sets == [
        {"set_number":1,"kind":"warmup","reps_min":null,"reps_max":null,"to_failure":false,"intensity_technique":null},
        {"set_number":2,"kind":"warmup","reps_min":null,"reps_max":null,"to_failure":false,"intensity_technique":null},
        {"set_number":3,"kind":"working","reps_min":8,"reps_max":8,"to_failure":false,"intensity_technique":null},
        {"set_number":4,"kind":"working","reps_min":8,"reps_max":8,"to_failure":false,"intensity_technique":null},
        {"set_number":5,"kind":"working","reps_min":8,"reps_max":8,"to_failure":false,"intensity_technique":null}]'

check "update_exercise con 20 serie di riscaldamento: 400" \
    "$(call POST api/workout/update_exercise.php "$A" "$(upd_body "$(ps 20 3 8)")")" \
    '$status == 400'
check "update_exercise senza riscaldamento: aggiornato" \
    "$(call POST api/workout/update_exercise.php "$A" "$(upd_body "$(ps 0 3 8)")")" \
    '$status == 200'
check "read_plans: nessuna serie di riscaldamento, 3 allenanti" "$(plan_ex)" \
    '.records[0].days[0].exercises[0].planned_sets | map(.kind) == ["working","working","working"]'

R2="$(call POST api/workout/add_exercise.php "$A" "$(add_body "$(ps 0 3 8)")")"
check "solo serie allenanti: nessun riscaldamento" "$R2" '$status == 201 and ([.workout_exercise.planned_sets[] | select(.kind == "warmup")] | length) == 0'

echo
echo "Allenamento: 2 serie di riscaldamento + 3 allenanti"
# 2 serie di riscaldamento (20kg x 10) + 3 allenanti (100kg x 5): il riscaldamento non deve
# contare in weekly_sets, volume, record né volume a vita
RECS="$(jq -nc --argjson d "$DAY" --argjson e "$DEADLIFT" '
    [range(1;3) | {exercise_id:$e, day_id:$d, set_number:., weight:20, reps:10, is_warmup:true}]
    + [range(3;6) | {exercise_id:$e, day_id:$d, set_number:., weight:100, reps:5}]')"
START="$(date -u -d '-30 min' +%Y-%m-%dT%H:%M:%SZ)"
RESP="$(call POST api/workout/record_workout.php "$A" "$(jq -nc --argjson r "$RECS" --arg s "$START" '{workout_records:$r, start_time:$s}')")"
check "allenamento salvato" "$RESP" '$status == 200 or $status == 201'

echo
echo "Dashboard: il riscaldamento non conta"
D="200 $(call GET api/workout_stats/dashboard.php "$A" | cut -d' ' -f2-)"
check "weekly_sets.week.glutei == 3 (solo le allenanti dello stacco)" "$D" '.weekly_sets.week.glutei == 3'
check "weekly_volume.total_weight == 1500 (100kg x 5 x 3, non le 20kg x 10 x 2 di riscaldamento)" "$D" '.weekly_volume.total_weight == 1500'

echo
echo "volume.php: solo le serie allenanti"
V="200 $(call GET api/workout_stats/volume.php "$A" | cut -d' ' -f2-)"
check "total_volume dell'allenamento == 1500 (100 x 5 x 3)" "$V" '.records[-1].total_volume == 1500'

echo
echo "Gamification: volume a vita senza il riscaldamento"
G="200 $(call GET api/gamification/profile.php "$A" | cut -d' ' -f2-)"
check "lifetime_volume_kg == 1500 (solo le serie allenanti, non le 400kg di riscaldamento)" "$G" '.lifetime_volume_kg == 1500'

echo
echo "Storico: le serie di riscaldamento restano visibili, segnate is_warmup"
H="200 $(call GET api/workout_history/read.php "$A" | cut -d' ' -f2-)"
check "5 serie nello storico (2 di riscaldamento + 3 allenanti)" "$H" '(.records[0].exercises[0].sets | length) == 5'
check "le prime 2 sono is_warmup true" "$H" '(.records[0].exercises[0].sets[0:2] | map(.is_warmup) | all)'
check "le altre 3 sono is_warmup false" "$H" '(.records[0].exercises[0].sets[2:5] | map(.is_warmup) | any) | not'

echo
if [[ $fails -eq 0 ]]; then echo "$checks controlli, 0 falliti"; else echo "$checks controlli, $fails falliti"; exit 1; fi
