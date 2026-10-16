#!/usr/bin/env bash
#
# account_rules.sh — regole dell'account: email salvata così com'è e limite di tentativi sulla
# password attuale (cambio password e cancellazione account).
#
#   tests/account_rules.sh http://localhost:8080/backend/
#
# Registra account usa e getta e alla fine li cancella. Non va lanciato in produzione: crea
# account veri. Il limite sulla password è di 5 errori ogni 15 minuti per account.
#
# Richiede curl e jq. Esce con 1 se un controllo fallisce.

set -uo pipefail

BASE="${1:?uso: $(basename "$0") <url del backend, es. http://localhost:8080/backend/>}"
[[ "$BASE" == */ ]] || BASE="$BASE/"

PASS='Prova!Account2026'
NEWPASS='Nuova!Account2026'
SUFFIX="$(date +%s | tail -c 7)$RANDOM"
fails=0
checks=0
TOKENS=()

ok()   { checks=$((checks + 1)); printf '  \033[32m✓\033[0m %s\n' "$1"; }
ko()   { checks=$((checks + 1)); fails=$((fails + 1)); printf '  \033[31m✗\033[0m %s\n' "$1"; [[ -n "${2:-}" ]] && printf '      %s\n' "$2"; }

# call METODO path token [json] → stampa il corpo
call() {
    local method="$1" path="$2" token="$3" body="${4:-}"
    local args=(-s -X "$method" -H 'Content-Type: application/json')
    [[ -n "$token" ]] && args+=(-H "Authorization: Bearer $token")
    [[ -n "$body" ]] && args+=(--data "$body")
    curl "${args[@]}" "$BASE$path"
}

# status METODO path token [json] → stampa lo status HTTP e, su 429, l'header Retry-After
status() {
    local method="$1" path="$2" token="$3" body="${4:-}"
    local args=(-s -o /dev/null -D - -X "$method" -H 'Content-Type: application/json')
    [[ -n "$token" ]] && args+=(-H "Authorization: Bearer $token")
    [[ -n "$body" ]] && args+=(--data "$body")
    curl "${args[@]}" "$BASE$path" | tr -d '\r' | awk 'NR==1{code=$2} tolower($1)=="retry-after:"{ra=$2} END{print code, ra}'
}

# expect descrizione campo-jq valore-atteso corpo
expect() {
    local got
    got="$(jq -r "$2" <<<"$4" 2>/dev/null)"
    if [[ "$got" == "$3" ]]; then ok "$1"; else ko "$1" "atteso: $3 — ricevuto: ${got:-$4}"; fi
}

# register utente email → corpo; login utente → token
register() {
    call POST api/user/register.php "" "$(jq -nc --arg u "$1" --arg e "$2" --arg p "$PASS" --arg b "$(date -d '-30 years' +%Y-%m-%d)" \
        '{username:$u, email:$e, password:$p, birth_date:$b, gender:"O", accept_terms:true, locale:"it"}')"
}
login() {
    call POST api/user/mobile_login.php "" "$(jq -nc --arg u "$1" --arg p "$PASS" '{username:$u, password:$p, device_info:"account_rules.sh"}')" | jq -r '.token // empty'
}
new_account() { # utente email → token (registra, entra, ricorda il token per la pulizia)
    register "$1" "$2" >/dev/null
    local t; t="$(login "$1")"
    [[ -n "$t" ]] || { echo "registrazione o login falliti per $1 (limite di registrazioni per IP?)" >&2; exit 1; }
    TOKENS+=("$t")
    printf '%s' "$t"
}

cleanup() {
    for t in "${TOKENS[@]}"; do
        call POST api/user/delete.php "$t" "$(jq -nc --arg p "$PASS" '{password:$p}')" >/dev/null
        call POST api/user/delete.php "$t" "$(jq -nc --arg p "$NEWPASS" '{password:$p}')" >/dev/null
    done
    echo "Account di prova cancellati."
}
trap cleanup EXIT

echo "Email salvata così com'è"
MAIL_USER="lxmail$SUFFIX"
TOKEN_MAIL="$(new_account "$MAIL_USER" "O'Brien+$SUFFIX@Example.com")"
expect "apostrofo e maiuscole: l'email torna minuscola e senza entità HTML" .email "o'brien+$SUFFIX@example.com" "$(call GET api/user/read.php "$TOKEN_MAIL")"

echo
if ((fails)); then
    printf '\033[31m%d controlli falliti su %d\033[0m\n' "$fails" "$checks"
    exit 1
fi
printf '\033[32mTutti i %d controlli passati\033[0m\n' "$checks"
