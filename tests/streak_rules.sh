#!/usr/bin/env bash
#
# streak_rules.sh — controlla lo streak reversibile: settimane che si chiudono e si riaprono
# con salvataggi, cancellazioni e cambi di data.
#
#   tests/streak_rules.sh http://localhost:8080/backend/
#
# Ogni utente ha una scheda attiva di un giorno, quindi l'obiettivo è 1 allenamento a settimana.
# Le settimane passate si costruiscono spostando allenamenti di 7×k giorni (k ≤ 4, dentro i 30
# giorni ammessi da update_date). Registra account usa e getta (token Bearer come l'app mobile)
# e li cancella alla fine. Non va lanciato in produzione: crea account veri.
#
# Richiede curl e jq. Esce con 1 se un controllo fallisce.

set -uo pipefail

BASE="${1:?uso: $(basename "$0") <url del backend, es. http://localhost:8080/backend/>}"
[[ "$BASE" == */ ]] || BASE="$BASE/"

PASS='Prova!Streak2026'
SUFFIX="$(date +%s | tail -c 7)$RANDOM"
fails=0
checks=0

ok() { checks=$((checks + 1)); printf '  \033[32m✓\033[0m %s\n' "$1"; }
ko() { checks=$((checks + 1)); fails=$((fails + 1)); printf '  \033[31m✗\033[0m %s\n' "$1"; [[ -n "${2:-}" ]] && printf '      %s\n' "$2"; }

call() { # metodo path token [json] → "status corpo"
    local method="$1" path="$2" token="$3" body="${4:-}"
    local args=(-s -o /tmp/streak_rules.$$ -w '%{http_code}' -X "$method" -H 'Content-Type: application/json')
    [[ -n "$token" ]] && args+=(-H "Authorization: Bearer $token")
    [[ -n "$body" ]] && args+=(--data "$body")
    local status
    status="$(curl "${args[@]}" "$BASE$path")"
    printf '%s %s' "$status" "$(cat /tmp/streak_rules.$$)"
    rm -f /tmp/streak_rules.$$
}

check() { # descrizione "risposta di call" filtro_jq (sul corpo; $status = codice HTTP)
    local status="${2%% *}"
    if echo "${2#* }" | jq -e --argjson status "$status" "$3" >/dev/null 2>&1; then ok "$1"; else ko "$1" "ricevuto: ${2:0:300}"; fi
}

register_and_login() {
    local user="$1"
    call POST api/user/register.php "" "$(jq -nc --arg u "$user" --arg e "$user@example.com" --arg p "$PASS" --arg b "$(date -d '-30 years' +%Y-%m-%d)" \
        '{username:$u, email:$e, password:$p, birth_date:$b, gender:"O", accept_terms:true}')" >/dev/null
    call POST api/user/mobile_login.php "" "$(jq -nc --arg u "$user" --arg p "$PASS" '{username:$u, password:$p, device_info:"streak_rules.sh"}')" \
        | cut -d' ' -f2- | jq -r '.token // empty'
}

A="$(register_and_login "stA$SUFFIX")"
[[ -n "$A" ]] || { echo "registrazione o login falliti (limite di registrazioni per IP?)" >&2; exit 1; }

cleanup() {
    for t in "$A"; do
        call POST api/user/delete.php "$t" "$(jq -nc --arg p "$PASS" '{password:$p}')" >/dev/null
    done
    echo "Account di prova cancellati."
}
trap cleanup EXIT

E1="$(call GET api/exercise/read_all.php "$A" | cut -d' ' -f2- | jq -r '.records[0].id')"

make_day() { # token → id di un giorno con 3 serie di E1 (scheda attiva di un giorno: obiettivo 1)
    local t="$1" plan day
    plan="$(call POST api/workout/create_plan.php "$t" '{"name":"Scheda streak"}' | cut -d' ' -f2- | jq -r '.plan.id')"
    call POST api/workout/activate_plan.php "$t" "{\"plan_id\":$plan}" >/dev/null
    day="$(call POST api/workout/create_days.php "$t" "{\"plan_id\":$plan,\"days\":[{\"name\":\"Giorno 1\"}]}" | cut -d' ' -f2- | jq -r '.days[0].id')"
    call POST api/workout/add_exercise.php "$t" "{\"day_id\":$day,\"exercise_id\":$E1,\"sets\":3,\"reps\":\"10\",\"rest\":60}" >/dev/null
    echo "$day"
}

save() { # token giorno → risposta di record_workout (3 serie da 20 kg, iniziato 25 minuti fa)
    local recs
    recs="$(jq -nc --argjson e "$E1" --argjson d "$2" '[range(1;4) | {exercise_id:$e, day_id:$d, set_number:., weight:20, reps:10}]')"
    call POST api/workout/record_workout.php "$1" "$(jq -nc --argjson r "$recs" --arg s "$(date -u -d '-25 min' +%Y-%m-%dT%H:%M:%SZ)" '{workout_records:$r, start_time:$s}')"
}
save_backdated() { # token giorno data → salvataggio ripreso in ritardo su quella data (come la bozza del Focus)
    local recs
    recs="$(jq -nc --argjson e "$E1" --argjson d "$2" '[range(1;4) | {exercise_id:$e, day_id:$d, set_number:., weight:20, reps:10}]')"
    call POST api/workout/record_workout.php "$1" "$(jq -nc --argjson r "$recs" --arg s "$3T10:00:00" --arg e "$3T10:40:00" '{workout_records:$r, start_time:$s, ended_at:$e, backdated:true}')"
}
saved_id() { echo "${1#* }" | jq -r '.id'; }
weeks_ago() { date -d "-$((7 * $1)) days" +%Y-%m-%d; }
move() { # token id settimane_fa [preview] → risposta di update_date
    call POST api/workout_history/update_date.php "$1" "$(jq -nc --argjson id "$2" --arg d "$(weeks_ago "$3")" --argjson p "${4:-false}" '{id:$id, new_date:$d, preview:$p}')"
}
streak() { call GET api/gamification/streak.php "$1" | cut -d' ' -f2- | jq -r '.current_streak_weeks'; }
total_xp() { call GET api/gamification/profile.php "$1" | cut -d' ' -f2- | jq -r '.total_xp'; }
expect() { # descrizione valore atteso
    [[ "$2" == "$3" ]] && ok "$1" || ko "$1" "atteso $3, ricevuto $2"
}

echo "Settimane passate che si chiudono (utente A)"
DAY_A="$(make_day "$A")"
check "1° salvataggio: chiude la settimana corrente, streak 1" "$(save "$A" "$DAY_A")" '.week_completed_now and .current_streak_weeks == 1'
W1="$(saved_id "$(save "$A" "$DAY_A")")"
XP0="$(total_xp "$A")"
check "spostare un allenamento alla settimana scorsa la chiude" "$(move "$A" "$W1" 1)" '.success and .xp_delta == 30'
expect "lo streak si riattacca: 2 settimane" "$(streak "$A")" 2
expect "la settimana chiusa dà 30 XP" "$(total_xp "$A")" "$((XP0 + 30))"
W3="$(saved_id "$(save "$A" "$DAY_A")")"
check "3 settimane fa: chiusa a parte, +30" "$(move "$A" "$W3" 3)" '.xp_delta == 30 and .streak_before == 2 and .streak_after == 2'
W2="$(saved_id "$(save "$A" "$DAY_A")")"
check "2 settimane fa riempie il buco: streak 4, sblocca streak_4" "$(move "$A" "$W2" 2)" \
    '.xp_delta == 30 and .streak_after == 4 and (.achievements_unlocked | index("streak_4") != null)'
expect "streak.php conferma 4 settimane" "$(streak "$A")" 4
check "streak_4 risulta sbloccato nel profilo" "$(call GET api/gamification/profile.php "$A")" \
    '[.achievements[] | select(.key == "streak_4")][0].locked == false'

echo "Cancellare riapre la settimana (utente A, settimane 0..-3 chiuse)"
XP1="$(total_xp "$A")"
check "anteprima: −30, streak da 4 a 2, perde streak_4" "$(call POST api/workout_history/delete.php "$A" "{\"id\":$W2,\"preview\":true}")" \
    '.preview and .xp_removed == 30 and .streak_before == 4 and .streak_after == 2 and (.achievements_removed | index("streak_4") != null)'
expect "l'anteprima non cambia lo streak" "$(streak "$A")" 4
check "cancellare l'allenamento di 2 settimane fa riapre la settimana" "$(call POST api/workout_history/delete.php "$A" "{\"id\":$W2}")" \
    '.success and .xp_removed == 30 and .streak_after == 2'
expect "streak spezzato: 2 settimane" "$(streak "$A")" 2
expect "tolti i 30 XP della settimana" "$(total_xp "$A")" "$((XP1 - 30))"
check "streak_4 non è più sbloccato" "$(call GET api/gamification/profile.php "$A")" \
    '[.achievements[] | select(.key == "streak_4")][0].locked == true'

echo "Spostamenti fra settimane (utente A, settimane 0, -1, -3 chiuse)"
check "spostare dentro la stessa settimana non cambia nulla" "$(move "$A" "$W1" 1)" '.xp_delta == 0 and .streak_before == 2 and .streak_after == 2'
check "da 3 a 2 settimane fa: riapre una, chiude l'altra (XP netti 0), streak 3" "$(move "$A" "$W3" 2)" \
    '.xp_delta == 0 and .streak_before == 2 and .streak_after == 3'

echo "Salvataggio retroattivo (utente A)"
check "cancellare l'allenamento della settimana scorsa spezza lo streak" "$(call POST api/workout_history/delete.php "$A" "{\"id\":$W1}")" '.streak_after == 1'
check "un salvataggio ripreso in ritardo nella settimana scorsa la richiude: +30, streak 3" "$(save_backdated "$A" "$DAY_A" "$(weeks_ago 1)")" \
    '.week_completed_now and .current_streak_weeks == 3 and .xp_gained >= 30'

echo "Limiti del cambio data (utente A)"
W5="$(saved_id "$(save "$A" "$DAY_A")")"
check "destinazione oltre 30 giorni (5 settimane fa): 400" "$(move "$A" "$W5" 5)" '$status == 400 and .success == false'
check "destinazione a 30 giorni: si accetta" \
    "$(call POST api/workout_history/update_date.php "$A" "{\"id\":$W5,\"new_date\":\"$(date -d '-30 days' +%Y-%m-%d)\"}")" '$status == 200'

echo "Anteprima del cambio data (utente A, settimane 0..-2 e -4 chiuse)"
W6="$(saved_id "$(save "$A" "$DAY_A")")"
XP2="$(total_xp "$A")"
check "anteprima: 3 settimane fa riempie il buco, +30, streak da 3 a 5, sblocca streak_4" "$(move "$A" "$W6" 3 true)" \
    '.preview and .xp_delta == 30 and .streak_before == 3 and .streak_after == 5 and (.achievements_unlocked | index("streak_4") != null)'
expect "l'anteprima non cambia lo streak" "$(streak "$A")" 3
expect "l'anteprima non cambia gli XP" "$(total_xp "$A")" "$XP2"
check "l'anteprima non sposta l'allenamento" "$(call GET api/workout_history/read.php "$A")" \
    "[.records[] | select(.id == $W6)][0].date | startswith(\"$(date +%Y-%m-%d)\")"

echo "Riapertura con obiettivo cambiato (utente A)"
PLAN_A="$(call GET api/workout/read_plans.php "$A" | cut -d' ' -f2- | jq -r '[.. | objects | select(has("is_active")) | select(.is_active == 1 or .is_active == "1" or .is_active == true)][0].id')"
call POST api/workout/create_days.php "$A" "{\"plan_id\":$PLAN_A,\"days\":[{\"name\":\"Giorno 2\"}]}" >/dev/null
expect "la scheda ha 2 giorni: obiettivo 2" "$(call GET api/gamification/streak.php "$A" | cut -d' ' -f2- | jq -r '.this_week.goal')" 2
check "obiettivo salito a 2: la settimana corrente, chiusa con 1, resta chiusa con 1 allenamento" \
    "$(call POST api/workout_history/delete.php "$A" "{\"id\":$W6}")" '.success and .streak_after == .streak_before and .streak_after == 3'

echo
if [[ $fails -eq 0 ]]; then
    printf '\033[32mTutti i %d controlli passati.\033[0m\n' "$checks"
else
    printf '\033[31m%d controlli falliti su %d.\033[0m\n' "$fails" "$checks"
    exit 1
fi
