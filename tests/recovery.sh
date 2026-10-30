#!/usr/bin/env bash
#
# recovery.sh — controlla il recupero muscolare di workout_stats/dashboard.php (#32): un account
# senza allenamenti ha i 12 muscoli PRONTO al 100% e senza ready_at; dopo un allenamento di petto
# solo il petto è IN RECUPERO o AFFATICATO, con last_trained e ready_at; le misure del corpo non
# entrano nel calcolo (recupero identico con il consenso health_data dato e revocato).
#
#   tests/recovery.sh http://localhost:8080/backend/
#
# Registra un account usa e getta e lo cancella alla fine. Non va lanciato in produzione: crea
# account veri. Richiede curl e jq. Esce con 1 se un controllo fallisce.

set -uo pipefail

BASE="${1:?uso: $(basename "$0") <url del backend, es. http://localhost:8080/backend/>}"
[[ "$BASE" == */ ]] || BASE="$BASE/"

PASS='Prova!Recupero2026'
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
    call POST api/user/mobile_login.php "" "$(jq -nc --arg u "$user" --arg p "$PASS" '{username:$u, password:$p, device_info:"recovery.sh"}')" \
        | cut -d' ' -f2- | jq -r '.token // empty'
}

A="$(register_and_login "recA$SUFFIX")"
[[ -n "$A" ]] || { echo "registrazione o login falliti (limite di registrazioni per IP?)" >&2; exit 1; }

cleanup() {
    call POST api/user/delete.php "$A" "$(jq -nc --arg p "$PASS" '{password:$p}')" >/dev/null
    echo "Account di prova cancellato."
}
trap cleanup EXIT

dashboard() { call GET api/workout_stats/dashboard.php "$A"; }

echo "Account nuovo, nessun allenamento"
D="$(dashboard)"
check "dashboard risponde 200 con success" "$D" '$status == 200 and .success == true'
check "recovery ha esattamente i 12 muscoli" "$D" '.recovery | keys | sort == ["abduttori","addome","adduttori","bicipiti","femorali","glutei","petto","polpacci","quadricipiti","schiena","spalle","tricipiti"]'
check "tutti i muscoli PRONTO al 100%" "$D" '[.recovery[] | select(.status == "PRONTO" and .percent == 100)] | length == 12'
check "last_trained null per tutti" "$D" '[.recovery[] | select(.last_trained == null)] | length == 12'
check "nessuna chiave ready_at" "$D" '[.recovery[] | has("ready_at")] | any | not'

echo
echo "Un allenamento di petto registrato ora"
CHEST="$(call GET api/exercise/read_all.php "$A" | cut -d' ' -f2- | jq -r '[.records[] | select(.muscle_group == "petto")][0].id // empty')"
[[ -n "$CHEST" ]] || { echo "esercizio di petto del catalogo non trovato" >&2; exit 1; }

plan="$(call POST api/workout/create_plan.php "$A" '{"name":"Scheda recupero"}' | cut -d' ' -f2- | jq -r '.plan.id')"
call POST api/workout/activate_plan.php "$A" "{\"plan_id\":$plan}" >/dev/null
DAY="$(call POST api/workout/create_days.php "$A" "{\"plan_id\":$plan,\"days\":[{\"name\":\"Giorno 1\"}]}" | cut -d' ' -f2- | jq -r '.days[0].id')"
call POST api/workout/add_exercise.php "$A" "{\"day_id\":$DAY,\"exercise_id\":$CHEST,\"sets\":4,\"reps\":\"8\",\"rest\":90}" >/dev/null

RECS="$(jq -nc --argjson d "$DAY" --argjson e "$CHEST" '[range(1;5)] | map({exercise_id:$e, day_id:$d, set_number:., weight:60, reps:8})')"
START="$(date -u -d '-30 min' +%Y-%m-%dT%H:%M:%SZ)"
RESP="$(call POST api/workout/record_workout.php "$A" "$(jq -nc --argjson r "$RECS" --arg s "$START" '{workout_records:$r, start_time:$s}')")"
check "allenamento salvato" "$RESP" '$status == 200 or $status == 201'

D="$(dashboard)"
check "petto non è più PRONTO (IN RECUPERO o AFFATICATO)" "$D" '.recovery.petto.status | IN("IN RECUPERO", "AFFATICATO")'
check "petto: percent tra 0 e 99" "$D" '.recovery.petto.percent >= 0 and .recovery.petto.percent <= 99'
check "petto: last_trained è una data" "$D" '.recovery.petto.last_trained | type == "string" and test("^[0-9]{4}-[0-9]{2}-[0-9]{2} ")'
check "petto: ready_at presente, formato ISO 8601 con offset" "$D" '.recovery.petto.ready_at | type == "string" and test("^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:]{8}[+-][0-9]{2}:[0-9]{2}$")'
READY="$(echo "${D#* }" | jq -r '.recovery.petto.ready_at')"
if [[ "$(date -d "$READY" +%s 2>/dev/null || echo 0)" -gt "$(date +%s)" ]]; then ok "petto: ready_at è nel futuro"; else ko "petto: ready_at è nel futuro" "ready_at: $READY"; fi
check "gli altri 11 muscoli restano PRONTO al 100% senza ready_at" "$D" '[.recovery | to_entries[] | select(.key != "petto") | .value | select(.status == "PRONTO" and .percent == 100 and .last_trained == null and (has("ready_at") | not))] | length == 11'
BEFORE="$(echo "${D#* }" | jq -cS '.recovery | map_values(del(.percent))')"

echo
echo "Misure del corpo: recupero identico con consenso dato e revocato"
CONSENT="$(call POST api/user/consent.php "$A" '{"purpose":"health_data","action":"grant"}')"
check "consenso health_data concesso" "$CONSENT" '$status == 200'
STAT="$(call POST api/user_stats/create.php "$A" "$(jq -nc --arg d "$(date +%Y-%m-%d)" '{date:$d, weight:82.5, body_fat_percentage:18}')")"
check "misura del corpo salvata" "$STAT" '$status == 200 or $status == 201'
WITH="$(dashboard | cut -d' ' -f2- | jq -cS '.recovery | map_values(del(.percent))')"
REVOKE="$(call POST api/user/consent.php "$A" '{"purpose":"health_data","action":"revoke"}')"
check "consenso health_data revocato" "$REVOKE" '$status == 200'
WITHOUT="$(dashboard | cut -d' ' -f2- | jq -cS '.recovery | map_values(del(.percent))')"
[[ "$WITH" == "$BEFORE" ]] && ok "recovery con misura e consenso = recovery di prima" || ko "recovery con misura e consenso = recovery di prima" "prima: $BEFORE | con consenso: $WITH"
[[ "$WITHOUT" == "$BEFORE" ]] && ok "recovery dopo la revoca = recovery di prima" || ko "recovery dopo la revoca = recovery di prima" "prima: $BEFORE | dopo la revoca: $WITHOUT"

echo
if [[ $fails -eq 0 ]]; then echo "$checks controlli, 0 falliti"; else echo "$checks controlli, $fails falliti"; exit 1; fi
