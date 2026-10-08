#!/usr/bin/env bash
#
# locale.sh — lingua dei messaggi del server: header X-Locale senza login, lingua dell'account
# (gym_users.locale) con il login, user.locale nella risposta del login.
#
#   tests/locale.sh http://localhost:8080/backend/
#
# Registra due account usa e getta (uno italiano, uno inglese) e alla fine li cancella. Chiede
# anche l'email di reset per l'account inglese: con MAIL_DRIVER=log oggetto, testo e link /en/
# si leggono nei log del container PHP. Non va lanciato in produzione: crea account veri.
#
# Richiede curl e jq. Esce con 1 se un controllo fallisce.

set -uo pipefail

BASE="${1:?uso: $(basename "$0") <url del backend, es. http://localhost:8080/backend/>}"
[[ "$BASE" == */ ]] || BASE="$BASE/"

PASS='Prova!Lingua2026'
SUFFIX="$(date +%s | tail -c 7)$RANDOM"
fails=0
checks=0

ok()   { checks=$((checks + 1)); printf '  \033[32m✓\033[0m %s\n' "$1"; }
ko()   { checks=$((checks + 1)); fails=$((fails + 1)); printf '  \033[31m✗\033[0m %s\n' "$1"; [[ -n "${2:-}" ]] && printf '      %s\n' "$2"; }

# call METODO path locale token [json] → stampa il corpo (locale e token possono essere "")
call() {
    local method="$1" path="$2" locale="$3" token="$4" body="${5:-}"
    local args=(-s -X "$method" -H 'Content-Type: application/json')
    [[ -n "$locale" ]] && args+=(-H "X-Locale: $locale")
    [[ -n "$token" ]] && args+=(-H "Authorization: Bearer $token")
    [[ -n "$body" ]] && args+=(--data "$body")
    curl "${args[@]}" "$BASE$path"
}

# expect descrizione campo-jq valore-atteso corpo
expect() {
    local got
    got="$(jq -r "$2" <<<"$4" 2>/dev/null)"
    if [[ "$got" == "$3" ]]; then ok "$1"; else ko "$1" "atteso: $3 — ricevuto: ${got:-$4}"; fi
}

creds() { jq -nc --arg u "$1" --arg p "$PASS" '{username:$u, password:$p, device_info:"locale.sh"}'; }

echo "Senza login decide X-Locale"
WRONG='{"username":"nessuno'"$SUFFIX"'","password":"Sbagliata!2026"}'
expect "login errato, nessun header → italiano" .message "Nome utente o password non validi." "$(call POST api/user/login.php "" "" "$WRONG")"
expect "login errato, X-Locale: en → inglese" .message "Invalid username or password." "$(call POST api/user/login.php en "" "$WRONG")"
expect "login errato, X-Locale: en-GB → inglese" .message "Invalid username or password." "$(call POST api/user/login.php en-GB "" "$WRONG")"
expect "login errato, X-Locale: fr → italiano" .message "Nome utente o password non validi." "$(call POST api/user/login.php fr "" "$WRONG")"
expect "senza token, X-Locale: en → 401 inglese" .message "Unauthorized. Please log in." "$(call GET api/user/read.php en "")"
expect "password debole in registrazione, X-Locale: en" .message "Password must be at least 8 characters long." \
    "$(call POST api/user/register.php en "" '{"username":"pw'"$SUFFIX"'","email":"pw'"$SUFFIX"'@example.com","password":"Ab1!"}')"

IT_USER="lxit$SUFFIX"; EN_USER="lxen$SUFFIX"
echo "Account di prova: $IT_USER $EN_USER"
register() { # utente lingua-account header
    call POST api/user/register.php "$3" "" "$(jq -nc --arg u "$1" --arg e "$1@example.com" --arg p "$PASS" --arg l "$2" --arg b "$(date -d '-30 years' +%Y-%m-%d)" \
        '{username:$u, email:$e, password:$p, birth_date:$b, gender:"O", accept_terms:true, locale:$l}')"
}
expect "registrazione inglese, X-Locale: en" .message "Account created successfully." "$(register "$EN_USER" en en)"
expect "registrazione italiana, nessun header" .message "Utente registrato con successo." "$(register "$IT_USER" it "")"

EN_LOGIN="$(call POST api/user/mobile_login.php "" "" "$(creds "$EN_USER")")"
IT_LOGIN="$(call POST api/user/mobile_login.php en "" "$(creds "$IT_USER")")"
EN="$(jq -r '.token // empty' <<<"$EN_LOGIN")"
IT="$(jq -r '.token // empty' <<<"$IT_LOGIN")"
[[ -n "$EN" && -n "$IT" ]] || { echo "registrazione o login falliti (limite di registrazioni per IP?)" >&2; exit 1; }

cleanup() {
    for t in "$EN" "$IT"; do
        call POST api/user/delete.php "" "$t" "$(jq -nc --arg p "$PASS" '{password:$p}')" >/dev/null
    done
    echo "Account di prova cancellati."
}
trap cleanup EXIT

echo "Con il login decide l'account"
expect "login mobile senza header, account inglese: user.locale" .user.locale en "$EN_LOGIN"
expect "login mobile senza header, account inglese: messaggio" .message "Login successful." "$EN_LOGIN"
expect "login mobile con X-Locale: en, account italiano: user.locale" .user.locale it "$IT_LOGIN"
expect "login mobile con X-Locale: en, account italiano: messaggio" .message "Accesso effettuato." "$IT_LOGIN"
expect "login web con X-Locale: it, account inglese" .user.locale en "$(call POST api/user/login.php it "" "$(creds "$EN_USER")")"
WRONG_PW='{"current_password":"Sbagliata!2026","new_password":"Nuova!Lingua2026"}'
expect "cambio password errato, account inglese con X-Locale: it" .message "The current password is incorrect." \
    "$(call POST api/user/change_password.php it "$EN" "$WRONG_PW")"
expect "cambio password errato, account italiano con X-Locale: en" .message "La password attuale non è corretta." \
    "$(call POST api/user/change_password.php en "$IT" "$WRONG_PW")"

echo "Email di reset"
expect "richiesta reset, X-Locale: en" .success true "$(call POST api/user/forgot_password.php en "" "{\"email\":\"$EN_USER@example.com\"}")"
echo "  → con MAIL_DRIVER=log: oggetto \"Reset your password\" e link /en/reset-password per $EN_USER@example.com nei log PHP"

echo
if ((fails)); then
    printf '\033[31m%d controlli falliti su %d\033[0m\n' "$fails" "$checks"
    exit 1
fi
printf '\033[32mTutti i %d controlli passati\033[0m\n' "$checks"
