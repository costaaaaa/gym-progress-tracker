#!/usr/bin/env bash
#
# health_sync.sh — controlla le regole delle misure che arrivano da Apple Salute / Health Connect
# (api/user_stats/health_sync.php) e l'inserimento manuale nello stesso giorno.
#
#   tests/health_sync.sh https://staging.example/backend/
#   tests/health_sync.sh http://localhost:8080/backend/
#
# Registra un account usa e getta, usa il token Bearer come l'app mobile e alla fine lo cancella.
# Da lanciare prima di ogni rilascio che tocca le misure. Non va lanciato in produzione: crea
# account veri.
#
# Richiede curl e jq. Esce con 1 se un controllo fallisce.

set -uo pipefail

BASE="${1:?uso: $(basename "$0") <url del backend, es. http://localhost:8080/backend/>}"
[[ "$BASE" == */ ]] || BASE="$BASE/"

PASS='Prova!Salute2026'
SUFFIX="$(date +%s | tail -c 7)$RANDOM"
fails=0
checks=0

ok()   { checks=$((checks + 1)); printf '  \033[32m✓\033[0m %s\n' "$1"; }
ko()   { checks=$((checks + 1)); fails=$((fails + 1)); printf '  \033[31m✗\033[0m %s\n' "$1"; [[ -n "${2:-}" ]] && printf '      %s\n' "$2"; }

# call METODO path token [json] → stampa "status corpo"
call() {
    local method="$1" path="$2" token="$3" body="${4:-}"
    local args=(-s -o /tmp/health_sync.$$ -w '%{http_code}' -X "$method" -H 'Content-Type: application/json')
    [[ -n "$token" ]] && args+=(-H "Authorization: Bearer $token")
    [[ -n "$body" ]] && args+=(--data "$body")
    local status
    status="$(curl "${args[@]}" "$BASE$path")"
    printf '%s %s' "$status" "$(cat /tmp/health_sync.$$)"
    rm -f /tmp/health_sync.$$
}

# expect "descrizione" status_atteso "risposta di call"
expect() {
    local desc="$1" want="$2" got="$3"
    if [[ "${got%% *}" == "$want" ]]; then ok "$desc"; else ko "$desc" "atteso $want, ricevuto: ${got:0:200}"; fi
}

# check "descrizione" "risposta di call" 'filtro jq che deve dare true'
check() {
    local desc="$1" got="$2" filter="$3"
    if echo "${got#* }" | jq -e "$filter" >/dev/null 2>&1; then ok "$desc"; else ko "$desc" "${got:0:300}"; fi
}

sync() { call POST api/user_stats/health_sync.php "$T" "$1"; }
day()  { call GET api/user_stats/read.php "$T" | cut -d' ' -f2- | jq -c --arg d "$1" '.records[] | select(.date == $d)'; }

USER="hsA$SUFFIX"
echo "Account di prova: $USER"
call POST api/user/register.php "" "$(jq -nc --arg u "$USER" --arg e "$USER@example.com" --arg p "$PASS" --arg b "$(date -d '-30 years' +%Y-%m-%d)" \
    '{username:$u, email:$e, password:$p, birth_date:$b, gender:"O", accept_terms:true}')" >/dev/null
T="$(call POST api/user/mobile_login.php "" "$(jq -nc --arg u "$USER" --arg p "$PASS" '{username:$u, password:$p, device_info:"health_sync.sh"}')" \
    | cut -d' ' -f2- | jq -r '.token // empty')"
[[ -n "$T" ]] || { echo "registrazione o login falliti (limite di registrazioni per IP?)" >&2; exit 1; }

cleanup() {
    call POST api/user/delete.php "$T" "$(jq -nc --arg p "$PASS" '{password:$p}')" >/dev/null
    echo "Account di prova cancellato."
}
trap cleanup EXIT

D1="$(date -d '-3 days' +%Y-%m-%d)"
D2="$(date -d '-2 days' +%Y-%m-%d)"
D3="$(date -d '-1 days' +%Y-%m-%d)"

echo "Accesso e consenso"
expect "senza login: 401" 401 "$(call POST api/user_stats/health_sync.php "" '{"days":[]}')"
expect "metodo sbagliato: 405" 405 "$(call GET api/user_stats/health_sync.php "$T")"
expect "senza consenso: 403" 403 "$(sync "{\"days\":[{\"date\":\"$D1\",\"weight\":80}]}")"
expect "consenso dato" 200 "$(call POST api/user/consent.php "$T" '{"purpose":"health_data","action":"grant"}')"
expect "richiesta senza giorni: 400" 400 "$(sync '{"days":"no"}')"

echo "Importazione"
res="$(sync "{\"days\":[{\"date\":\"$D1\",\"weight\":80.456,\"body_fat_percentage\":18},{\"date\":\"$D2\",\"weight\":79.9}]}")"
expect "due giorni importati" 200 "$res"
check "  → created 2" "$res" '.created == 2 and .updated == 0'
check "valori arrotondati e segnati come importati" "200 $(day "$D1")" '.weight == "80.46" and (.health_fields | split(",") | sort) == ["body_fat_percentage","weight"]'
res="$(sync "{\"days\":[{\"date\":\"$D1\",\"weight\":80.46,\"body_fat_percentage\":18}]}")"
check "stessi dati una seconda volta: niente cambia" "$res" '.skipped == 1 and .created == 0 and .updated == 0'
res="$(sync "{\"days\":[{\"date\":\"$D1\",\"weight\":81}]}")"
check "nuovo valore da Salute aggiorna" "$res" '.updated == 1'
res="$(sync "{\"days\":[{\"date\":\"$D3\",\"weight\":900},{\"date\":\"2099-01-01\",\"weight\":80},{\"date\":\"$D3\",\"waist_size\":84}]}")"
check "valori e date assurdi scartati, il resto passa" "$res" '(.errors | length) == 2 and .created == 1'
check "campi sconosciuti ignorati" "$(sync "{\"days\":[{\"date\":\"$D3\",\"chest_size\":100}]}")" '.skipped == 1'

echo "Il manuale vince"
res="$(call POST api/user_stats/create.php "$T" "{\"date\":\"$D1\",\"weight\":82,\"chest_size\":100}")"
expect "misura manuale su un giorno importato: 200, non 500" 200 "$res"
check "  → la riga unisce manuale e importato" "$res" '.user_stat.weight == "82.00" and .user_stat.chest_size == "100.00" and .user_stat.body_fat_percentage == "18.00" and .user_stat.health_fields == "body_fat_percentage"'
res="$(sync "{\"days\":[{\"date\":\"$D1\",\"weight\":70}]}")"
check "Salute non sovrascrive il peso manuale" "$res" '.skipped == 1'
check "  → peso ancora 82" "200 $(day "$D1")" '.weight == "82.00"'
expect "seconda misura manuale nello stesso giorno: 200" 200 "$(call POST api/user_stats/create.php "$T" "{\"date\":\"$D1\",\"arm_size\":38}")"
check "  → la riga si completa" "200 $(day "$D1")" '.arm_size == "38.00" and .chest_size == "100.00"'
expect "misura manuale su un giorno nuovo: 201" 201 "$(call POST api/user_stats/create.php "$T" "{\"date\":\"$(date -d '-10 days' +%Y-%m-%d)\",\"weight\":83}")"

echo "Cancellazioni in Salute"
res="$(sync "{\"days\":[{\"date\":\"$D1\",\"weight\":null,\"body_fat_percentage\":null}]}")"
check "null svuota solo l'importato" "$res" '.updated == 1'
check "  → grasso vuoto, peso manuale resta" "200 $(day "$D1")" '.body_fat_percentage == null and .weight == "82.00" and .health_fields == ""'
res="$(sync "{\"days\":[{\"date\":\"$D2\",\"weight\":null}]}")"
check "giorno rimasto vuoto: riga cancellata" "$res" '.cleared == 1'
[[ -z "$(day "$D2")" ]] && ok "  → il giorno non c'è più" || ko "  → il giorno non c'è più"

echo "Scollegare"
sync "{\"days\":[{\"date\":\"$D1\",\"body_fat_percentage\":17}]}" >/dev/null
res="$(call POST api/user_stats/health_sync.php "$T" '{"action":"unlink"}')"
check "unlink svuota i valori importati" "$res" '.cleared_rows == 2'
check "  → sul giorno misto restano i manuali" "200 $(day "$D1")" '.body_fat_percentage == null and .weight == "82.00" and .chest_size == "100.00"'
[[ -z "$(day "$D3")" ]] && ok "  → il giorno solo importato è cancellato" || ko "  → il giorno solo importato è cancellato"

echo "Export"
check "l'export dice cosa arriva da Salute" "$(call GET api/user/export.php "$T")" '.misure | all(has("da_salute"))'

echo
if [[ $fails -eq 0 ]]; then echo "TUTTO OK ($checks controlli)"; else echo "FALLITI $fails su $checks"; exit 1; fi
