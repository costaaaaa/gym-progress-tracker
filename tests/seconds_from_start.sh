#!/usr/bin/env bash
#
# seconds_from_start.sh — controlla l'orario delle serie dell'allenamento (#26): record_workout.php
# salva seconds_from_start per ogni serie (secondi netti dall'inizio della sessione, intero da 0 a
# 86400) e workout_history/read.php lo restituisce. Assente o non valido (negativo, oltre 86400,
# testo, decimale, intero scritto come stringa) diventa null: il salvataggio riesce comunque,
# senza 400. tests/legacy_save.sh resta il controllo per i client senza il campo e senza colonna.
#
#   tests/seconds_from_start.sh http://localhost:8080/backend/
#
# Va lanciato dopo la migrazione 32. Registra un account usa e getta e lo cancella alla fine. Non
# va lanciato in produzione: crea account veri. Richiede curl e jq. Esce con 1 se un controllo fallisce.

set -uo pipefail

BASE="${1:?uso: $(basename "$0") <url del backend, es. http://localhost:8080/backend/>}"
[[ "$BASE" == */ ]] || BASE="$BASE/"

PASS='Prova!Orario2026'
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
    call POST api/user/mobile_login.php "" "$(jq -nc --arg u "$user" --arg p "$PASS" '{username:$u, password:$p, device_info:"seconds_from_start.sh"}')" \
        | cut -d' ' -f2- | jq -r '.token // empty'
}

A="$(register_and_login "sfsA$SUFFIX")"
[[ -n "$A" ]] || { echo "registrazione o login falliti (limite di registrazioni per IP?)" >&2; exit 1; }

cleanup() {
    call POST api/user/delete.php "$A" "$(jq -nc --arg p "$PASS" '{password:$p}')" >/dev/null
    echo "Account di prova cancellato."
}
trap cleanup EXIT

id_of() { call GET api/exercise/read_all.php "$A" | cut -d' ' -f2- | jq -r --arg n "$1" '.records[] | select(.name == $n) | .id' | head -n 1; }
DEADLIFT="$(id_of 'Stacco da Terra (Bilanciere)')"
[[ -n "$DEADLIFT" ]] || { echo "esercizio del catalogo non trovato" >&2; exit 1; }

plan="$(call POST api/workout/create_plan.php "$A" '{"name":"Scheda orario"}' | cut -d' ' -f2- | jq -r '.plan.id')"
call POST api/workout/activate_plan.php "$A" "{\"plan_id\":$plan}" >/dev/null
DAY="$(call POST api/workout/create_days.php "$A" "{\"plan_id\":$plan,\"days\":[{\"name\":\"Giorno 1\"}]}" | cut -d' ' -f2- | jq -r '.days[0].id')"
call POST api/workout/add_exercise.php "$A" "{\"day_id\":$DAY,\"exercise_id\":$DEADLIFT,\"planned_sets\":$(jq -nc '[range(1;10) | {set_number:., kind:"working", reps_min:5, reps_max:5}]'),\"rest\":90}" >/dev/null

echo "Salvataggio: una serie per caso"
# Serie 1-3 valide (0, 5400, 86400 = estremi compresi); 4 senza campo; 5-9 non valide
# (-1, 86401, "abc", 1.5, "120"): tutte devono tornare null, senza errore.
RECS="$(jq -nc --argjson d "$DAY" --argjson e "$DEADLIFT" '
    [ {v:0}, {v:5400}, {v:86400}, {}, {v:-1}, {v:86401}, {v:"abc"}, {v:1.5}, {v:"120"} ]
    | to_entries
    | map({exercise_id:$e, day_id:$d, set_number:(.key + 1), weight:100, reps:5}
          + (if (.value | has("v")) then {seconds_from_start: .value.v} else {} end))')"
START="$(date -u -d '-30 min' +%Y-%m-%dT%H:%M:%SZ)"
RESP="$(call POST api/workout/record_workout.php "$A" "$(jq -nc --argjson r "$RECS" --arg s "$START" '{workout_records:$r, start_time:$s}')")"
check "allenamento salvato anche con valori non validi (niente 400)" "$RESP" '$status == 200 or $status == 201'

echo
echo "Storico: seconds_from_start riletto per ogni serie"
H="200 $(call GET api/workout_history/read.php "$A" | cut -d' ' -f2-)"
check "9 serie nello storico, in un solo esercizio" "$H" '(.records[0].exercises | length) == 1 and (.records[0].exercises[0].sets | length) == 9'
check "serie 1: 0 (estremo basso valido)" "$H" '.records[0].exercises[0].sets[0].seconds_from_start == 0'
check "serie 2: 5400" "$H" '.records[0].exercises[0].sets[1].seconds_from_start == 5400'
check "serie 3: 86400 (estremo alto valido)" "$H" '.records[0].exercises[0].sets[2].seconds_from_start == 86400'
check "serie 4: campo assente -> null" "$H" '.records[0].exercises[0].sets[3] | has("seconds_from_start") and .seconds_from_start == null'
check "serie 5: -1 -> null" "$H" '.records[0].exercises[0].sets[4].seconds_from_start == null'
check "serie 6: 86401 -> null" "$H" '.records[0].exercises[0].sets[5].seconds_from_start == null'
check "serie 7: \"abc\" -> null" "$H" '.records[0].exercises[0].sets[6].seconds_from_start == null'
check "serie 8: 1.5 -> null" "$H" '.records[0].exercises[0].sets[7].seconds_from_start == null'
check "serie 9: \"120\" (stringa) -> null, vale solo l'intero JSON" "$H" '.records[0].exercises[0].sets[8].seconds_from_start == null'

echo
if [[ $fails -eq 0 ]]; then echo "$checks controlli, 0 falliti"; else echo "$checks controlli, $fails falliti"; exit 1; fi
