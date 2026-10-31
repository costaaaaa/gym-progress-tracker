#!/usr/bin/env bash
#
# health_mark.sh — controlla workout_history/health_mark.php: il telefono segnala quali allenamenti ha
# scritto nell'app Salute (health_written_at) e read.php li espone come health_written.
#
#   tests/health_mark.sh http://localhost:8080/backend/
#
# Registra due account usa e getta (token Bearer) e li cancella alla fine. Non va lanciato in
# produzione: crea account veri.
#
# Richiede curl e jq. Esce con 1 se un controllo fallisce.

set -uo pipefail

BASE="${1:?uso: $(basename "$0") <url del backend, es. http://localhost:8080/backend/>}"
[[ "$BASE" == */ ]] || BASE="$BASE/"

PASS='Prova!Health2026'
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
    call POST api/user/mobile_login.php "" "$(jq -nc --arg u "$user" --arg p "$PASS" '{username:$u, password:$p, device_info:"health_mark.sh"}')" \
        | cut -d' ' -f2- | jq -r '.token // empty'
}

A="$(register_and_login "hmA$SUFFIX")"
B="$(register_and_login "hmB$SUFFIX")"
[[ -n "$A" && -n "$B" ]] || { echo "registrazione o login falliti (limite di registrazioni per IP?)" >&2; exit 1; }

cleanup() {
    call POST api/user/delete.php "$A" "$(jq -nc --arg p "$PASS" '{password:$p}')" >/dev/null
    call POST api/user/delete.php "$B" "$(jq -nc --arg p "$PASS" '{password:$p}')" >/dev/null
    echo "Account di prova cancellati."
}
trap cleanup EXIT

# Registra un allenamento e ne stampa l'id. Una scheda con un esercizio del catalogo per utente.
make_workout() { # token
    local t="$1" ex plan day
    ex="$(call GET api/exercise/read_all.php "$t" | cut -d' ' -f2- | jq -r '.records[0].id')"
    plan="$(call POST api/workout/create_plan.php "$t" '{"name":"Scheda salute"}' | cut -d' ' -f2- | jq -r '.plan.id')"
    day="$(call POST api/workout/create_days.php "$t" "{\"plan_id\":$plan,\"days\":[{\"name\":\"Giorno 1\"}]}" | cut -d' ' -f2- | jq -r '.days[0].id')"
    call POST api/workout/add_exercise.php "$t" "{\"day_id\":$day,\"exercise_id\":$ex,\"planned_sets\":[{\"set_number\":1,\"kind\":\"working\",\"reps_min\":10,\"reps_max\":10}],\"rest\":60}" >/dev/null
    call POST api/workout/record_workout.php "$t" \
        "{\"workout_records\":[{\"exercise_id\":$ex,\"day_id\":$day,\"set_number\":1,\"weight\":20,\"reps\":10}]}" \
        | cut -d' ' -f2- | jq -r '.id'
}

health_written() { # token id → true|false|null
    call GET api/workout_history/read.php "$1" | cut -d' ' -f2- | jq -r --argjson id "$2" '[.records[] | select(.id == $id)][0].health_written'
}

WA="$(make_workout "$A")"
WB="$(make_workout "$B")"
[[ "$WA" =~ ^[0-9]+$ && "$WB" =~ ^[0-9]+$ ]] || { echo "salvataggio degli allenamenti di prova fallito" >&2; exit 1; }

echo "Lettura (utente di prova)"
[[ "$(health_written "$A" "$WA")" == "false" ]] && ok "un allenamento nuovo non è in Salute: health_written false" || ko "un allenamento nuovo non è in Salute: health_written false" "ricevuto: $(health_written "$A" "$WA")"

echo "Segnalazione dal telefono"
check "senza token: 401" "$(call POST api/workout_history/health_mark.php "" "{\"written\":[$WA]}")" '$status == 401'
check "written: 200 e success" "$(call POST api/workout_history/health_mark.php "$A" "{\"written\":[$WA]}")" '$status == 200 and .success == true'
[[ "$(health_written "$A" "$WA")" == "true" ]] && ok "dopo written, read.php dà health_written true" || ko "dopo written, read.php dà health_written true" "ricevuto: $(health_written "$A" "$WA")"
check "removed: 200 e success" "$(call POST api/workout_history/health_mark.php "$A" "{\"removed\":[$WA]}")" '$status == 200 and .success == true'
[[ "$(health_written "$A" "$WA")" == "false" ]] && ok "dopo removed, read.php dà health_written false" || ko "dopo removed, read.php dà health_written false" "ricevuto: $(health_written "$A" "$WA")"

check "written e removed insieme nello stesso corpo" \
    "$(call POST api/workout_history/health_mark.php "$A" "{\"written\":[$WA],\"removed\":[999999999]}")" '$status == 200 and .success == true'
[[ "$(health_written "$A" "$WA")" == "true" ]] && ok "l'id sconosciuto in removed non disturba gli altri" || ko "l'id sconosciuto in removed non disturba gli altri" "ricevuto: $(health_written "$A" "$WA")"

echo "ID come stringa e id in entrambe le liste"
call POST api/workout_history/health_mark.php "$A" "{\"removed\":[$WA]}" >/dev/null
check "id come stringa di cifre: accettato, 200" "$(call POST api/workout_history/health_mark.php "$A" "{\"written\":[\"$WA\"]}")" '$status == 200 and .success == true'
[[ "$(health_written "$A" "$WA")" == "true" ]] && ok "l'id stringa segna l'allenamento come in Salute" || ko "l'id stringa segna l'allenamento come in Salute" "ricevuto: $(health_written "$A" "$WA")"
check "id sia in written sia in removed: 200" "$(call POST api/workout_history/health_mark.php "$A" "{\"written\":[$WA],\"removed\":[$WA]}")" '$status == 200 and .success == true'
[[ "$(health_written "$A" "$WA")" == "false" ]] && ok "se un id è in entrambe le liste vince removed" || ko "se un id è in entrambe le liste vince removed" "ricevuto: $(health_written "$A" "$WA")"
call POST api/workout_history/health_mark.php "$A" "{\"written\":[$WA]}" >/dev/null

echo "Solo le righe dell'utente"
check "id di un altro utente: ignorato, 200" "$(call POST api/workout_history/health_mark.php "$A" "{\"written\":[$WB]}")" '$status == 200 and .success == true'
[[ "$(health_written "$B" "$WB")" == "false" ]] && ok "l'allenamento dell'altro utente resta health_written false" || ko "l'allenamento dell'altro utente resta health_written false" "ricevuto: $(health_written "$B" "$WB")"
call POST api/workout_history/health_mark.php "$B" "{\"written\":[$WB]}" >/dev/null
call POST api/workout_history/health_mark.php "$A" "{\"removed\":[$WB]}" >/dev/null
[[ "$(health_written "$B" "$WB")" == "true" ]] && ok "removed di un altro utente non toglie nulla" || ko "removed di un altro utente non toglie nulla" "ricevuto: $(health_written "$B" "$WB")"

echo "Validazione"
many="$(jq -nc '{written: [range(1; 502)]}')"
check "più di 500 id: 400" "$(call POST api/workout_history/health_mark.php "$A" "$many")" '$status == 400 and .success == false'
exact="$(jq -nc '{written: [range(1; 501)]}')"
check "esattamente 500 id: accettati" "$(call POST api/workout_history/health_mark.php "$A" "$exact")" '$status == 200 and .success == true'
check "corpo senza written né removed: 400" "$(call POST api/workout_history/health_mark.php "$A" '{}')" '$status == 400 and .success == false'
check "written che non è una lista: 400" "$(call POST api/workout_history/health_mark.php "$A" '{"written":"7"}')" '$status == 400 and .success == false'
check "id che non sono numeri interi positivi: 400" "$(call POST api/workout_history/health_mark.php "$A" '{"written":["a",-1]}')" '$status == 400 and .success == false'
check "stringa non numerica o zero: 400" "$(call POST api/workout_history/health_mark.php "$A" '{"written":["12a","0"]}')" '$status == 400 and .success == false'
check "il messaggio d'errore c'è (italiano di default)" "$(call POST api/workout_history/health_mark.php "$A" '{}')" '(.message | type) == "string" and (.message | length) > 0'

echo
if [[ $fails -eq 0 ]]; then printf '\033[32mTutti i %d controlli passati.\033[0m\n' "$checks"; else printf '\033[31m%d controlli su %d falliti.\033[0m\n' "$fails" "$checks"; exit 1; fi
