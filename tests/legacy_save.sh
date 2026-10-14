#!/usr/bin/env bash
#
# legacy_save.sh — controlla che un'app vecchia (senza idempotency_key) salvi un allenamento anche
# quando la migrazione 20 (colonna gym_workout_history.idempotency_key) non è ancora applicata.
# Serve al rilascio: l'immagine nuova può arrivare prima dello schema, e le app già pubblicate
# non devono ricevere 500.
#
#   tests/legacy_save.sh http://localhost:8080/backend/
#
# Va lanciato su un database SENZA la migrazione 20: dopo, il controllo passa comunque ma non
# prova più nulla. Registra un account usa e getta e lo cancella alla fine. Non va lanciato in
# produzione: crea account veri.
#
# Richiede curl e jq. Esce con 1 se un controllo fallisce.

set -uo pipefail

BASE="${1:?uso: $(basename "$0") <url del backend, es. http://localhost:8080/backend/>}"
[[ "$BASE" == */ ]] || BASE="$BASE/"

PASS='Prova!Legacy2026'
SUFFIX="$(date +%s | tail -c 7)$RANDOM"

call() { # metodo path token [json] → "status corpo"
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

USER="lgc$SUFFIX"
call POST api/user/register.php "" "$(jq -nc --arg u "$USER" --arg e "$USER@example.com" --arg p "$PASS" --arg b "$(date -d '-30 years' +%Y-%m-%d)" \
    '{username:$u, email:$e, password:$p, birth_date:$b, gender:"O", accept_terms:true}')" >/dev/null
T="$(call POST api/user/mobile_login.php "" "$(jq -nc --arg u "$USER" --arg p "$PASS" '{username:$u, password:$p, device_info:"legacy_save.sh"}')" \
    | cut -d' ' -f2- | jq -r '.token // empty')"
[[ -n "$T" ]] || { echo "registrazione o login falliti (limite di registrazioni per IP?)" >&2; exit 1; }

cleanup() {
    call POST api/user/delete.php "$T" "$(jq -nc --arg p "$PASS" '{password:$p}')" >/dev/null
    echo "Account di prova cancellato."
}
trap cleanup EXIT

E1="$(call GET api/exercise/read_all.php "$T" | cut -d' ' -f2- | jq -r '.records[0].id')"
PLAN="$(call POST api/workout/create_plan.php "$T" '{"name":"Scheda app vecchia"}' | cut -d' ' -f2- | jq -r '.plan.id')"
DAY="$(call POST api/workout/create_days.php "$T" "{\"plan_id\":$PLAN,\"days\":[{\"name\":\"Giorno 1\"}]}" | cut -d' ' -f2- | jq -r '.days[0].id')"
call POST api/workout/add_exercise.php "$T" "{\"day_id\":$DAY,\"exercise_id\":$E1,\"sets\":3,\"reps\":\"10\",\"rest\":60}" >/dev/null

echo "App vecchia: salvataggio senza idempotency_key"
BODY="$(jq -nc --argjson e "$E1" --argjson d "$DAY" '{workout_records: [range(1;4) | {exercise_id:$e, day_id:$d, set_number:., weight:20, reps:10}]}')"
RES="$(call POST api/workout/record_workout.php "$T" "$BODY")"
if echo "${RES#* }" | jq -e --argjson status "${RES%% *}" '$status == 201 and .success' >/dev/null 2>&1; then
    printf '  \033[32m✓\033[0m salvato (201), anche senza la colonna idempotency_key\n'
else
    printf '  \033[31m✗\033[0m salvato (201), anche senza la colonna idempotency_key\n      ricevuto: %s\n' "${RES:0:300}"
    exit 1
fi
