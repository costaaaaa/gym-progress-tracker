#!/usr/bin/env bash
#
# groups_access.sh — controlla chi può vedere e fare cosa negli endpoint dei gruppi.
#
#   tests/groups_access.sh https://staging.example/backend/
#   tests/groups_access.sh http://localhost:8080/backend/
#
# Registra quattro account usa e getta (A owner, B membro, C estraneo, Y di 15 anni),
# usa i token Bearer come l'app mobile e alla fine cancella gli account (e con loro i
# gruppi, per ON DELETE CASCADE). Da lanciare prima di ogni rilascio che tocca i gruppi.
# Non va lanciato in produzione: crea account veri.
#
# Richiede curl e jq. Esce con 1 se un controllo fallisce.

set -uo pipefail

BASE="${1:?uso: $(basename "$0") <url del backend, es. http://localhost:8080/backend/>}"
[[ "$BASE" == */ ]] || BASE="$BASE/"

PASS='Prova!Gruppi2026'
SUFFIX="$(date +%s | tail -c 7)$RANDOM"
fails=0
checks=0

ok()   { checks=$((checks + 1)); printf '  \033[32m✓\033[0m %s\n' "$1"; }
ko()   { checks=$((checks + 1)); fails=$((fails + 1)); printf '  \033[31m✗\033[0m %s\n' "$1"; [[ -n "${2:-}" ]] && printf '      %s\n' "$2"; }

# call METODO path token [json] → stampa "status corpo"
call() {
    local method="$1" path="$2" token="$3" body="${4:-}"
    local args=(-s -o /tmp/groups_access.$$ -w '%{http_code}' -X "$method" -H 'Content-Type: application/json')
    [[ -n "$token" ]] && args+=(-H "Authorization: Bearer $token")
    [[ -n "$body" ]] && args+=(--data "$body")
    local status
    status="$(curl "${args[@]}" "$BASE$path")"
    printf '%s %s' "$status" "$(cat /tmp/groups_access.$$)"
    rm -f /tmp/groups_access.$$
}

# expect "descrizione" status_atteso "risposta di call"
expect() {
    local desc="$1" want="$2" got="$3"
    if [[ "${got%% *}" == "$want" ]]; then ok "$desc"; else ko "$desc" "atteso $want, ricevuto: ${got:0:200}"; fi
}

years_ago() { date -d "-$1 years -10 days" +%Y-%m-%d; }

register_and_login() { # nome anni → token
    local user="$1" years="$2"
    call POST api/user/register.php "" "$(jq -nc --arg u "$user" --arg e "$user@example.com" --arg p "$PASS" --arg b "$(years_ago "$years")" \
        '{username:$u, email:$e, password:$p, birth_date:$b, gender:"O", accept_terms:true}')" >/dev/null
    call POST api/user/mobile_login.php "" "$(jq -nc --arg u "$user" --arg p "$PASS" '{username:$u, password:$p, device_info:"groups_access.sh"}')" \
        | cut -d' ' -f2- | jq -r '.token // empty'
}

A_USER="gtA$SUFFIX"; B_USER="gtB$SUFFIX"; C_USER="gtC$SUFFIX"; Y_USER="gtY$SUFFIX"
echo "Account di prova: $A_USER $B_USER $C_USER $Y_USER"
A="$(register_and_login "$A_USER" 30)"
B="$(register_and_login "$B_USER" 25)"
C="$(register_and_login "$C_USER" 40)"
Y="$(register_and_login "$Y_USER" 15)"
[[ -n "$A" && -n "$B" && -n "$C" && -n "$Y" ]] || { echo "registrazione o login falliti (limite di registrazioni per IP?)" >&2; exit 1; }

cleanup() {
    for t in "$A" "$B" "$C" "$Y"; do
        call POST api/user/delete.php "$t" "$(jq -nc --arg p "$PASS" '{password:$p}')" >/dev/null
    done
    echo "Account di prova cancellati."
}
trap cleanup EXIT

echo "Creazione e ingresso"
expect "senza login: 401" 401 "$(call GET api/groups/list.php "")"
expect "metodo sbagliato: 405" 405 "$(call GET api/groups/create.php "$A")"
expect "nome con un link rifiutato" 400 "$(call POST api/groups/create.php "$A" '{"name":"vai su www.spam.com","type":"friends"}')"
res="$(call POST api/groups/create.php "$A" '{"name":"Panca del martedì","type":"gym"}')"
expect "A crea un gruppo" 201 "$res"
GID="$(echo "${res#* }" | jq -r '.group.id')"
CODE="$(echo "${res#* }" | jq -r '.group.invite_code')"
expect "Y (15 anni) non può creare gruppi" 403 "$(call POST api/groups/create.php "$Y" '{"name":"Giovani","type":"friends"}')"

res="$(call GET "api/groups/preview.php?code=$CODE" "$B")"
expect "B vede l'anteprima" 200 "$res"
if echo "${res#* }" | jq -e '.group | has("members") or has("invite_code")' >/dev/null; then ko "l'anteprima non elenca membri né codice"; else ok "l'anteprima non elenca membri né codice"; fi
expect "ingresso senza consenso rifiutato" 400 "$(call POST api/groups/join.php "$B" "{\"code\":\"$CODE\"}")"
expect "codice sbagliato: 404" 404 "$(call POST api/groups/join.php "$B" '{"code":"AAAAAAAAAA","consent":true}')"
expect "B entra con il consenso" 200 "$(call POST api/groups/join.php "$B" "{\"code\":\"$CODE\",\"consent\":true}")"
res="$(call POST api/groups/join.php "$B" "{\"code\":\"$CODE\",\"consent\":true}")"
if [[ "${res%% *}" == 200 ]] && echo "${res#* }" | jq -e '.already_member == true' >/dev/null; then ok "secondo ingresso idempotente"; else ko "secondo ingresso idempotente" "$res"; fi
expect "Y (15 anni) non può entrare" 403 "$(call POST api/groups/join.php "$Y" "{\"code\":\"$CODE\",\"consent\":true}")"

echo "Lettura"
res="$(call GET "api/groups/read.php?group_id=$GID&board=week" "$A")"
expect "A legge il gruppo" 200 "$res"
body="${res#* }"
if echo "$body" | jq -e '.board | length == 2' >/dev/null; then ok "classifica con due membri"; else ko "classifica con due membri" "$body"; fi
if echo "$body" | grep -qiE '"(user_id|email|password)"|@example\.com'; then ko "nessun user_id o email nella risposta"; else ok "nessun user_id o email nella risposta"; fi
if echo "$body" | jq -e '.group.invite_code and (.members[0].ref | type == "string")' >/dev/null; then ok "l'owner vede codice e riferimenti"; else ko "l'owner vede codice e riferimenti" "$body"; fi
res="$(call GET "api/groups/read.php?group_id=$GID&board=level" "$B")"
expect "B legge il gruppo" 200 "$res"
if echo "${res#* }" | jq -e '(.group | has("invite_code") | not) and ([.members[] | has("ref")] | any | not)' >/dev/null; then ok "il membro non vede codice né riferimenti"; else ko "il membro non vede codice né riferimenti" "$res"; fi
expect "C (estraneo) riceve 404" 404 "$(call GET "api/groups/read.php?group_id=$GID" "$C")"
expect "gruppo inesistente: 404" 404 "$(call GET "api/groups/read.php?group_id=999999999" "$A")"
if call GET api/groups/list.php "$C" | cut -d' ' -f2- | jq -e '.groups | length == 0' >/dev/null; then ok "C non ha gruppi in lista"; else ko "C non ha gruppi in lista"; fi

echo "Gestione"
B_REF="$(call GET "api/groups/read.php?group_id=$GID" "$A" | cut -d' ' -f2- | jq -r --arg u "$B_USER" '.members[] | select(.username == $u) | .ref')"
A_REF="$(call GET "api/groups/read.php?group_id=$GID" "$A" | cut -d' ' -f2- | jq -r --arg u "$A_USER" '.members[] | select(.username == $u) | .ref')"
expect "B (membro) non può rinominare" 403 "$(call POST api/groups/manage.php "$B" "{\"group_id\":$GID,\"action\":\"rename\",\"name\":\"Mio\"}")"
expect "B non può rimuovere l'owner" 403 "$(call POST api/groups/manage.php "$B" "{\"group_id\":$GID,\"action\":\"remove_member\",\"ref\":\"$A_REF\"}")"
expect "C non può gestire: 404" 404 "$(call POST api/groups/manage.php "$C" "{\"group_id\":$GID,\"action\":\"delete\"}")"
expect "A rinomina" 200 "$(call POST api/groups/manage.php "$A" "{\"group_id\":$GID,\"action\":\"rename\",\"name\":\"Panca del giovedì\"}")"
res="$(call POST api/groups/manage.php "$A" "{\"group_id\":$GID,\"action\":\"regenerate_code\"}")"
expect "A rigenera il codice" 200 "$res"
NEW_CODE="$(echo "${res#* }" | jq -r '.invite_code')"
expect "il vecchio codice non vale più" 404 "$(call GET "api/groups/preview.php?code=$CODE" "$C")"
expect "A chiude gli inviti" 200 "$(call POST api/groups/manage.php "$A" "{\"group_id\":$GID,\"action\":\"toggle_invites\",\"enabled\":false}")"
expect "con inviti chiusi C non entra" 404 "$(call POST api/groups/join.php "$C" "{\"code\":\"$NEW_CODE\",\"consent\":true}")"
expect "A riapre gli inviti" 200 "$(call POST api/groups/manage.php "$A" "{\"group_id\":$GID,\"action\":\"toggle_invites\",\"enabled\":true}")"
expect "A rimuove B" 200 "$(call POST api/groups/manage.php "$A" "{\"group_id\":$GID,\"action\":\"remove_member\",\"ref\":\"$B_REF\"}")"
expect "B rimosso non legge più" 404 "$(call GET "api/groups/read.php?group_id=$GID" "$B")"
expect "l'owner non può uscire" 409 "$(call POST api/groups/leave.php "$A" "{\"group_id\":$GID}")"
expect "C entra con il nuovo codice" 200 "$(call POST api/groups/join.php "$C" "{\"code\":\"$NEW_CODE\",\"consent\":true}")"
expect "C esce" 200 "$(call POST api/groups/leave.php "$C" "{\"group_id\":$GID}")"
expect "C uscito non legge più" 404 "$(call GET "api/groups/read.php?group_id=$GID" "$C")"
expect "A elimina il gruppo" 200 "$(call POST api/groups/manage.php "$A" "{\"group_id\":$GID,\"action\":\"delete\"}")"
expect "gruppo eliminato: 404 anche per A" 404 "$(call GET "api/groups/read.php?group_id=$GID" "$A")"

echo "Export"
res="$(call POST api/groups/create.php "$B" '{"name":"Export","type":"friends"}')"
if call GET api/user/export.php "$B" | cut -d' ' -f2- | jq -e '.gruppi | length == 1' >/dev/null; then ok "l'export contiene i gruppi"; else ko "l'export contiene i gruppi"; fi

echo "Limite di tentativi sui codici"
limited=0
for _ in $(seq 1 25); do
    [[ "$(call GET "api/groups/preview.php?code=BBBBBBBBBB" "$C" | cut -d' ' -f1)" == 429 ]] && { limited=1; break; }
done
if [[ $limited -eq 1 ]]; then ok "dopo troppi tentativi risponde 429"; else ko "dopo troppi tentativi risponde 429"; fi

echo
if [[ $fails -eq 0 ]]; then echo "TUTTO OK ($checks controlli)"; else echo "FALLITI $fails su $checks"; exit 1; fi
