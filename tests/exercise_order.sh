#!/usr/bin/env bash
#
# exercise_order.sh — controlla l'ordine degli esercizi di un giorno della scheda (#77):
# l'ordine è la colonna position, il riordino scambia solo le position dei due vicini (ogni
# riga, col suo id e i suoi dati, resta legata al suo esercizio), un esercizio nuovo va in
# fondo anche dopo un'eliminazione, e l'export ha lo stesso ordine e la stessa position.
#
#   tests/exercise_order.sh http://localhost:8080/backend/
#
# Registra un account usa e getta e lo cancella alla fine. Non va lanciato in produzione: crea
# account veri. Richiede curl e jq. Esce con 1 se un controllo fallisce.

set -uo pipefail

BASE="${1:?uso: $(basename "$0") <url del backend, es. http://localhost:8080/backend/>}"
[[ "$BASE" == */ ]] || BASE="$BASE/"

PASS='Prova!Order2026'
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
    call POST api/user/mobile_login.php "" "$(jq -nc --arg u "$user" --arg p "$PASS" '{username:$u, password:$p, device_info:"exercise_order.sh"}')" \
        | cut -d' ' -f2- | jq -r '.token // empty'
}

A="$(register_and_login "eoA$SUFFIX")"
[[ -n "$A" ]] || { echo "registrazione o login falliti (limite di registrazioni per IP?)" >&2; exit 1; }

cleanup() {
    call POST api/user/delete.php "$A" "$(jq -nc --arg p "$PASS" '{password:$p}')" >/dev/null
    echo "Account di prova cancellato."
}
trap cleanup EXIT

id_of() { call GET api/exercise/read_all.php "$A" | cut -d' ' -f2- | jq -r --arg n "$1" '.records[] | select(.name == $n) | .id' | head -n 1; }
EX_A="$(id_of 'Stacco da Terra (Bilanciere)')"
EX_B="$(id_of 'Sumo Squat')"
EX_C="$(id_of 'Adductor Machine')"
EX_D="$(id_of 'Stacco da Terra (Manubri)')"
[[ -n "$EX_A" && -n "$EX_B" && -n "$EX_C" && -n "$EX_D" ]] || { echo "esercizi del catalogo non trovati" >&2; exit 1; }

plan="$(call POST api/workout/create_plan.php "$A" '{"name":"Scheda ordine"}' | cut -d' ' -f2- | jq -r '.plan.id')"
call POST api/workout/activate_plan.php "$A" "{\"plan_id\":$plan}" >/dev/null
DAY="$(call POST api/workout/create_days.php "$A" "{\"plan_id\":$plan,\"days\":[{\"name\":\"Giorno 1\"}]}" | cut -d' ' -f2- | jq -r '.days[0].id')"

add() { # exercise_id sets reps rest notes → id della riga della scheda
    call POST api/workout/add_exercise.php "$A" \
        "$(jq -nc --argjson d "$DAY" --argjson e "$1" --argjson s "$2" --arg r "$3" --argjson t "$4" --arg n "$5" \
            '{day_id:$d, exercise_id:$e, sets:$s, reps:$r, rest:$t, notes:$n}')" | cut -d' ' -f2- | jq -r '.workout_exercise.id'
}
move() { call POST api/workout/reorder_exercise.php "$A" "{\"day_id\":$DAY,\"exercise_id\":$1,\"direction\":\"$2\"}"; }
plan_exercises() { echo "200 $(call GET api/workout/read_plans.php "$A" | cut -d' ' -f2-)"; }

echo "Inserimento: A, B, C escono in quest'ordine"
ID_A="$(add "$EX_A" 3 "8" 90 "nota A")"
ID_B="$(add "$EX_B" 4 "10" 120 "nota B")"
ID_C="$(add "$EX_C" 5 "12" 60 "nota C")"
check "ordine A, B, C" "$(plan_exercises)" ".records[0].days[0].exercises | map(.id) == [$ID_A, $ID_B, $ID_C]"

echo
echo "Riordino: C su → A, C, B; ogni riga resta col suo id e i suoi dati"
check "C su: 200" "$(move "$ID_C" up)" '$status == 200 and .success == true'
check "ordine A, C, B" "$(plan_exercises)" ".records[0].days[0].exercises | map(.id) == [$ID_A, $ID_C, $ID_B]"
check "C ha ancora il suo id e i suoi dati (5 serie, 12 reps, 60s, nota C)" "$(plan_exercises)" \
    ".records[0].days[0].exercises[1] | .id == $ID_C and .exercise_id == $EX_C and .sets == 5 and .reps == \"12\" and .rest == 60 and .notes == \"nota C\""
check "B ha ancora il suo id e i suoi dati (4 serie, 10 reps, 120s, nota B)" "$(plan_exercises)" \
    ".records[0].days[0].exercises[2] | .id == $ID_B and .exercise_id == $EX_B and .sets == 4 and .reps == \"10\" and .rest == 120 and .notes == \"nota B\""

echo
echo "Riordino: A giù e limiti (primo su, ultimo giù)"
check "A giù: 200" "$(move "$ID_A" down)" '$status == 200 and .success == true'
check "ordine C, A, B" "$(plan_exercises)" ".records[0].days[0].exercises | map(.id) == [$ID_C, $ID_A, $ID_B]"
check "A ha ancora il suo id e i suoi dati (3 serie, 8 reps, 90s, nota A)" "$(plan_exercises)" \
    ".records[0].days[0].exercises[1] | .id == $ID_A and .exercise_id == $EX_A and .sets == 3 and .reps == \"8\" and .rest == 90 and .notes == \"nota A\""
check "primo su (C): 200, success, ordine invariato" "$(move "$ID_C" up)" '$status == 200 and .success == true'
check "ordine ancora C, A, B" "$(plan_exercises)" ".records[0].days[0].exercises | map(.id) == [$ID_C, $ID_A, $ID_B]"
check "ultimo giù (B): 200, success, ordine invariato" "$(move "$ID_B" down)" '$status == 200 and .success == true'
check "ordine ancora C, A, B" "$(plan_exercises)" ".records[0].days[0].exercises | map(.id) == [$ID_C, $ID_A, $ID_B]"
check "direzione non valida: 400" "$(move "$ID_A" sideways)" '$status == 400'

echo
echo "Eliminazione: i buchi sono ammessi, il nuovo esercizio va in fondo"
check "elimina B: 200" "$(call POST api/workout/delete_exercise.php "$A" "{\"day_id\":$DAY,\"exercise_id\":$ID_B}")" '$status == 200'
ID_D="$(add "$EX_D" 2 "15" 45 "nota D")"
check "ordine C, A, D" "$(plan_exercises)" ".records[0].days[0].exercises | map(.id) == [$ID_C, $ID_A, $ID_D]"
check "D su: ordine C, D, A" "$(move "$ID_D" up)" '$status == 200'
check "ordine C, D, A" "$(plan_exercises)" ".records[0].days[0].exercises | map(.id) == [$ID_C, $ID_D, $ID_A]"

echo
echo "Esportazione: stesso ordine e position"
EXPORT="$(call GET api/user/export.php "$A")"
check "export: C, D, A in quest'ordine" "$EXPORT" \
    '[.. | objects | select(has("exercises") and has("name") and .name == "Giorno 1") | .exercises[].notes] == ["nota C", "nota D", "nota A"]'
check "export: position crescente" "$EXPORT" \
    '[.. | objects | select(has("exercises") and has("name") and .name == "Giorno 1") | .exercises[].position] as $p | ($p | length) == 3 and $p == ($p | sort) and ($p | unique | length) == 3'

echo
if [[ $fails -eq 0 ]]; then echo "$checks controlli, 0 falliti"; else echo "$checks controlli, $fails falliti"; exit 1; fi
