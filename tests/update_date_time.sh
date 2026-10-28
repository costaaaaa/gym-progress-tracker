#!/usr/bin/env bash
#
# update_date_time.sh — controlla che workout_history/update_date.php, quando riceve solo YYYY-MM-DD,
# tenga l'orario originale dell'allenamento; se data nuova + orario originale cadono nel futuro
# (oggi, orario non ancora arrivato) usa l'ora attuale. Il server ragiona in Europe/Rome.
#
#   tests/update_date_time.sh http://localhost:8080/backend/
#
# Registra un account usa e getta (token Bearer) e lo cancella alla fine. Non va lanciato in
# produzione: crea account veri.
#
# Richiede curl e jq. Esce con 1 se un controllo fallisce.

set -uo pipefail

BASE="${1:?uso: $(basename "$0") <url del backend, es. http://localhost:8080/backend/>}"
[[ "$BASE" == */ ]] || BASE="$BASE/"

PASS='Prova!Move2026'
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
    call POST api/user/mobile_login.php "" "$(jq -nc --arg u "$user" --arg p "$PASS" '{username:$u, password:$p, device_info:"update_date_time.sh"}')" \
        | cut -d' ' -f2- | jq -r '.token // empty'
}

A="$(register_and_login "udA$SUFFIX")"
[[ -n "$A" ]] || { echo "registrazione o login falliti (limite di registrazioni per IP?)" >&2; exit 1; }

cleanup() {
    call POST api/user/delete.php "$A" "$(jq -nc --arg p "$PASS" '{password:$p}')" >/dev/null
    echo "Account di prova cancellato."
}
trap cleanup EXIT

export TZ=Europe/Rome
EX="$(call GET api/exercise/read_all.php "$A" | cut -d' ' -f2- | jq -r '.records[0].id')"
PLAN="$(call POST api/workout/create_plan.php "$A" '{"name":"Scheda data"}' | cut -d' ' -f2- | jq -r '.plan.id')"
DAY="$(call POST api/workout/create_days.php "$A" "{\"plan_id\":$PLAN,\"days\":[{\"name\":\"Giorno 1\"}]}" | cut -d' ' -f2- | jq -r '.days[0].id')"
call POST api/workout/add_exercise.php "$A" "{\"day_id\":$DAY,\"exercise_id\":$EX,\"sets\":1,\"reps\":\"10\",\"rest\":60}" >/dev/null

# Allenamento a una data e ora scelte ("3 days ago 07:41"): ne stampa l'id
make_workout() { # quando
    local start end
    local t; t="$(date -d "$1" +%s)" # "2 days ago 00:05 + 30 min" non lo capisce date: si somma sui secondi
    start="$(date -u -d "@$t" +%Y-%m-%dT%H:%M:%SZ)"; end="$(date -u -d "@$((t + 1800))" +%Y-%m-%dT%H:%M:%SZ)"
    call POST api/workout/record_workout.php "$A" \
        "{\"workout_records\":[{\"exercise_id\":$EX,\"day_id\":$DAY,\"set_number\":1,\"weight\":20,\"reps\":10}],\"start_time\":\"$start\",\"ended_at\":\"$end\",\"backdated\":true}" \
        | cut -d' ' -f2- | jq -r '.id'
}

stored_date() { # id → "YYYY-MM-DD HH:MM:SS" come in read.php
    call GET api/workout_history/read.php "$A" | cut -d' ' -f2- | jq -r --argjson id "$1" '[.records[] | select(.id == $id)][0].date'
}

echo "Orario originale tenuto (utente di prova)"
W1="$(make_workout '4 days ago 07:41')"
[[ "$W1" =~ ^[0-9]+$ ]] || { echo "salvataggio dell'allenamento di prova fallito" >&2; exit 1; }
BEFORE="$(stored_date "$W1")"
TARGET="$(date -d '2 days ago' +%F)"
check "solo YYYY-MM-DD: 200" "$(call POST api/workout_history/update_date.php "$A" "{\"id\":$W1,\"new_date\":\"$TARGET\"}")" '$status == 200 and .success == true'
AFTER="$(stored_date "$W1")"
[[ "$AFTER" == "$TARGET ${BEFORE#* }" ]] && ok "la data è quella nuova e l'orario resta ${BEFORE#* }" || ko "la data è quella nuova e l'orario resta ${BEFORE#* }" "prima: $BEFORE, dopo: $AFTER"

check "anteprima con solo YYYY-MM-DD: new_date ha lo stesso orario" \
    "$(call POST api/workout_history/update_date.php "$A" "{\"id\":$W1,\"new_date\":\"$(date -d '1 day ago' +%F)\",\"preview\":true}")" \
    ".success == true and (.new_date | test(\"T${BEFORE#* }\" ))"
[[ "$(stored_date "$W1")" == "$AFTER" ]] && ok "l'anteprima non cambia nulla" || ko "l'anteprima non cambia nulla" "dopo l'anteprima: $(stored_date "$W1")"

echo "Orario nel futuro: si usa l'ora attuale"
NOW_HM="$(date +%H:%M)"
if [[ "$NOW_HM" > "23:55" ]]; then
    echo "  (saltato: è troppo tardi per avere un orario ancora nel futuro oggi)"
else
    W2="$(make_workout '2 days ago 23:58')"
    [[ "$W2" =~ ^[0-9]+$ ]] || { echo "salvataggio dell'allenamento di prova fallito" >&2; exit 1; }
    TODAY="$(date +%F)"
    check "spostato a oggi con orario originale 23:58 ancora nel futuro: 200" \
        "$(call POST api/workout_history/update_date.php "$A" "{\"id\":$W2,\"new_date\":\"$TODAY\"}")" '$status == 200 and .success == true'
    D2="$(stored_date "$W2")"
    LIMIT="$(date -d '+1 minute' '+%F %T')"
    [[ "${D2%% *}" == "$TODAY" && "${D2#* }" != "23:58:00" && ! "$D2" > "$LIMIT" ]] && ok "oggi, con l'ora attuale e non nel futuro ($D2)" || ko "oggi, con l'ora attuale e non nel futuro" "data: $D2, limite: $LIMIT"
fi

echo "Orario originale già passato oggi: resta quello"
if [[ "$NOW_HM" < "00:10" ]]; then
    echo "  (saltato: è troppo presto perché 00:05 sia già passato oggi)"
else
    W3="$(make_workout '2 days ago 00:05')"
    [[ "$W3" =~ ^[0-9]+$ ]] || { echo "salvataggio dell'allenamento di prova fallito" >&2; exit 1; }
    check "spostato a oggi con orario originale 00:05 già passato: 200" \
        "$(call POST api/workout_history/update_date.php "$A" "{\"id\":$W3,\"new_date\":\"$(date +%F)\"}")" '$status == 200 and .success == true'
    D3="$(stored_date "$W3")"
    [[ "$D3" == "$(date +%F) 00:05:00" ]] && ok "oggi, con l'orario originale 00:05:00" || ko "oggi, con l'orario originale 00:05:00" "dopo: $D3"
fi

echo "Regole che restano"
check "data nel futuro: 400" "$(call POST api/workout_history/update_date.php "$A" "{\"id\":$W1,\"new_date\":\"$(date -d '+2 days' +%F)\"}")" '$status == 400 and .code == "future_date"'
check "oltre 30 giorni fa: 400" "$(call POST api/workout_history/update_date.php "$A" "{\"id\":$W1,\"new_date\":\"$(date -d '40 days ago' +%F)\"}")" '$status == 400 and .code == "target_too_old"'
check "data con orario esplicito: resta quello indicato" \
    "$(call POST api/workout_history/update_date.php "$A" "{\"id\":$W1,\"new_date\":\"$(date -d '3 days ago' +%F) 10:15:00\"}")" \
    '$status == 200 and .success == true'
[[ "$(stored_date "$W1")" == "$(date -d '3 days ago' +%F) 10:15:00" ]] && ok "orario esplicito salvato come indicato" || ko "orario esplicito salvato come indicato" "dopo: $(stored_date "$W1")"

echo
if [[ $fails -eq 0 ]]; then printf '\033[32mTutti i %d controlli passati.\033[0m\n' "$checks"; else printf '\033[31m%d controlli su %d falliti.\033[0m\n' "$fails" "$checks"; exit 1; fi
