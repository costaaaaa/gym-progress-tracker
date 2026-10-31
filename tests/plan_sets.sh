#!/usr/bin/env bash
#
# plan_sets.sh — controlla le serie pianificate degli esercizi in scheda (#77): add_exercise e
# update_exercise ricevono planned_sets e sostituiscono tutte le serie; read_plans ed export le
# restituiscono; i campi sets, warmup_sets, reps e intensity_technique dell'esercizio non escono più;
# le richieste non valide danno 400 senza toccare la scheda; riordino ed eliminazione non mescolano
# le serie tra esercizi.
#
#   tests/plan_sets.sh http://localhost:8080/backend/
#
# Registra un account usa e getta e lo cancella alla fine. Non va lanciato in produzione: crea
# account veri. Richiede curl e jq. Esce con 1 se un controllo fallisce.
set -uo pipefail

BASE="${1:?uso: $(basename "$0") <url del backend, es. http://localhost:8080/backend/>}"
[[ "$BASE" == */ ]] || BASE="$BASE/"

PASS='Prova!Plan2026'
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
    call POST api/user/mobile_login.php "" "$(jq -nc --arg u "$user" --arg p "$PASS" '{username:$u, password:$p, device_info:"plan_sets.sh"}')" \
        | cut -d' ' -f2- | jq -r '.token // empty'
}


A="$(register_and_login "psA$SUFFIX")"
[[ -n "$A" ]] || { echo "registrazione o login falliti (limite di registrazioni per IP?)" >&2; exit 1; }

cleanup() {
    call POST api/user/delete.php "$A" "$(jq -nc --arg p "$PASS" '{password:$p}')" >/dev/null
    echo "Account di prova cancellato."
}
trap cleanup EXIT

id_of() { call GET api/exercise/read_all.php "$A" | cut -d' ' -f2- | jq -r --arg n "$1" '.records[] | select(.name == $n) | .id' | head -n 1; }
EX_A="$(id_of 'Stacco da Terra (Bilanciere)')"
EX_B="$(id_of 'Sumo Squat')"
[[ -n "$EX_A" && -n "$EX_B" ]] || { echo "esercizi del catalogo non trovati" >&2; exit 1; }

plan="$(call POST api/workout/create_plan.php "$A" '{"name":"Scheda serie"}' | cut -d' ' -f2- | jq -r '.plan.id')"
call POST api/workout/activate_plan.php "$A" "{\"plan_id\":$plan}" >/dev/null
DAY="$(call POST api/workout/create_days.php "$A" "{\"plan_id\":$plan,\"days\":[{\"name\":\"Giorno 1\"}]}" | cut -d' ' -f2- | jq -r '.days[0].id')"

add() { # exercise_id planned_sets_json [campi jq extra] → "status corpo"
    call POST api/workout/add_exercise.php "$A" \
        "$(jq -nc --argjson d "$DAY" --argjson e "$1" --argjson p "$2" '{day_id:$d, exercise_id:$e, planned_sets:$p, rest:90, notes:"nota"}')"
}
update() { # riga_scheda planned_sets_json → "status corpo"
    call POST api/workout/update_exercise.php "$A" \
        "$(jq -nc --argjson d "$DAY" --argjson w "$1" --argjson p "$2" '{day_id:$d, exercise_id:$w, planned_sets:$p, rest:45, notes:"nota 2"}')"
}
plan_exercises() { echo "200 $(call GET api/workout/read_plans.php "$A" | cut -d' ' -f2-)"; }

# 2 di riscaldamento, 12, due 8-10, a cedimento (minimo 6) con tecnica scritta con spazi ai bordi
SETS_A='[{"set_number":1,"kind":"warmup"},{"set_number":2,"kind":"warmup"},
  {"set_number":3,"kind":"working","reps_min":12,"reps_max":12},
  {"set_number":4,"kind":"working","reps_min":8,"reps_max":10},
  {"set_number":5,"kind":"working","reps_min":8,"reps_max":10},
  {"set_number":6,"kind":"working","reps_min":6,"to_failure":true,"intensity_technique":"  Drop Set (Stripping) "}]'
# la stessa scheda come la restituisce l'API: tutti i campi, tecnica senza spazi
CANON_A='[{"set_number":1,"kind":"warmup","reps_min":null,"reps_max":null,"to_failure":false,"intensity_technique":null},
  {"set_number":2,"kind":"warmup","reps_min":null,"reps_max":null,"to_failure":false,"intensity_technique":null},
  {"set_number":3,"kind":"working","reps_min":12,"reps_max":12,"to_failure":false,"intensity_technique":null},
  {"set_number":4,"kind":"working","reps_min":8,"reps_max":10,"to_failure":false,"intensity_technique":null},
  {"set_number":5,"kind":"working","reps_min":8,"reps_max":10,"to_failure":false,"intensity_technique":null},
  {"set_number":6,"kind":"working","reps_min":6,"reps_max":null,"to_failure":true,"intensity_technique":"Drop Set (Stripping)"}]'

echo "Aggiunta: le serie si salvano e si rileggono"
R="$(add "$EX_A" "$SETS_A")"
check "add_exercise: 201 e planned_sets in forma canonica" "$R" "\$status == 201 and .workout_exercise.planned_sets == $CANON_A"
ID_A="$(echo "${R#* }" | jq -r '.workout_exercise.id')"
check "la risposta ha id, esercizio, recupero e nessuna colonna vecchia" "$R" \
    ".workout_exercise | .id == $ID_A and .exercise_id == $EX_A and .rest == 90 and (keys | index(\"sets\") == null and index(\"warmup_sets\") == null and index(\"reps\") == null and index(\"intensity_technique\") == null)"
check "la risposta di add_exercise ha la forma di un esercizio di read_plans" "$R" \
    "(.workout_exercise | keys) == [\"equipment\",\"exercise_id\",\"exercise_name\",\"id\",\"muscle_group\",\"notes\",\"planned_sets\",\"rest\"]"
check "...e coincide con l'esercizio che legge read_plans" "$(plan_exercises)" \
    ".records[0].days[0].exercises[0] == $(echo "${R#* }" | jq -c '.workout_exercise')"
check "read_plans: stesse serie, stesso ordine" "$(plan_exercises)" \
    ".records[0].days[0].exercises[0] | .id == $ID_A and .rest == 90 and .notes == \"nota\" and .planned_sets == $CANON_A"
check "read_plans: sets, warmup_sets, reps e intensity_technique non escono più" "$(plan_exercises)" \
    '.records[0].days[0].exercises[0] | keys | (index("sets") == null and index("warmup_sets") == null and index("reps") == null and index("intensity_technique") == null)'
check "tecnica \"Nessuna (Normale)\" e vuota valgono null" "$(add "$EX_B" '[{"set_number":1,"kind":"working","reps_min":5,"reps_max":5,"intensity_technique":"Nessuna (Normale)"},{"set_number":2,"kind":"working","reps_min":5,"reps_max":5,"intensity_technique":""}]')" \
    '$status == 201 and ([.workout_exercise.planned_sets[].intensity_technique] == [null, null])'
ID_X="$(plan_exercises | cut -d' ' -f2- | jq -r '.records[0].days[0].exercises[1].id')"
call POST api/workout/delete_exercise.php "$A" "{\"day_id\":$DAY,\"exercise_id\":$ID_X}" >/dev/null

echo
echo "Aggiunta: richieste non valide (400)"
status_is() { check "$1" "$2" "\$status == $3"; }
W5='{"set_number":1,"kind":"working","reps_min":5,"reps_max":5}'
status_is "senza planned_sets" "$(call POST api/workout/add_exercise.php "$A" "{\"day_id\":$DAY,\"exercise_id\":$EX_A,\"rest\":90}")" 400
status_is "formato vecchio (sets e reps) senza planned_sets" "$(call POST api/workout/add_exercise.php "$A" "{\"day_id\":$DAY,\"exercise_id\":$EX_A,\"sets\":3,\"reps\":\"10\",\"rest\":90}")" 400
status_is "planned_sets vuoto" "$(add "$EX_A" '[]')" 400
status_is "planned_sets non è una lista" "$(add "$EX_A" '{"set_number":1}')" 400
status_is "solo riscaldamento, nessuna allenante" "$(add "$EX_A" '[{"set_number":1,"kind":"warmup"}]')" 400
status_is "set_number con un buco" "$(add "$EX_A" '[{"set_number":1,"kind":"working","reps_min":5,"reps_max":5},{"set_number":3,"kind":"working","reps_min":5,"reps_max":5}]')" 400
status_is "set_number che non parte da 1" "$(add "$EX_A" '[{"set_number":2,"kind":"working","reps_min":5,"reps_max":5}]')" 400
status_is "kind sconosciuto" "$(add "$EX_A" '[{"set_number":1,"kind":"cooldown","reps_min":5,"reps_max":5}]')" 400
status_is "riscaldamento dopo una allenante" "$(add "$EX_A" "[$W5,{\"set_number\":2,\"kind\":\"warmup\"}]")" 400
status_is "riscaldamento con una tecnica" "$(add "$EX_A" "[{\"set_number\":1,\"kind\":\"warmup\",\"intensity_technique\":\"Drop Set\"},{\"set_number\":2,\"kind\":\"working\",\"reps_min\":5,\"reps_max\":5}]")" 400
status_is "riscaldamento con un target" "$(add "$EX_A" '[{"set_number":1,"kind":"warmup","reps_min":10,"reps_max":10},{"set_number":2,"kind":"working","reps_min":5,"reps_max":5}]')" 400
status_is "11 serie di riscaldamento" "$(add "$EX_A" "$(jq -nc '[range(1;12) | {set_number:., kind:"warmup"}] + [{set_number:12, kind:"working", reps_min:5, reps_max:5}]')")" 400
status_is "21 serie allenanti" "$(add "$EX_A" "$(jq -nc '[range(1;22) | {set_number:., kind:"working", reps_min:5, reps_max:5}]')")" 400
status_is "20 serie allenanti: ammesse" "$(add "$EX_B" "$(jq -nc '[range(1;21) | {set_number:., kind:"working", reps_min:5, reps_max:5}]')")" 201
status_is "ripetizioni minime maggiori delle massime" "$(add "$EX_A" '[{"set_number":1,"kind":"working","reps_min":10,"reps_max":8}]')" 400
status_is "ripetizioni 0" "$(add "$EX_A" '[{"set_number":1,"kind":"working","reps_min":0,"reps_max":5}]')" 400
status_is "ripetizioni 251" "$(add "$EX_A" '[{"set_number":1,"kind":"working","reps_min":5,"reps_max":251}]')" 400
status_is "ripetizioni 250: ammesse" "$(add "$EX_B" '[{"set_number":1,"kind":"working","reps_min":250,"reps_max":250}]')" 201
status_is "ripetizioni come stringa" "$(add "$EX_A" '[{"set_number":1,"kind":"working","reps_min":"5","reps_max":"5"}]')" 400
status_is "serie allenante senza target" "$(add "$EX_A" '[{"set_number":1,"kind":"working"}]')" 400
status_is "a cedimento con ripetizioni massime" "$(add "$EX_A" '[{"set_number":1,"kind":"working","reps_min":5,"reps_max":8,"to_failure":true}]')" 400
status_is "a cedimento senza minimo: ammesso" "$(add "$EX_B" '[{"set_number":1,"kind":"working","to_failure":true}]')" 201
status_is "to_failure non booleano" "$(add "$EX_A" '[{"set_number":1,"kind":"working","reps_min":5,"reps_max":5,"to_failure":1}]')" 400
status_is "campo sconosciuto in una serie" "$(add "$EX_A" '[{"set_number":1,"kind":"working","reps_min":5,"reps_max":5,"weight":100}]')" 400
status_is "tecnica da 100 caratteri: ammessa" "$(add "$EX_B" "$(jq -nc --arg t "$(printf '%100s' | tr ' ' x)" '[{set_number:1, kind:"working", reps_min:5, reps_max:5, intensity_technique:$t}]')")" 201
status_is "tecnica da 101 caratteri" "$(add "$EX_A" "$(jq -nc --arg t "$(printf '%101s' | tr ' ' x)" '[{set_number:1, kind:"working", reps_min:5, reps_max:5, intensity_technique:$t}]')")" 400
status_is "tecnica numerica" "$(add "$EX_A" '[{"set_number":1,"kind":"working","reps_min":5,"reps_max":5,"intensity_technique":5}]')" 400
check "le richieste rifiutate non lasciano righe: la scheda ha solo A e gli esercizi ammessi" "$(plan_exercises)" \
    '[.records[0].days[0].exercises[] | select(.planned_sets | length > 0)] | length == 5'
# tolgo gli esercizi ammessi dai controlli precedenti, restano A e B ripuliti sotto
for id in $(plan_exercises | cut -d' ' -f2- | jq -r ".records[0].days[0].exercises[] | select(.id != $ID_A) | .id"); do
    call POST api/workout/delete_exercise.php "$A" "{\"day_id\":$DAY,\"exercise_id\":$id}" >/dev/null
done
check "dopo la pulizia resta solo A" "$(plan_exercises)" ".records[0].days[0].exercises | map(.id) == [$ID_A]"

echo
echo "Modifica: sostituisce tutte le serie"
SETS_2='[{"set_number":1,"kind":"working","reps_min":5,"reps_max":5},{"set_number":2,"kind":"working","reps_min":3,"reps_max":3}]'
R="$(update "$ID_A" "$SETS_2")"
check "update con meno serie: 200 e workout_exercise con le planned_sets" "$R" \
    '$status == 200 and .success == true and (.workout_exercise | keys) == ["equipment","exercise_id","exercise_name","id","muscle_group","notes","planned_sets","rest"] and .workout_exercise.planned_sets == [{"set_number":1,"kind":"working","reps_min":5,"reps_max":5,"to_failure":false,"intensity_technique":null},{"set_number":2,"kind":"working","reps_min":3,"reps_max":3,"to_failure":false,"intensity_technique":null}]'
check "...e coincide con l'esercizio che legge read_plans" "$(plan_exercises)" \
    ".records[0].days[0].exercises[0] == $(echo "${R#* }" | jq -c '.workout_exercise')"
check "read_plans: solo le 2 serie nuove, recupero e note aggiornati" "$(plan_exercises)" \
    '.records[0].days[0].exercises[0] | .rest == 45 and .notes == "nota 2" and (.planned_sets | map([.set_number, .kind, .reps_min, .reps_max]) == [[1,"working",5,5],[2,"working",3,3]])'
SETS_4='[{"set_number":1,"kind":"warmup"},{"set_number":2,"kind":"working","reps_min":10,"reps_max":12},{"set_number":3,"kind":"working","reps_min":10,"reps_max":12,"intensity_technique":"Rest-Pause"},{"set_number":4,"kind":"working","to_failure":true}]'
status_is "update con più serie: 200" "$(update "$ID_A" "$SETS_4")" 200
check "read_plans: le 4 serie nuove" "$(plan_exercises)" \
    '.records[0].days[0].exercises[0].planned_sets | map([.set_number, .kind, .reps_min, .reps_max, .to_failure, .intensity_technique]) == [[1,"warmup",null,null,false,null],[2,"working",10,12,false,null],[3,"working",10,12,false,"Rest-Pause"],[4,"working",null,null,true,null]]'
status_is "update non valido (riscaldamento dopo una allenante): 400" "$(update "$ID_A" "[$W5,{\"set_number\":2,\"kind\":\"warmup\"}]")" 400
status_is "update con un riscaldamento con tecnica: 400" "$(update "$ID_A" '[{"set_number":1,"kind":"warmup","intensity_technique":"Drop Set"},{"set_number":2,"kind":"working","reps_min":5,"reps_max":5}]')" 400
status_is "update senza planned_sets: 400" "$(call POST api/workout/update_exercise.php "$A" "{\"day_id\":$DAY,\"exercise_id\":$ID_A,\"sets\":3,\"reps\":\"10\",\"rest\":60}")" 400
check "dopo un update rifiutato le serie sono quelle di prima" "$(plan_exercises)" \
    '.records[0].days[0].exercises[0].planned_sets | map(.set_number) == [1,2,3,4]'

echo
echo "Riordino ed eliminazione: ogni esercizio tiene le sue serie"
status_is "update riporta A alle serie di partenza" "$(update "$ID_A" "$SETS_A")" 200
SETS_B='[{"set_number":1,"kind":"working","reps_min":15,"reps_max":15},{"set_number":2,"kind":"working","reps_min":15,"reps_max":15}]'
R="$(add "$EX_B" "$SETS_B")"
ID_B="$(echo "${R#* }" | jq -r '.workout_exercise.id')"
check "B sopra A: 200" "$(call POST api/workout/reorder_exercise.php "$A" "{\"day_id\":$DAY,\"exercise_id\":$ID_B,\"direction\":\"up\"}")" '$status == 200'
check "ordine B, A" "$(plan_exercises)" ".records[0].days[0].exercises | map(.id) == [$ID_B, $ID_A]"
check "B ha ancora le sue 2 serie 15-15" "$(plan_exercises)" \
    ".records[0].days[0].exercises[0] | .id == $ID_B and (.planned_sets | map([.set_number, .kind, .reps_min, .reps_max]) == [[1,\"working\",15,15],[2,\"working\",15,15]])"
check "A ha ancora le sue 6 serie" "$(plan_exercises)" \
    ".records[0].days[0].exercises[1] | .id == $ID_A and .planned_sets == $CANON_A"

echo
echo "Esportazione: planned_sets, nell'ordine della scheda"
EXPORT="$(call GET api/user/export.php "$A")"
check "export: B poi A, con le rispettive serie" "$EXPORT" \
    "[.. | objects | select(has(\"exercises\") and has(\"name\") and .name == \"Giorno 1\") | .exercises[] | .planned_sets | length] == [2, 6]"
check "export: le serie di A sono quelle canoniche" "$EXPORT" \
    "[.. | objects | select(has(\"exercises\") and has(\"name\") and .name == \"Giorno 1\") | .exercises[1].planned_sets] == [$CANON_A]"
check "export: sets, warmup_sets, reps e intensity_technique non ci sono" "$EXPORT" \
    '[.. | objects | select(has("exercises") and has("name") and .name == "Giorno 1") | .exercises[] | keys] | all(index("sets") == null and index("warmup_sets") == null and index("reps") == null and index("intensity_technique") == null)'

echo
echo "Eliminazione: l'esercizio sparisce, l'altro tiene le sue serie"
status_is "elimina B: 200" "$(call POST api/workout/delete_exercise.php "$A" "{\"day_id\":$DAY,\"exercise_id\":$ID_B}")" 200
check "resta A con le sue serie" "$(plan_exercises)" ".records[0].days[0].exercises | length == 1 and .[0].id == $ID_A and (.[0].planned_sets | length) == 6"
check "export: nessuna serie di B" "$(call GET api/user/export.php "$A")" \
    "[.. | objects | select(has(\"exercises\") and has(\"name\") and .name == \"Giorno 1\") | .exercises[] | .planned_sets | length] == [6]"

echo
if [[ $fails -eq 0 ]]; then printf '\033[32mTutti i %d controlli passati.\033[0m\n' "$checks"; else printf '\033[31m%d controlli su %d falliti.\033[0m\n' "$fails" "$checks"; exit 1; fi
