#!/usr/bin/env bash
#
# primary_muscle.sh — controlla il muscolo principale (#64): obbligatorio per un esercizio
# personale "gambe", ricavato dal gruppo negli altri casi, e usato da dashboard.php per le serie
# (weekly_sets) e il recupero al posto di muscle_group.
#
#   tests/primary_muscle.sh http://localhost:8080/backend/
#
# Registra un account usa e getta e lo cancella alla fine. Non va lanciato in produzione: crea
# account veri. Richiede curl e jq. Esce con 1 se un controllo fallisce.

set -uo pipefail

BASE="${1:?uso: $(basename "$0") <url del backend, es. http://localhost:8080/backend/>}"
[[ "$BASE" == */ ]] || BASE="$BASE/"

PASS='Prova!Muscle2026'
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
    call POST api/user/mobile_login.php "" "$(jq -nc --arg u "$user" --arg p "$PASS" '{username:$u, password:$p, device_info:"primary_muscle.sh"}')" \
        | cut -d' ' -f2- | jq -r '.token // empty'
}

A="$(register_and_login "pmA$SUFFIX")"
[[ -n "$A" ]] || { echo "registrazione o login falliti (limite di registrazioni per IP?)" >&2; exit 1; }

cleanup() {
    call POST api/user/delete.php "$A" "$(jq -nc --arg p "$PASS" '{password:$p}')" >/dev/null
    echo "Account di prova cancellato."
}
trap cleanup EXIT

create() { call POST api/exercise/create.php "$A" "$1"; }

echo "Esercizio personale"
check "gambe senza muscolo principale: 400" "$(create "{\"name\":\"Gambe senza $SUFFIX\",\"muscle_group\":\"gambe\"}")" \
    '$status == 400 and .code == "invalid_primary_muscle"'
check "gambe con un muscolo non ammesso: 400" "$(create "{\"name\":\"Gambe petto $SUFFIX\",\"muscle_group\":\"gambe\",\"primary_muscle\":\"petto\"}")" \
    '$status == 400 and .code == "invalid_primary_muscle"'
check "petto con femorali: 400" "$(create "{\"name\":\"Petto femorali $SUFFIX\",\"muscle_group\":\"petto\",\"primary_muscle\":\"femorali\"}")" \
    '$status == 400 and .code == "invalid_primary_muscle"'
check "petto senza muscolo principale: creato" "$(create "{\"name\":\"Petto $SUFFIX\",\"muscle_group\":\"petto\"}")" '$status == 201'
R="$(create "{\"name\":\"Gambe femorali $SUFFIX\",\"muscle_group\":\"gambe\",\"primary_muscle\":\"femorali\"}")"
check "gambe con femorali: creato" "$R" '$status == 201'
CUSTOM="$(echo "${R#* }" | jq -r '.exercise.id')"

id_of() { call GET api/exercise/read_all.php "$A" | cut -d' ' -f2- | jq -r --arg n "$1" '.records[] | select(.name == $n) | .id' | head -n 1; }
DEADLIFT="$(id_of 'Stacco da Terra (Bilanciere)')"
ADDUCTOR="$(id_of 'Adductor Machine')"
[[ -n "$DEADLIFT" && -n "$ADDUCTOR" && -n "$CUSTOM" ]] || { echo "esercizi del catalogo non trovati" >&2; exit 1; }

# Scheda di un giorno con i tre esercizi (senza premium si salvano solo esercizi del giorno)
plan="$(call POST api/workout/create_plan.php "$A" '{"name":"Scheda muscoli"}' | cut -d' ' -f2- | jq -r '.plan.id')"
call POST api/workout/activate_plan.php "$A" "{\"plan_id\":$plan}" >/dev/null
DAY="$(call POST api/workout/create_days.php "$A" "{\"plan_id\":$plan,\"days\":[{\"name\":\"Giorno 1\"}]}" | cut -d' ' -f2- | jq -r '.days[0].id')"
for e in "$DEADLIFT" "$ADDUCTOR" "$CUSTOM"; do
    call POST api/workout/add_exercise.php "$A" "{\"day_id\":$DAY,\"exercise_id\":$e,\"sets\":3,\"reps\":\"8\",\"rest\":90}" >/dev/null
done

# 3 serie di stacco, 2 di adductor, 2 dell'esercizio personale femorali
RECS="$(jq -nc --argjson d "$DAY" --argjson s "$DEADLIFT" --argjson a "$ADDUCTOR" --argjson c "$CUSTOM" \
    '[range(1;4) | {exercise_id:$s, day_id:$d, set_number:., weight:100, reps:5}]
     + [range(1;3) | {exercise_id:$a, day_id:$d, set_number:., weight:40, reps:12}]
     + [range(1;3) | {exercise_id:$c, day_id:$d, set_number:., weight:30, reps:10}]')"
check "allenamento salvato" "$(call POST api/workout/record_workout.php "$A" "$(jq -nc --argjson r "$RECS" --arg s "$(date -u -d '-40 min' +%Y-%m-%dT%H:%M:%SZ)" '{workout_records:$r, start_time:$s}')")" \
    '$status == 200 or $status == 201'

echo
echo "Dashboard"
D="200 $(call GET api/workout_stats/dashboard.php "$A" | cut -d' ' -f2-)"
check "weekly_sets.week ha le 12 chiavi dei muscoli contati" "$D" '(.weekly_sets.week | keys | length) == 12'
check "stacco da terra: 3 serie sui glutei" "$D" '.weekly_sets.week.glutei == 3'
check "adductor machine: 2 serie sugli adduttori" "$D" '.weekly_sets.week.adduttori == 2'
check "gambe personale femorali: 2 serie sui femorali" "$D" '.weekly_sets.week.femorali == 2'
check "niente sui quadricipiti (gambe non vale più quadricipiti)" "$D" '.weekly_sets.week.quadricipiti == 0'
check "recupero: glutei, adduttori e femorali allenati" "$D" \
    '.recovery.glutei.last_trained != null and .recovery.adduttori.last_trained != null and .recovery.femorali.last_trained != null'
check "recupero: abduttori presente e mai allenato" "$D" '.recovery.abduttori.last_trained == null and .recovery.abduttori.status == "PRONTO"'
check "recupero: quadricipiti non allenati" "$D" '.recovery.quadricipiti.last_trained == null'

echo
if [[ $fails -eq 0 ]]; then echo "$checks controlli, 0 falliti"; else echo "$checks controlli, $fails falliti"; exit 1; fi
