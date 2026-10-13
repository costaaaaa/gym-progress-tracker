#!/usr/bin/env bash
#
# idempotent_save.sh — controlla il salvataggio idempotente di record_workout.php: lo stesso
# allenamento inviato due volte con lo stesso idempotency_key (risposta persa, l'utente tocca di
# nuovo «Salva») si salva una volta sola, e XP, streak e volume si contano una volta.
#
#   tests/idempotent_save.sh http://localhost:8080/backend/
#
# Registra due account usa e getta (token Bearer come l'app mobile) e li cancella alla fine.
# Non va lanciato in produzione: crea account veri.
#
# Richiede curl e jq. Esce con 1 se un controllo fallisce.

set -uo pipefail

BASE="${1:?uso: $(basename "$0") <url del backend, es. http://localhost:8080/backend/>}"
[[ "$BASE" == */ ]] || BASE="$BASE/"

PASS='Prova!Idempotent2026'
SUFFIX="$(date +%s | tail -c 7)$RANDOM"
fails=0
checks=0

ok() { checks=$((checks + 1)); printf '  \033[32m✓\033[0m %s\n' "$1"; }
ko() { checks=$((checks + 1)); fails=$((fails + 1)); printf '  \033[31m✗\033[0m %s\n' "$1"; [[ -n "${2:-}" ]] && printf '      %s\n' "$2"; }

call() { # metodo path token [json] → "status corpo"
    # mktemp e non /tmp/...$$: più chiamate partono insieme in background
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

check() { # descrizione "risposta di call" filtro_jq (sul corpo; $status è il codice HTTP)
    local status="${2%% *}"
    if echo "${2#* }" | jq -e --argjson status "$status" "$3" >/dev/null 2>&1; then ok "$1"; else ko "$1" "ricevuto: ${2:0:300}"; fi
}

register_and_login() {
    local user="$1"
    call POST api/user/register.php "" "$(jq -nc --arg u "$user" --arg e "$user@example.com" --arg p "$PASS" --arg b "$(date -d '-30 years' +%Y-%m-%d)" \
        '{username:$u, email:$e, password:$p, birth_date:$b, gender:"O", accept_terms:true}')" >/dev/null
    call POST api/user/mobile_login.php "" "$(jq -nc --arg u "$user" --arg p "$PASS" '{username:$u, password:$p, device_info:"idempotent_save.sh"}')" \
        | cut -d' ' -f2- | jq -r '.token // empty'
}

A="$(register_and_login "idA$SUFFIX")"
B="$(register_and_login "idB$SUFFIX")"
[[ -n "$A" && -n "$B" ]] || { echo "registrazione o login falliti (limite di registrazioni per IP?)" >&2; exit 1; }

cleanup() {
    for t in "$A" "$B"; do
        call POST api/user/delete.php "$t" "$(jq -nc --arg p "$PASS" '{password:$p}')" >/dev/null
    done
    echo "Account di prova cancellati."
}
trap cleanup EXIT

CAT="$(call GET api/exercise/read_all.php "$A")"
E1="$(echo "${CAT#* }" | jq -r '.records[0].id')"

make_day() { # token → id di un giorno con 3 serie di E1
    local plan day
    plan="$(call POST api/workout/create_plan.php "$1" '{"name":"Scheda doppio invio"}' | cut -d' ' -f2- | jq -r '.plan.id')"
    day="$(call POST api/workout/create_days.php "$1" "{\"plan_id\":$plan,\"days\":[{\"name\":\"Giorno 1\"}]}" | cut -d' ' -f2- | jq -r '.days[0].id')"
    call POST api/workout/add_exercise.php "$1" "{\"day_id\":$day,\"exercise_id\":$E1,\"sets\":3,\"reps\":\"10\",\"rest\":60}" >/dev/null
    echo "$day"
}

# body giorno [idempotency_key]: 3 serie da 20 kg, iniziato 30 minuti fa (dà gli XP di sessione)
body() {
    local recs
    recs="$(jq -nc --argjson e "$E1" --argjson d "$1" '[range(1;4) | {exercise_id:$e, day_id:$d, set_number:., weight:20, reps:10}]')"
    jq -nc --argjson r "$recs" --arg s "$(date -u -d '-30 min' +%Y-%m-%dT%H:%M:%SZ)" --arg k "${2:-}" \
        '{workout_records:$r, start_time:$s, duration_seconds:1500} + (if $k != "" then {idempotency_key:$k} else {} end)'
}

history_count() { call GET api/workout_history/read.php "$1" | cut -d' ' -f2- | jq '.records | length'; }

KEY="prova-$SUFFIX-0123456789"
DAY_A="$(make_day "$A")"

echo "Stesso salvataggio inviato due volte (utente A)"
FIRST="$(call POST api/workout/record_workout.php "$A" "$(body "$DAY_A" "$KEY")")"
check "1° invio: salvato (201), con gli XP di sessione" "$FIRST" \
    '$status == 201 and .success and (.already_saved | not) and .xp_session_awarded == true'
ID1="$(echo "${FIRST#* }" | jq -r '.id')"
XP1="$(echo "${FIRST#* }" | jq -r '.total_xp')"
STREAK1="$(echo "${FIRST#* }" | jq -r '.current_streak_weeks')"

SECOND="$(call POST api/workout/record_workout.php "$A" "$(body "$DAY_A" "$KEY")")"
check "2° invio: successo, «già salvato», con l'id del primo" "$SECOND" \
    "\$status == 200 and .success and .already_saved == true and (.id | tostring) == \"$ID1\""
check "2° invio: streak uguale al 1° (riepilogo e card lo mostrano)" "$SECOND" \
    ".current_streak_weeks == $STREAK1 and $STREAK1 > 0"
check "un solo allenamento in storico" "200 {\"n\": $(history_count "$A")}" '.n == 1'
check "XP e volume contati una volta" "$(call GET api/gamification/profile.php "$A")" \
    "(.total_xp | tonumber) == $XP1 and (.lifetime_volume_kg | tonumber) == 600 and (.total_sessions | tonumber) == 1"

echo "Tre invii contemporanei con la stessa chiave (utente A)"
KEY2="prova-$SUFFIX-parallelo"
BODY2="$(body "$DAY_A" "$KEY2")"
PDIR="$(mktemp -d)"
for i in 1 2 3; do call POST api/workout/record_workout.php "$A" "$BODY2" > "$PDIR/$i" & done
wait
PAR="$(for i in 1 2 3; do cut -d' ' -f2- "$PDIR/$i"; done | jq -sc '{ids: (map(.id | tostring) | unique), saved: map(select(.already_saved | not)) | length, ok: all(.success)}')"
rm -rf "$PDIR"
check "tutti successo, uno solo salvato, stesso id" "200 $PAR" '.ok and .saved == 1 and (.ids | length) == 1'
check "due allenamenti in storico" "200 {\"n\": $(history_count "$A")}" '.n == 2'

echo "Senza idempotency_key (app vecchie): come prima"
check "1° invio senza chiave: salvato" "$(call POST api/workout/record_workout.php "$A" "$(body "$DAY_A")")" '$status == 201 and .success'
check "2° invio senza chiave: salvato di nuovo" "$(call POST api/workout/record_workout.php "$A" "$(body "$DAY_A")")" '$status == 201 and .success'
check "quattro allenamenti in storico" "200 {\"n\": $(history_count "$A")}" '.n == 4'

echo "Chiave non valida"
check "spazi e simboli: 400" "$(call POST api/workout/record_workout.php "$A" "$(body "$DAY_A" 'non va bene!')")" '$status == 400 and .success == false'
check "oltre 64 caratteri: 400" "$(call POST api/workout/record_workout.php "$A" "$(body "$DAY_A" "$(printf 'a%.0s' {1..65})")")" '$status == 400 and .success == false'

echo "La chiave vale per utente (utente B, stessa chiave di A)"
DAY_B="$(make_day "$B")"
check "salvato come allenamento nuovo" "$(call POST api/workout/record_workout.php "$B" "$(body "$DAY_B" "$KEY")")" \
    '$status == 201 and .success and (.already_saved | not)'

echo
if [[ $fails -eq 0 ]]; then printf '\033[32mTutti i %d controlli passati.\033[0m\n' "$checks"; else printf '\033[31m%d controlli su %d falliti.\033[0m\n' "$fails" "$checks"; exit 1; fi
