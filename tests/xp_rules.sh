#!/usr/bin/env bash
#
# xp_rules.sh — controlla le regole degli XP di sessione di record_workout.php.
#
#   tests/xp_rules.sh http://localhost:8080/backend/
#
# Regole: gli XP di sessione si danno solo con una scheda, almeno il 60% delle serie, 20 minuti
# di durata e 10 ore dall'ultima sessione con XP. Il PR generale vale 15, una volta per sessione,
# e non dipende da queste regole. Il livello per esercizio usa 25x(L-1)^2.
# Registra due account usa e getta (token Bearer come l'app mobile) e li cancella alla fine.
# Non va lanciato in produzione: crea account veri.
#
# Richiede curl e jq. Esce con 1 se un controllo fallisce.

set -uo pipefail

BASE="${1:?uso: $(basename "$0") <url del backend, es. http://localhost:8080/backend/>}"
[[ "$BASE" == */ ]] || BASE="$BASE/"

PASS='Prova!XpRules2026'
SUFFIX="$(date +%s | tail -c 7)$RANDOM"
fails=0
checks=0

ok() { checks=$((checks + 1)); printf '  \033[32m✓\033[0m %s\n' "$1"; }
ko() { checks=$((checks + 1)); fails=$((fails + 1)); printf '  \033[31m✗\033[0m %s\n' "$1"; [[ -n "${2:-}" ]] && printf '      %s\n' "$2"; }

call() { # metodo path token [json] → "status corpo"
    local method="$1" path="$2" token="$3" body="${4:-}"
    local args=(-s -o /tmp/xp_rules.$$ -w '%{http_code}' -X "$method" -H 'Content-Type: application/json')
    [[ -n "$token" ]] && args+=(-H "Authorization: Bearer $token")
    [[ -n "$body" ]] && args+=(--data "$body")
    local status
    status="$(curl "${args[@]}" "$BASE$path")"
    printf '%s %s' "$status" "$(cat /tmp/xp_rules.$$)"
    rm -f /tmp/xp_rules.$$
}

# xpg = XP guadagnati senza il bonus streak (30 alla 3ª sessione della settimana, obiettivo di
# default senza scheda attiva): qui si controllano solo le regole di sessione e di PR
JQ_DEFS='def xpg: .xp_gained - (if .week_completed_now then 30 else 0 end);'

check() { # descrizione "risposta di call" filtro_jq
    if echo "${2#* }" | jq -e "$JQ_DEFS $3" >/dev/null 2>&1; then ok "$1"; else ko "$1" "ricevuto: ${2:0:300}"; fi
}

register_and_login() {
    local user="$1"
    call POST api/user/register.php "" "$(jq -nc --arg u "$user" --arg e "$user@example.com" --arg p "$PASS" --arg b "$(date -d '-30 years' +%Y-%m-%d)" \
        '{username:$u, email:$e, password:$p, birth_date:$b, gender:"O", accept_terms:true}')" >/dev/null
    call POST api/user/mobile_login.php "" "$(jq -nc --arg u "$user" --arg p "$PASS" '{username:$u, password:$p, device_info:"xp_rules.sh"}')" \
        | cut -d' ' -f2- | jq -r '.token // empty'
}

A="$(register_and_login "xpA$SUFFIX")"
B="$(register_and_login "xpB$SUFFIX")"
[[ -n "$A" && -n "$B" ]] || { echo "registrazione o login falliti (limite di registrazioni per IP?)" >&2; exit 1; }

cleanup() {
    for t in "$A" "$B"; do
        call POST api/user/delete.php "$t" "$(jq -nc --arg p "$PASS" '{password:$p}')" >/dev/null
    done
    echo "Account di prova cancellati."
}
trap cleanup EXIT

# Due esercizi del catalogo
CAT="$(call GET api/exercise/read_all.php "$A")"
E1="$(echo "${CAT#* }" | jq -r '.records[0].id')"
E2="$(echo "${CAT#* }" | jq -r '.records[1].id')"

make_day() { # token nome sets_E1 sets_E2(0 = solo E1) → id del giorno
    local t="$1" plan day
    plan="$(call POST api/workout/create_plan.php "$t" '{"name":"Scheda XP"}' | cut -d' ' -f2- | jq -r '.plan.id')"
    day="$(call POST api/workout/create_days.php "$t" "{\"plan_id\":$plan,\"days\":[{\"name\":\"$2\"}]}" | cut -d' ' -f2- | jq -r '.days[0].id')"
    call POST api/workout/add_exercise.php "$t" "{\"day_id\":$day,\"exercise_id\":$E1,\"sets\":$3,\"reps\":\"10\",\"rest\":60}" >/dev/null
    [[ "$4" -gt 0 ]] && call POST api/workout/add_exercise.php "$t" "{\"day_id\":$day,\"exercise_id\":$E2,\"sets\":$4,\"reps\":\"10\",\"rest\":60}" >/dev/null
    echo "$day"
}

# body giorno minuti_fa serie_E1 peso_E1 serie_E2 peso_E2  (minuti_fa vuoto = senza start_time)
body() {
    local day="$1" mins="$2" n1="$3" w1="$4" n2="$5" w2="$6" recs='[]' i
    for ((i = 1; i <= n1; i++)); do recs="$(jq -c --argjson e "$E1" --argjson d "$day" --argjson i "$i" --argjson w "$w1" '. + [{exercise_id:$e, day_id:$d, set_number:$i, weight:$w, reps:10}]' <<<"$recs")"; done
    for ((i = 1; i <= n2; i++)); do recs="$(jq -c --argjson e "$E2" --argjson d "$day" --argjson i "$i" --argjson w "$w2" '. + [{exercise_id:$e, day_id:$d, set_number:$i, weight:$w, reps:10}]' <<<"$recs")"; done
    if [[ -n "$mins" ]]; then
        jq -nc --argjson r "$recs" --arg s "$(date -u -d "-$mins min" +%Y-%m-%dT%H:%M:%SZ)" '{workout_records:$r, start_time:$s}'
    else
        jq -nc --argjson r "$recs" '{workout_records:$r}'
    fi
}

echo "Soglie su un giorno da 5 serie (utente A)"
DAY_A="$(make_day "$A" "Giorno 1" 5 0)"
check "5 minuti: nessun XP, motivo too_short" "$(call POST api/workout/record_workout.php "$A" "$(body "$DAY_A" 5 5 20 0 0)")" \
    '.success and .xp_session_awarded == false and .xp_session_reason == "too_short" and xpg == 0 and .completion_pct == 100'
check "senza start_time (durata ignota): too_short" "$(call POST api/workout/record_workout.php "$A" "$(body "$DAY_A" "" 5 20 0 0)")" \
    '.xp_session_awarded == false and .xp_session_reason == "too_short"'
check "2 serie su 5 (40%): incomplete" "$(call POST api/workout/record_workout.php "$A" "$(body "$DAY_A" 25 2 20 0 0)")" \
    '.xp_session_awarded == false and .xp_session_reason == "incomplete" and .completion_pct == 40 and xpg == 0'
check "3 serie su 5 (60%), 25 minuti: 20 XP" "$(call POST api/workout/record_workout.php "$A" "$(body "$DAY_A" 25 3 20 0 0)")" \
    '.xp_session_awarded == true and .xp_session_reason == "ok" and xpg == 20'
check "subito dopo, sessione completa: cooldown, 0 XP" "$(call POST api/workout/record_workout.php "$A" "$(body "$DAY_A" 25 5 20 0 0)")" \
    '.xp_session_awarded == false and .xp_session_reason == "cooldown" and xpg == 0'
check "l'allenamento si salva comunque (sets_saved)" "$(call POST api/workout/record_workout.php "$A" "$(body "$DAY_A" 25 5 20 0 0)")" '.sets_saved == 5'

echo "PR una volta per sessione (utente B, due esercizi)"
DAY_B="$(make_day "$B" "Giorno 1" 3 2)"
check "1ª sessione (peso 20): 20 XP, nessun PR" "$(call POST api/workout/record_workout.php "$B" "$(body "$DAY_B" 25 3 20 2 20)")" \
    '.xp_session_awarded == true and xpg == 20'
check "2ª sessione (30 kg su due esercizi): in cooldown, un solo PR da 15" "$(call POST api/workout/record_workout.php "$B" "$(body "$DAY_B" 25 3 30 2 30)")" \
    '.xp_session_awarded == false and .xp_session_reason == "cooldown" and xpg == 15'
check "3ª sessione (40 kg): ancora 15" "$(call POST api/workout/record_workout.php "$B" "$(body "$DAY_B" 25 3 40 2 40)")" \
    'xpg == 15'

echo "Livello per esercizio (curva 25)"
PROFILE="$(call GET api/gamification/profile.php "$B")"
check "E1: 10 + 15 + 15 = 40 XP, livello 2" "$PROFILE" "[.exercises[] | select(.exercise_id == $E1)][0] | (.xp | tonumber) == 40 and (.level | tonumber) == 2"

echo
if [[ $fails -eq 0 ]]; then printf '\033[32mTutti i %d controlli passati.\033[0m\n' "$checks"; else printf '\033[31m%d controlli su %d falliti.\033[0m\n' "$fails" "$checks"; exit 1; fi
