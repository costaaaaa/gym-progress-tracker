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
new_account() { # utente email → imposta TOKEN (registra, entra, ricorda il token per la pulizia)
    register "$1" "$2" >/dev/null
    TOKEN="$(login "$1")"
    [[ -n "$TOKEN" ]] || { echo "registrazione o login falliti per $1 (limite di registrazioni per IP?)" >&2; exit 1; }
    TOKENS+=("$TOKEN")
}

# Gli account arrivati al limite (lxpwa…, lxpwb…) non si possono cancellare finché la finestra non
# scade (15 minuti) e il test non aspetta: restano su staging, da cancellare a mano.
cleanup() {
    local left=0 res
    for t in "${TOKENS[@]}"; do
        res="$(call POST api/user/delete.php "$t" "$(jq -nc --arg p "$PASS" '{password:$p}')")"
        [[ "$(jq -r .success <<<"$res" 2>/dev/null)" == true ]] || left=$((left + 1))
    done
    echo "Account di prova cancellati ($left rimasti perché bloccati dal limite sulla password: lxpw*)."
}
trap cleanup EXIT

echo "Email salvata così com'è"
MAIL_USER="lxmail$SUFFIX"
new_account "$MAIL_USER" "O'Brien+$SUFFIX@Example.com"; TOKEN_MAIL="$TOKEN"
expect "apostrofo e maiuscole: l'email torna minuscola e senza entità HTML" .email "o'brien+$SUFFIX@example.com" "$(call GET api/user/read.php "$TOKEN_MAIL")"

WRONG_CHANGE='{"current_password":"Sbagliata!2026","new_password":"Nuova!Account2026"}'
RIGHT_CHANGE="$(jq -nc --arg c "$PASS" --arg n "$NEWPASS" '{current_password:$c, new_password:$n}')"
wrong_attempts() { # path token json quanti → stampa gli status separati da spazio
    local out=() i
    for ((i = 0; i < $4; i++)); do out+=("$(status POST "$1" "$2" "$3" | cut -d' ' -f1)"); done
    echo "${out[*]}"
}

echo "Limite di tentativi sulla password attuale"
new_account "lxpwa$SUFFIX" "lxpwa$SUFFIX@example.com"; TOKEN_A="$TOKEN"
got="$(wrong_attempts api/user/change_password.php "$TOKEN_A" "$WRONG_CHANGE" 5)"
[[ "$got" == "400 400 400 400 400" ]] && ok "cambio password: i primi 5 errori sono 400" || ko "cambio password: i primi 5 errori sono 400" "ricevuto: $got"
got="$(status POST api/user/change_password.php "$TOKEN_A" "$WRONG_CHANGE")"
[[ "$got" =~ ^429\ [1-9][0-9]*$ ]] && ok "il 6° è 429 con Retry-After" || ko "il 6° è 429 con Retry-After" "ricevuto: $got"
got="$(status POST api/user/change_password.php "$TOKEN_A" "$RIGHT_CHANGE" | cut -d' ' -f1)"
[[ "$got" == 429 ]] && ok "bloccato anche con la password giusta" || ko "bloccato anche con la password giusta" "ricevuto: $got"

new_account "lxpwb$SUFFIX" "lxpwb$SUFFIX@example.com"; TOKEN_B="$TOKEN"
wrong_attempts api/user/change_password.php "$TOKEN_B" "$WRONG_CHANGE" 5 >/dev/null
got="$(status POST api/user/delete.php "$TOKEN_B" "$(jq -nc --arg p "$PASS" '{password:$p}')" | cut -d' ' -f1)"
[[ "$got" == 429 ]] && ok "stesso contatore: la cancellazione con la password giusta è 429" || ko "stesso contatore: la cancellazione con la password giusta è 429" "ricevuto: $got"
expect "l'account è ancora vivo" .success true "$(call GET api/user/read.php "$TOKEN_B")"

new_account "lxpwc$SUFFIX" "lxpwc$SUFFIX@example.com"; TOKEN_C="$TOKEN"
wrong_attempts api/user/change_password.php "$TOKEN_C" "$WRONG_CHANGE" 4 >/dev/null
expect "4 errori e poi la password giusta: cambiata" .success true "$(call POST api/user/change_password.php "$TOKEN_C" "$RIGHT_CHANGE")"
WRONG_AGAIN='{"current_password":"Sbagliata!2026","new_password":"Altra!Account2026"}'
got="$(wrong_attempts api/user/change_password.php "$TOKEN_C" "$WRONG_AGAIN" 4)"
[[ "$got" == "400 400 400 400" ]] && ok "la password giusta azzera il contatore" || ko "la password giusta azzera il contatore" "ricevuto: $got"
# Ripristina la password di partenza (per la pulizia); passa solo se il contatore è sotto il tetto
BACK_CHANGE="$(jq -nc --arg c "$NEWPASS" --arg n "$PASS" '{current_password:$c, new_password:$n}')"
expect "dopo 4 errori la password giusta passa ancora" .success true "$(call POST api/user/change_password.php "$TOKEN_C" "$BACK_CHANGE")"

echo
if ((fails)); then
    printf '\033[31m%d controlli falliti su %d\033[0m\n' "$fails" "$checks"
    exit 1
fi
printf '\033[32mTutti i %d controlli passati\033[0m\n' "$checks"
