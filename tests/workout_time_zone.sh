#!/usr/bin/env bash
#
# workout_time_zone.sh — controlla che record_workout.php salvi l'orario dell'allenamento come ora
# locale del suo fuso e non in UTC, per start_time e per ended_at mandati con la "Z" finale. Il test
# non manda X-Timezone né time_zone, quindi il fuso è il ripiego Europe/Rome; il comportamento con un
# fuso scelto dal dispositivo è in time_zone.sh.
#
#   tests/workout_time_zone.sh http://localhost:8080/backend/
#
# Registra un account usa e getta (token Bearer) e lo cancella alla fine.
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

ok() { checks=$((checks + 1)); printf '  \033[32m✓\033[0m %s\n' "$1"; }
ko() { checks=$((checks + 1)); fails=$((fails + 1)); printf '  \033[31m✗\033[0m %s\n' "$1"; [[ -n "${2:-}" ]] && printf '      %s\n' "$2"; }

call() { # metodo path token [json] → "status corpo"
    local method="$1" path="$2" token="$3" body="${4:-}"
    local args=(-s -o /tmp/workout_time_zone.$$ -w '%{http_code}' -X "$method" -H 'Content-Type: application/json')
    [[ -n "$token" ]] && args+=(-H "Authorization: Bearer $token")
    [[ -n "$body" ]] && args+=(--data "$body")
    local status
    status="$(curl "${args[@]}" "$BASE$path")"
    printf '%s %s' "$status" "$(cat /tmp/workout_time_zone.$$)"
    rm -f /tmp/workout_time_zone.$$
}

check() { # descrizione "risposta di call" filtro_jq
    if echo "${2#* }" | jq -e "$3" >/dev/null 2>&1; then ok "$1"; else ko "$1" "ricevuto: ${2:0:300}"; fi
}

USER="fuso$SUFFIX"
call POST api/user/register.php "" "$(jq -nc --arg u "$USER" --arg e "$USER@example.com" --arg p "$PASS" --arg b "$(date -d '-30 years' +%Y-%m-%d)" \
    '{username:$u, email:$e, password:$p, birth_date:$b, gender:"O", accept_terms:true}')" >/dev/null
T="$(call POST api/user/mobile_login.php "" "$(jq -nc --arg u "$USER" --arg p "$PASS" '{username:$u, password:$p, device_info:"workout_time_zone.sh"}')" \
    | cut -d' ' -f2- | jq -r '.token // empty')"
[[ -n "$T" ]] || { echo "registrazione o login falliti (limite di registrazioni per IP?)" >&2; exit 1; }

cleanup() {
    call POST api/user/delete.php "$T" "$(jq -nc --arg p "$PASS" '{password:$p}')" >/dev/null
    echo "Account di prova cancellato."
}
trap cleanup EXIT

CAT="$(call GET api/exercise/read_all.php "$T")"
E1="$(echo "${CAT#* }" | jq -r '.records[0].id')"
PLAN="$(call POST api/workout/create_plan.php "$T" '{"name":"Scheda fuso"}' | cut -d' ' -f2- | jq -r '.plan.id')"
DAY="$(call POST api/workout/create_days.php "$T" "{\"plan_id\":$PLAN,\"days\":[{\"name\":\"Giorno 1\"}]}" | cut -d' ' -f2- | jq -r '.days[0].id')"
call POST api/workout/add_exercise.php "$T" "{\"day_id\":$DAY,\"exercise_id\":$E1,\"sets\":3,\"reps\":\"10\",\"rest\":60}" >/dev/null

iso() { date -u -d "@$1" +%Y-%m-%dT%H:%M:%S.000Z; }
rome() { TZ=Europe/Rome date -d "@$1" '+%Y-%m-%d %H:%M:%S'; }

# body peso start_time [ended_at] [backdated]
body() {
    local recs='[]' i
    for i in 1 2 3; do recs="$(jq -c --argjson e "$E1" --argjson d "$DAY" --argjson i "$i" --argjson w "$1" '. + [{exercise_id:$e, day_id:$d, set_number:$i, weight:$w, reps:10}]' <<<"$recs")"; done
    jq -nc --argjson r "$recs" --arg s "$2" --arg e "${3:-}" --argjson b "${4:-false}" \
        '{workout_records:$r, start_time:$s} + (if $e != "" then {ended_at:$e} else {} end) + (if $b then {backdated:true} else {} end)'
}

stored_date() { # id → data in storico
    call GET api/workout_history/read.php "$T" | cut -d' ' -f2- | jq -r --argjson id "$1" '[.records[] | select(.id == $id)][0].date // empty'
}

echo "Orario salvato nel fuso del server (utente di prova)"
S1="$(date -d '10 minutes ago' +%s)"
R1="$(call POST api/workout/record_workout.php "$T" "$(body 20 "$(iso "$S1")")")"
check "start_time di 10 minuti fa in UTC (Z): salvato" "$R1" '.success'
ID1="$(echo "${R1#* }" | jq -r '.id // empty')"
D1="$(stored_date "$ID1")"
[[ "$D1" == "$(rome "$S1")" ]] && ok "in storico c'è l'ora italiana ($D1), non quella UTC" || ko "in storico c'è l'ora italiana" "atteso: $(rome "$S1"), ricevuto: ${D1:-niente}"

S2="$(date -d '2 days ago' +%s)"; E2=$((S2 + 1800))
R2="$(call POST api/workout/record_workout.php "$T" "$(body 20 "$(iso "$S2")" "$(iso "$E2")" true)")"
check "sessione recuperata con start_time e ended_at in UTC (Z): durata 1800 s" "$R2" '.success and .duration_seconds == 1800'
ID2="$(echo "${R2#* }" | jq -r '.id // empty')"
D2="$(stored_date "$ID2")"
[[ "$D2" == "$(rome "$S2")" ]] && ok "sessione recuperata: in storico c'è l'ora italiana ($D2)" || ko "sessione recuperata: in storico c'è l'ora italiana" "atteso: $(rome "$S2"), ricevuto: ${D2:-niente}"

echo
if [[ $fails -eq 0 ]]; then printf '\033[32mTutti i %d controlli passati.\033[0m\n' "$checks"; else printf '\033[31m%d controlli su %d falliti.\033[0m\n' "$fails" "$checks"; exit 1; fi
