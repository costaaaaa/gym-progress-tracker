#!/usr/bin/env bash
#
# weekly_goal.sh — controlla l'obiettivo settimanale scelto dall'utente: validazione, decorrenza
# (lunedì e martedì vale subito, dagli altri giorni dal lunedì dopo), ritorno al default.
#
#   tests/weekly_goal.sh http://localhost:8080/backend/
#
# Ogni utente ha una scheda attiva di un giorno: l'obiettivo di default è 1. Il ramo provato dipende
# dal giorno in cui si lancia il test (il server usa Europe/Rome). Registra account usa e getta e li
# cancella alla fine. Non va lanciato in produzione: crea account veri.
#
# Richiede curl e jq. Esce con 1 se un controllo fallisce.

set -uo pipefail

BASE="${1:?uso: $(basename "$0") <url del backend, es. http://localhost:8080/backend/>}"
[[ "$BASE" == */ ]] || BASE="$BASE/"

PASS='Prova!Goal2026'
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
    call POST api/user/mobile_login.php "" "$(jq -nc --arg u "$user" --arg p "$PASS" '{username:$u, password:$p, device_info:"weekly_goal.sh"}')" \
        | cut -d' ' -f2- | jq -r '.token // empty'
}

A="$(register_and_login "wgA$SUFFIX")"
[[ -n "$A" ]] || { echo "registrazione o login falliti (limite di registrazioni per IP?)" >&2; exit 1; }

cleanup() {
    call POST api/user/delete.php "$A" "$(jq -nc --arg p "$PASS" '{password:$p}')" >/dev/null
    echo "Account di prova cancellato."
}
trap cleanup EXIT

E1="$(call GET api/exercise/read_all.php "$A" | cut -d' ' -f2- | jq -r '.records[0].id')"

make_day() { # token → id di un giorno con 3 serie di E1 (scheda attiva di un giorno: obiettivo di default 1)
    local t="$1" plan day
    plan="$(call POST api/workout/create_plan.php "$t" '{"name":"Scheda obiettivo"}' | cut -d' ' -f2- | jq -r '.plan.id')"
    call POST api/workout/activate_plan.php "$t" "{\"plan_id\":$plan}" >/dev/null
    day="$(call POST api/workout/create_days.php "$t" "{\"plan_id\":$plan,\"days\":[{\"name\":\"Giorno 1\"}]}" | cut -d' ' -f2- | jq -r '.days[0].id')"
    call POST api/workout/add_exercise.php "$t" "{\"day_id\":$day,\"exercise_id\":$E1,\"sets\":3,\"reps\":\"10\",\"rest\":60}" >/dev/null
    echo "$day"
}

set_goal() { call POST api/user/update_settings.php "$A" "{\"weekly_goal\":$1}"; }
user_goal() { call GET api/user/read.php "$A" | cut -d' ' -f2-; }
streak_goal() { call GET api/gamification/streak.php "$A" | cut -d' ' -f2- | jq -r '.this_week.goal'; }
expect() { # descrizione valore atteso
    [[ "$2" == "$3" ]] && ok "$1" || ko "$1" "atteso $3, ricevuto $2"
}

# Lunedì e martedì un cambio vale subito, gli altri giorni dal lunedì dopo (fuso del server)
DOW="$(TZ=Europe/Rome date +%u)"
NEXT_MONDAY="$(TZ=Europe/Rome date -d 'next monday' +%Y-%m-%d)"
if [[ $DOW -le 2 ]]; then echo "Oggi è lunedì o martedì: i cambi valgono subito"; else echo "Oggi non è lunedì né martedì: i cambi valgono da $NEXT_MONDAY"; fi

DAY_A="$(make_day "$A")"

echo "Validazione"
for bad in 0 8 -1 '"3"' '"x"' 2.5 true '[]'; do
    check "weekly_goal $bad rifiutato" "$(set_goal "$bad")" '$status == 400 and .code == "weekly_goal_invalid"'
done
for good in 1 7 null; do
    check "weekly_goal $good accettato" "$(set_goal "$good")" '$status == 200 and .success == true'
done

echo
echo "Decorrenza"
expect "senza scelta: obiettivo di default (giorni della scheda)" "$(streak_goal)" 1
check "senza scelta: weekly_goal null, default 1, nessun cambio in attesa" "$(user_goal | sed 's/^/200 /')" '.weekly_goal == null and .weekly_goal_default == 1 and .weekly_goal_pending == null'
set_goal 4 >/dev/null
if [[ $DOW -le 2 ]]; then
    expect "4: vale subito" "$(streak_goal)" 4
    check "4: weekly_goal 4, nessun cambio in attesa" "200 $(user_goal)" '.weekly_goal == 4 and .weekly_goal_pending == null'
else
    expect "4: la settimana in corso resta al default" "$(streak_goal)" 1
    check "4: in attesa dal lunedì prossimo" "200 $(user_goal)" ".weekly_goal == null and .weekly_goal_pending == {goal:4, from:\"$NEXT_MONDAY\"}"
fi
set_goal 6 >/dev/null
if [[ $DOW -le 2 ]]; then
    expect "6 dopo 4: vale subito il nuovo" "$(streak_goal)" 6
else
    check "6 dopo 4: il cambio in attesa è sostituito" "200 $(user_goal)" ".weekly_goal_pending == {goal:6, from:\"$NEXT_MONDAY\"}"
fi
set_goal null >/dev/null
expect "null: si torna al default" "$(streak_goal)" 1
check "null senza una scelta già in vigore: nessun cambio, né in vigore né in attesa" "200 $(user_goal)" '.weekly_goal == null and .weekly_goal_pending == null'

echo
echo "Dashboard e obiettivo effettivo"
dashboard_goal() { call GET api/workout_stats/dashboard.php "$A" | cut -d' ' -f2- | jq -r '.weekly_goal'; }
expect "dashboard: weekly_goal uguale all'obiettivo di streak.php (default)" "$(dashboard_goal)" "$(streak_goal)"
set_goal 5 >/dev/null
expect "dashboard: weekly_goal segue l'obiettivo in vigore" "$(dashboard_goal)" "$(streak_goal)"
set_goal null >/dev/null

echo
echo "Allineamento (solo lunedì e martedì)"
if [[ $DOW -le 2 ]]; then
    save() { # 3 serie da 20 kg
        local recs
        recs="$(jq -nc --argjson e "$E1" --argjson d "$DAY_A" '[range(1;4) | {exercise_id:$e, day_id:$d, set_number:., weight:20, reps:10}]')"
        call POST api/workout/record_workout.php "$A" "$(jq -nc --argjson r "$recs" --arg s "$(date -u -d '-25 min' +%Y-%m-%dT%H:%M:%SZ)" '{workout_records:$r, start_time:$s}')" >/dev/null
    }
    total_xp() { call GET api/gamification/profile.php "$A" | cut -d' ' -f2- | jq -r '.total_xp'; }
    streak_weeks() { call GET api/gamification/streak.php "$A" | cut -d' ' -f2- | jq -r '.current_streak_weeks'; }
    set_goal 3 >/dev/null; save; save
    expect "2 allenamenti con obiettivo 3: streak 0" "$(streak_weeks)" 0
    XP0="$(total_xp)"
    set_goal 2 >/dev/null
    expect "obiettivo abbassato a 2 e già raggiunto: la settimana si chiude, streak 1" "$(streak_weeks)" 1
    expect "la settimana chiusa dà 30 XP" "$(total_xp)" "$((XP0 + 30))"
    set_goal 2 >/dev/null
    expect "stesso invio ripetuto: nessun XP in più" "$(total_xp)" "$((XP0 + 30))"
    set_goal null >/dev/null
else
    echo "  (saltato: oggi non è lunedì né martedì)"
fi

echo "Export"
set_goal 4 >/dev/null
check "export: contiene la riga del cambio" "$(call GET api/user/export.php "$A")" \
    '$status == 200 and ([.gamification.weekly_goal_changes[]? | select(.goal == 4)] | length) == 1 and (.gamification.weekly_goal_changes[0].from | test("^[0-9]{4}-[0-9]{2}-[0-9]{2}$"))'
set_goal null >/dev/null

echo
if [[ $fails -eq 0 ]]; then
    printf '\033[32mTutti i %d controlli passati.\033[0m\n' "$checks"
else
    printf '\033[31m%d controlli falliti su %d.\033[0m\n' "$fails" "$checks"
    exit 1
fi
