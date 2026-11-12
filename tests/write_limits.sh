#!/usr/bin/env bash
#
# write_limits.sh — controlla i tetti sulle schede (50 per utente), sui giorni (14 per scheda) e
# sugli esercizi (30 per giorno), e il limite di 60 salvataggi di allenamento all'ora per utente.
#
#   tests/write_limits.sh http://localhost:8080/backend/
#
# Registra account usa e getta (token Bearer come l'app mobile) e li cancella alla fine.
# Non va lanciato in produzione: crea account veri. Il server di prova deve avere il limite di
# registrazioni per IP alzato (RL_REGISTER_MAX) e i limiti di salvataggio predefiniti
# (RL_WORKOUT_SAVE_USER_MAX = 60 in 3600 secondi).
#
# Richiede curl e jq. Esce con 1 se un controllo fallisce.

# I filtri jq stanno fra apici semplici di proposito: $status è una variabile di jq
# shellcheck disable=SC2016
set -uo pipefail

BASE="${1:?uso: $(basename "$0") <url del backend, es. http://localhost:8080/backend/>}"
[[ "$BASE" == */ ]] || BASE="$BASE/"

PASS='Prova!Limiti2026'
SUFFIX="$(date +%s | tail -c 7)$RANDOM"
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

check() { # descrizione "risposta di call" filtro_jq (sul corpo; $status è il codice HTTP)
    local status="${2%% *}"
    if echo "${2#* }" | jq -e --argjson status "$status" "$3" >/dev/null 2>&1; then ok "$1"; else ko "$1" "ricevuto: ${2:0:300}"; fi
}

register_and_login() {
    local user="$1"
    call POST api/user/register.php "" "$(jq -nc --arg u "$user" --arg e "$user@example.com" --arg p "$PASS" --arg b "$(date -d '-30 years' +%Y-%m-%d)" \
        '{username:$u, email:$e, password:$p, birth_date:$b, gender:"O", accept_terms:true}')" >/dev/null
    call POST api/user/mobile_login.php "" "$(jq -nc --arg u "$user" --arg p "$PASS" '{username:$u, password:$p, device_info:"write_limits.sh"}')" \
        | cut -d' ' -f2- | jq -r '.token // empty'
}

PL="$(register_and_login "wlP$SUFFIX")"  # schede
DY="$(register_and_login "wlD$SUFFIX")"  # giorni ed esercizi
SV="$(register_and_login "wlS$SUFFIX")"  # salvataggi (raggiunge il limite)
OT="$(register_and_login "wlO$SUFFIX")"  # salvataggi: l'altro utente
[[ -n "$PL" && -n "$DY" && -n "$SV" && -n "$OT" ]] || { echo "registrazione o login falliti (limite di registrazioni per IP?)" >&2; exit 1; }

cleanup() {
    for t in "$PL" "$DY" "$SV" "$OT"; do
        call POST api/user/delete.php "$t" "$(jq -nc --arg p "$PASS" '{password:$p}')" >/dev/null
    done
    echo "Account di prova cancellati."
}
trap cleanup EXIT

CAT="$(call GET api/exercise/read_all.php "$PL")"
E1="$(echo "${CAT#* }" | jq -r '.records[0].id')"

new_plan() { call POST api/workout/create_plan.php "$1" '{"name":"Scheda tetto"}'; }
plan_id() { body_of "$1" | jq -r '.plan.id'; }
days_json() { jq -nc --argjson n "$1" '[range(0;$n) | {name:"Giorno \(.+1)"}]'; }
new_days() { # token plan_id quanti
    call POST api/workout/create_days.php "$1" "$(jq -nc --argjson p "$2" --argjson d "$(days_json "$3")" '{plan_id:$p, days:$d}')"
}
new_exercise() { call POST api/workout/add_exercise.php "$1" "{\"day_id\":$2,\"exercise_id\":$E1,\"planned_sets\":[{\"set_number\":1,\"kind\":\"working\",\"reps_min\":10,\"reps_max\":10}],\"rest\":60}"; }
day_count() { # token plan_id → numero di giorni della scheda
    body_of "$(call GET api/workout/read_plans.php "$1")" | jq --argjson p "$2" '[.records[] | select(.id == $p)][0].days | length'
}
exercise_count() { # token plan_id → numero di esercizi della scheda
    body_of "$(call GET api/workout/read_plans.php "$1")" | jq --argjson p "$2" '[.records[] | select(.id == $p)][0].days | map(.exercises | length) | add'
}
plan_count() { body_of "$(call GET api/workout/read_plans.php "$1")" | jq '.records | length'; }

echo "Schede: 50 per utente"
FIRST_PLAN=""
last=""
for _ in $(seq 1 50); do
    last="$(new_plan "$PL")"
    [[ -z "$FIRST_PLAN" ]] && FIRST_PLAN="$(plan_id "$last")"
    [[ "${last%% *}" == 201 ]] || break
done
check "la 50ª scheda è creata" "$last" '$status == 201 and .plan.id != null'
check "50 schede in elenco" "200 {\"n\": $(plan_count "$PL")}" '.n == 50'
check "la 51ª è 409 too_many_plans, con il massimo nel messaggio" "$(new_plan "$PL")" \
    '$status == 409 and .success == false and .code == "too_many_plans" and (.message | contains("50"))'
check "ancora 50 schede" "200 {\"n\": $(plan_count "$PL")}" '.n == 50'
check "un altro utente non è toccato dal tetto" "$(new_plan "$DY")" '$status == 201'
call POST api/workout/delete_plan.php "$PL" "{\"plan_id\":$FIRST_PLAN}" >/dev/null
check "dopo averne cancellata una se ne può creare un'altra" "$(new_plan "$PL")" '$status == 201'
check "e la successiva è di nuovo 409" "$(new_plan "$PL")" '$status == 409 and .code == "too_many_plans"'

echo "Giorni: 14 per scheda"
PLAN="$(plan_id "$(new_plan "$DY")")"
check "3 giorni su scheda vuota: creati" "$(new_days "$DY" "$PLAN" 3)" '$status == 201 and (.days | length) == 3'
check "3 presenti + 12 nuovi: 409 too_many_days, con il massimo nel messaggio" "$(new_days "$DY" "$PLAN" 12)" \
    '$status == 409 and .success == false and .code == "too_many_days" and (.message | contains("14"))'
check "nessun giorno creato a metà (restano 3)" "200 {\"n\": $(day_count "$DY" "$PLAN")}" '.n == 3'
check "3 presenti + 11 nuovi: creati (14)" "$(new_days "$DY" "$PLAN" 11)" '$status == 201 and (.days | length) == 11'
check "14 giorni in scheda" "200 {\"n\": $(day_count "$DY" "$PLAN")}" '.n == 14'
check "il 15° è 409 too_many_days" "$(new_days "$DY" "$PLAN" 1)" '$status == 409 and .code == "too_many_days"'
PLAN2="$(plan_id "$(new_plan "$DY")")"
check "15 giorni in una volta su scheda vuota: 409" "$(new_days "$DY" "$PLAN2" 15)" '$status == 409 and .code == "too_many_days"'
check "nessun giorno creato" "200 {\"n\": $(day_count "$DY" "$PLAN2")}" '.n == 0'
check "14 giorni in una volta su scheda vuota: creati" "$(new_days "$DY" "$PLAN2" 14)" '$status == 201 and (.days | length) == 14'
check "il tetto è per scheda: un'altra scheda ha i suoi 14" "$(new_days "$DY" "$(plan_id "$(new_plan "$DY")")" 14)" '$status == 201'

echo "Esercizi: 30 per giorno"
DAYS="$(body_of "$(call GET api/workout/read_plans.php "$DY")" | jq -r --argjson p "$PLAN" '[.records[] | select(.id == $p)][0].days | map(.id) | .[]')"
DAY1="$(echo "$DAYS" | sed -n 1p)"
DAY2="$(echo "$DAYS" | sed -n 2p)"
last=""
for _ in $(seq 1 30); do
    last="$(new_exercise "$DY" "$DAY1")"
    [[ "${last%% *}" == 201 ]] || break
done
check "il 30° esercizio è aggiunto" "$last" '$status == 201'
check "30 esercizi nel giorno" "200 {\"n\": $(exercise_count "$DY" "$PLAN")}" '.n == 30'
check "il 31° è 409 too_many_plan_exercises, con il massimo nel messaggio" "$(new_exercise "$DY" "$DAY1")" \
    '$status == 409 and .success == false and .code == "too_many_plan_exercises" and (.message | contains("30"))'
check "ancora 30 esercizi" "200 {\"n\": $(exercise_count "$DY" "$PLAN")}" '.n == 30'
check "il tetto è per giorno: un altro giorno accetta esercizi" "$(new_exercise "$DY" "$DAY2")" '$status == 201'

echo "Salvataggi: 60 all'ora per utente"
make_day() { # token → id di un giorno con E1
    local plan day
    plan="$(plan_id "$(new_plan "$1")")"
    day="$(body_of "$(new_days "$1" "$plan" 1)" | jq -r '.days[0].id')"
    new_exercise "$1" "$day" >/dev/null
    echo "$day"
}
save() { # token day → "status corpo"
    call POST api/workout/record_workout.php "$1" "$(jq -nc --argjson e "$E1" --argjson d "$2" \
        '{workout_records:[{exercise_id:$e, day_id:$d, set_number:1, weight:20, reps:10}]}')"
}
DAY_S="$(make_day "$SV")"
DAY_O="$(make_day "$OT")"
last=""
for _ in $(seq 1 60); do
    last="$(save "$SV" "$DAY_S")"
    [[ "${last%% *}" == 201 ]] || break
done
check "il 60° salvataggio va" "$last" '$status == 201 and .success'
LIMITED="$(curl -s -D - -o /dev/null -X POST -H 'Content-Type: application/json' -H "Authorization: Bearer $SV" \
    --data "$(jq -nc --argjson e "$E1" --argjson d "$DAY_S" '{workout_records:[{exercise_id:$e, day_id:$d, set_number:1, weight:20, reps:10}]}')" \
    "${BASE}api/workout/record_workout.php" | tr -d '\r')"
if [[ "$LIMITED" == HTTP*" 429"* ]] && grep -qiE '^retry-after: [0-9]+$' <<<"$LIMITED"; then
    ok "il 61° è 429 con Retry-After"
else
    ko "il 61° è 429 con Retry-After" "ricevuto: ${LIMITED:0:300}"
fi
check "il 61° non salva niente (60 in storico)" "200 $(call GET api/workout_history/read.php "$SV" | cut -d' ' -f2- | jq -c '{n: (.records | length)}')" '.n == 60'
check "un altro utente salva lo stesso" "$(save "$OT" "$DAY_O")" '$status == 201 and .success'

echo
if [[ $fails -eq 0 ]]; then printf '\033[32mTutti i %d controlli passati.\033[0m\n' "$checks"; else printf '\033[31m%d controlli su %d falliti.\033[0m\n' "$fails" "$checks"; exit 1; fi
