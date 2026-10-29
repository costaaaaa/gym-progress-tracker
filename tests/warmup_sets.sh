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

echo "Scheda: warmup_sets"
check "warmup_sets fuori range (11): 400" \
    "$(call POST api/workout/add_exercise.php "$A" "{\"day_id\":$DAY,\"exercise_id\":$DEADLIFT,\"sets\":3,\"warmup_sets\":11,\"reps\":\"8\",\"rest\":90}")" \
    '$status == 400'
check "warmup_sets negativo: 400" \
    "$(call POST api/workout/add_exercise.php "$A" "{\"day_id\":$DAY,\"exercise_id\":$DEADLIFT,\"sets\":3,\"warmup_sets\":-1,\"reps\":\"8\",\"rest\":90}")" \
    '$status == 400'

R="$(call POST api/workout/add_exercise.php "$A" "{\"day_id\":$DAY,\"exercise_id\":$DEADLIFT,\"sets\":3,\"warmup_sets\":2,\"reps\":\"8\",\"rest\":90}")"
check "esercizio con warmup_sets=2: creato e restituito" "$R" '$status == 201 and .workout_exercise.warmup_sets == 2'
EX_ID="$(echo "${R#* }" | jq -r '.workout_exercise.id')"

check "read_plans: warmup_sets=2 nella scheda" "200 $(call GET api/workout/read_plans.php "$A" | cut -d' ' -f2-)" \
    ".records[0].days[0].exercises[0].warmup_sets == 2"

check "update_exercise con warmup_sets fuori range: 400" \
    "$(call POST api/workout/update_exercise.php "$A" "{\"day_id\":$DAY,\"exercise_id\":$EX_ID,\"sets\":3,\"warmup_sets\":20,\"reps\":\"8\",\"rest\":90}")" \
    '$status == 400'
check "update_exercise con warmup_sets=0: aggiornato" \
    "$(call POST api/workout/update_exercise.php "$A" "{\"day_id\":$DAY,\"exercise_id\":$EX_ID,\"sets\":3,\"warmup_sets\":0,\"reps\":\"8\",\"rest\":90}")" \
    '$status == 200'
check "read_plans: warmup_sets torna a 0" "200 $(call GET api/workout/read_plans.php "$A" | cut -d' ' -f2-)" \
    ".records[0].days[0].exercises[0].warmup_sets == 0"

R2="$(call POST api/workout/add_exercise.php "$A" "{\"day_id\":$DAY,\"exercise_id\":$DEADLIFT,\"sets\":3,\"reps\":\"8\",\"rest\":90}")"
check "warmup_sets assente: 0 (compatibilità client vecchi)" "$R2" '$status == 201 and .workout_exercise.warmup_sets == 0'

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
check "weekly_volume.total_weight == 500 (100kg x 5 x 3, non le 20kg x 10 x 2 di riscaldamento)" "$D" '.weekly_volume.total_weight == 500'

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
