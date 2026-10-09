#!/usr/bin/env bash
#
# retro_workout.sh — controlla il salvataggio di una sessione recuperata (bozza ripresa in ritardo)
# in record_workout.php: data scelta, durata dall'ultimo set, limite di 7 giorni, PR in ordine di data.
#
#   tests/retro_workout.sh http://localhost:8080/backend/
#
# Registra un account usa e getta (token Bearer) e lo cancella alla fine.
# Non va lanciato in produzione: crea account veri.
#
# Richiede curl, jq e date GNU. Esce con 1 se un controllo fallisce.

set -uo pipefail

BASE="${1:?uso: $(basename "$0") <url del backend, es. http://localhost:8080/backend/>}"
[[ "$BASE" == */ ]] || BASE="$BASE/"

PASS='Prova!Retro2026'
SUFFIX="$(date +%s | tail -c 7)$RANDOM"
fails=0
checks=0

ok() { checks=$((checks + 1)); printf '  \033[32m✓\033[0m %s\n' "$1"; }
ko() { checks=$((checks + 1)); fails=$((fails + 1)); printf '  \033[31m✗\033[0m %s\n' "$1"; [[ -n "${2:-}" ]] && printf '      %s\n' "$2"; }

call() { # metodo path token [json] → "status corpo"
    local method="$1" path="$2" token="$3" body="${4:-}"
    local args=(-s -o /tmp/retro_workout.$$ -w '%{http_code}' -X "$method" -H 'Content-Type: application/json')
    [[ -n "$token" ]] && args+=(-H "Authorization: Bearer $token")
    [[ -n "$body" ]] && args+=(--data "$body")
    local status
    status="$(curl "${args[@]}" "$BASE$path")"
    printf '%s %s' "$status" "$(cat /tmp/retro_workout.$$)"
    rm -f /tmp/retro_workout.$$
}

check() { # descrizione "risposta di call" filtro_jq
    if echo "${2#* }" | jq -e "$3" >/dev/null 2>&1; then ok "$1"; else ko "$1" "ricevuto: ${2:0:300}"; fi
}

USER="retro$SUFFIX"
call POST api/user/register.php "" "$(jq -nc --arg u "$USER" --arg e "$USER@example.com" --arg p "$PASS" --arg b "$(date -d '-30 years' +%Y-%m-%d)" \
    '{username:$u, email:$e, password:$p, birth_date:$b, gender:"O", accept_terms:true}')" >/dev/null
T="$(call POST api/user/mobile_login.php "" "$(jq -nc --arg u "$USER" --arg p "$PASS" '{username:$u, password:$p, device_info:"retro_workout.sh"}')" \
    | cut -d' ' -f2- | jq -r '.token // empty')"
[[ -n "$T" ]] || { echo "registrazione o login falliti (limite di registrazioni per IP?)" >&2; exit 1; }

cleanup() {
    call POST api/user/delete.php "$T" "$(jq -nc --arg p "$PASS" '{password:$p}')" >/dev/null
    echo "Account di prova cancellato."
}
trap cleanup EXIT

CAT="$(call GET api/exercise/read_all.php "$T")"
E1="$(echo "${CAT#* }" | jq -r '.records[0].id')"
PLAN="$(call POST api/workout/create_plan.php "$T" '{"name":"Scheda retro"}' | cut -d' ' -f2- | jq -r '.plan.id')"
DAY="$(call POST api/workout/create_days.php "$T" "{\"plan_id\":$PLAN,\"days\":[{\"name\":\"Giorno 1\"}]}" | cut -d' ' -f2- | jq -r '.days[0].id')"
call POST api/workout/add_exercise.php "$T" "{\"day_id\":$DAY,\"exercise_id\":$E1,\"sets\":3,\"reps\":\"10\",\"rest\":60}" >/dev/null

iso() { date -u -d "$1" +%Y-%m-%dT%H:%M:%SZ; }

# body peso start_time [ended_at] [backdated]
body() {
    local recs='[]' i
    for i in 1 2 3; do recs="$(jq -c --argjson e "$E1" --argjson d "$DAY" --argjson i "$i" --argjson w "$1" '. + [{exercise_id:$e, day_id:$d, set_number:$i, weight:$w, reps:10}]' <<<"$recs")"; done
    jq -nc --argjson r "$recs" --arg s "$2" --arg e "${3:-}" --argjson b "${4:-false}" \
        '{workout_records:$r, start_time:$s} + (if $e != "" then {ended_at:$e} else {} end) + (if $b then {backdated:true} else {} end)'
}

echo "Sessione recuperata (utente di prova)"
S2="$(iso '2 days ago')"; E2="$(iso '2 days ago + 30 min')"
check "2 giorni fa con ended_at: durata 1800 s e XP di sessione" \
    "$(call POST api/workout/record_workout.php "$T" "$(body 20 "$S2" "$E2" true)")" \
    '.success and .duration_seconds == 1800 and .xp_session_awarded == true'

HIST="$(call GET api/workout_history/read.php "$T")"
WANT="$(date -u -d '2 days ago' +%Y-%m-%d)"
check "la data in storico è quella scelta, non il salvataggio" "$HIST" \
    "[.records[] | select(.duration_seconds == 1800)][0].date | startswith(\"$WANT\")"

S3="$(iso '3 days ago')"
check "senza backdated, start_time vecchio: oggi e senza durata (comportamento invariato)" \
    "$(call POST api/workout/record_workout.php "$T" "$(body 20 "$S3" "$(iso '3 days ago + 30 min')")")" \
    '.success and .duration_seconds == null and .xp_session_reason == "too_short"'

check "backdated senza ended_at: durata ignota, niente XP" \
    "$(call POST api/workout/record_workout.php "$T" "$(body 20 "$(iso '4 days ago')" "" true)")" \
    '.success and .duration_seconds == null and .xp_session_awarded == false'

check "backdated oltre 8 giorni: 400" \
    "$(call POST api/workout/record_workout.php "$T" "$(body 20 "$(iso '10 days ago')" "$(iso '10 days ago + 30 min')" true)")" \
    'has("success") and .success == false'

echo "PR in ordine di data (utente di prova)"
check "peso 30 su una data precedente allo storico (20 kg): nessun PR, solo i 20 XP di sessione" \
    "$(call POST api/workout/record_workout.php "$T" "$(body 30 "$(iso '6 days ago')" "$(iso '6 days ago + 30 min')" true)")" \
    '.success and (.xp_gained - (if .week_completed_now then 30 else 0 end)) == 20'

echo
if [[ $fails -eq 0 ]]; then printf '\033[32mTutti i %d controlli passati.\033[0m\n' "$checks"; else printf '\033[31m%d controlli su %d falliti.\033[0m\n' "$fails" "$checks"; exit 1; fi
