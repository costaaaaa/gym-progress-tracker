#!/usr/bin/env bash
#
# reports.sh — segnalazioni dei contenuti nei gruppi (DSA art. 16) e loro gestione dall'admin.
#
#   tests/reports.sh https://staging.example/backend/
#   ADMIN_USER=io ADMIN_PASS=... tests/reports.sh http://localhost:8080/backend/
#
# Registra tre account usa e getta (A owner, B membro, C estraneo), usa i token Bearer come l'app
# mobile e alla fine li cancella (e con loro il gruppo). La parte admin gira solo con ADMIN_USER e
# ADMIN_PASS di un account reso admin con `tools/admin.php grant`: senza, la salta.
# Non va lanciato in produzione: crea account veri.
#
# Richiede curl e jq. Esce con 1 se un controllo fallisce.

set -uo pipefail

BASE="${1:?uso: $(basename "$0") <url del backend, es. http://localhost:8080/backend/>}"
[[ "$BASE" == */ ]] || BASE="$BASE/"

PASS='Prova!Segnala2026'
SUFFIX="$(date +%s | tail -c 7)$RANDOM"
fails=0
checks=0

ok()   { checks=$((checks + 1)); printf '  \033[32m✓\033[0m %s\n' "$1"; }
ko()   { checks=$((checks + 1)); fails=$((fails + 1)); printf '  \033[31m✗\033[0m %s\n' "$1"; [[ -n "${2:-}" ]] && printf '      %s\n' "$2"; }

# call METODO path token [json] → stampa "status corpo"
call() {
    local method="$1" path="$2" token="$3" body="${4:-}"
    local args=(-s -o /tmp/reports.$$ -w '%{http_code}' -X "$method" -H 'Content-Type: application/json')
    [[ -n "$token" ]] && args+=(-H "Authorization: Bearer $token")
    [[ -n "$body" ]] && args+=(--data "$body")
    local status
    status="$(curl "${args[@]}" "$BASE$path")"
    printf '%s %s' "$status" "$(cat /tmp/reports.$$)"
    rm -f /tmp/reports.$$
}

# expect "descrizione" status_atteso "risposta di call"
expect() {
    local desc="$1" want="$2" got="$3"
    if [[ "${got%% *}" == "$want" ]]; then ok "$desc"; else ko "$desc" "atteso $want, ricevuto: ${got:0:200}"; fi
}

# check "descrizione" "risposta di call" 'filtro jq che deve essere vero'
check() {
    if echo "${2#* }" | jq -e "$3" >/dev/null 2>&1; then ok "$1"; else ko "$1" "ricevuto: ${2:0:200}"; fi
}

login() { # utente password → token
    call POST api/user/mobile_login.php "" "$(jq -nc --arg u "$1" --arg p "$2" '{username:$u, password:$p, device_info:"reports.sh"}')" \
        | cut -d' ' -f2- | jq -r '.token // empty'
}

register_and_login() { # nome → token
    call POST api/user/register.php "" "$(jq -nc --arg u "$1" --arg e "$1@example.com" --arg p "$PASS" --arg b "$(date -d '-30 years' +%Y-%m-%d)" \
        '{username:$u, email:$e, password:$p, birth_date:$b, gender:"O", accept_terms:true}')" >/dev/null
    login "$1" "$PASS"
}

# report token group_id json_extra → risposta di call
report() {
    call POST api/groups/report.php "$1" "$(jq -nc --argjson g "$2" --argjson x "$3" '{group_id:$g} + $x')"
}

A_USER="rpA$SUFFIX"; B_USER="rpB$SUFFIX"; C_USER="rpC$SUFFIX"
echo "Account di prova: $A_USER $B_USER $C_USER"
A="$(register_and_login "$A_USER")"
B="$(register_and_login "$B_USER")"
C="$(register_and_login "$C_USER")"
[[ -n "$A" && -n "$B" && -n "$C" ]] || { echo "registrazione o login falliti (limite di registrazioni per IP?)" >&2; exit 1; }

cleanup() {
    for t in "$A" "$B" "$C"; do
        call POST api/user/delete.php "$t" "$(jq -nc --arg p "$PASS" '{password:$p}')" >/dev/null
    done
    echo "Account di prova cancellati."
}
trap cleanup EXIT

GROUP_NAME="Squadra $SUFFIX"
res="$(call POST api/groups/create.php "$A" "$(jq -nc --arg n "$GROUP_NAME" '{name:$n, type:"friends"}')")"
GID="$(echo "${res#* }" | jq -r '.group.id')"
CODE="$(echo "${res#* }" | jq -r '.group.invite_code')"
call POST api/groups/join.php "$B" "{\"code\":\"$CODE\",\"consent\":true}" >/dev/null

REASON='Il nome del gruppo insulta una persona riconoscibile.'

# rename_by_owner nome → risposta di manage.php per A (owner)
rename_by_owner() {
    call POST api/groups/manage.php "$A" "$(jq -nc --argjson g "$GID" --arg n "$1" '{group_id:$g, action:"rename", name:$n}')"
}
check "all'inizio il nome non è bloccato" "$(call GET "api/groups/read.php?group_id=$GID" "$A")" '.group.name_locked == false and .group.name_locked_until == null'

echo "Segnalazione"
GROUP_RES="$(report "$B" "$GID" "$(jq -nc --arg r "$REASON" '{target:"group_name", reason:$r, good_faith:true}')")"
expect "B segnala il nome del gruppo: 201" 201 "$GROUP_RES"
check "risponde con il numero della segnalazione" "$GROUP_RES" '.report_id > 0'
GOOD="$(jq -nc --arg r "$REASON" '{target:"group_name", reason:$r, good_faith:true}')"
expect "senza login: 401" 401 "$(report "" "$GID" "$GOOD")"
expect "C non è nel gruppo: 404" 404 "$(report "$C" "$GID" "$GOOD")"
expect "metodo sbagliato: 405" 405 "$(call GET api/groups/report.php "$B")"

echo "Dati non validi"
expect "target sconosciuto: 400" 400 "$(report "$B" "$GID" "$(jq -nc --arg r "$REASON" '{target:"foto", reason:$r, good_faith:true}')")"
expect "motivo troppo corto: 400" 400 "$(report "$B" "$GID" '{"target":"group_name","reason":"brutto","good_faith":true}')"
expect "motivo oltre 1000 caratteri: 400" 400 "$(report "$B" "$GID" "$(jq -nc --arg r "$(printf 'a%.0s' $(seq 1 1001))" '{target:"group_name", reason:$r, good_faith:true}')")"
expect "senza buona fede: 400" 400 "$(report "$B" "$GID" "$(jq -nc --arg r "$REASON" '{target:"group_name", reason:$r}')")"
expect "membro che non è nel gruppo: 400" 400 "$(report "$B" "$GID" "$(jq -nc --arg r "$REASON" --arg u "$C_USER" '{target:"member", username:$u, reason:$r, good_faith:true}')")"
expect "se stessi: 400" 400 "$(report "$B" "$GID" "$(jq -nc --arg r "$REASON" --arg u "$B_USER" '{target:"member", username:$u, reason:$r, good_faith:true}')")"
res="$(report "$B" "$GID" "$(jq -nc --arg r "$REASON" --arg u "$A_USER" '{target:"member", username:$u, reason:$r, good_faith:true}')")"
expect "B segnala lo username di A: 201" 201 "$res"
MEMBER_RID="$(echo "${res#* }" | jq -r '.report_id')"
GROUP_RID="$(echo "${GROUP_RES#* }" | jq -r '.report_id')"

echo "Admin"
expect "A (non admin) non vede le segnalazioni: 404" 404 "$(call GET api/admin/reports.php "$A")"
expect "A (non admin) non può chiuderle: 404" 404 "$(call POST api/admin/reports.php "$A" "{\"action\":\"dismiss\",\"id\":$GROUP_RID,\"note\":\"no\"}")"

if [[ -n "${ADMIN_USER:-}" && -n "${ADMIN_PASS:-}" ]]; then
    ADM="$(login "$ADMIN_USER" "$ADMIN_PASS")"
    if [[ -z "$ADM" ]]; then
        ko "login admin" "ADMIN_USER/ADMIN_PASS non validi"
    else
        res="$(call GET api/admin/reports.php "$ADM")"
        check "l'admin vede la segnalazione del nome del gruppo" "$res" \
            ".reports | any(.id == $GROUP_RID and .status == \"open\" and .target == \"group_name\" and .target_label == \"$GROUP_NAME\" and .reporter == \"$B_USER\" and .reason == \"$REASON\" and .group_id == $GID and .group_name == \"$GROUP_NAME\")"
        check "e quella dello username di A" "$res" ".reports | any(.id == $MEMBER_RID and .target == \"member\" and .target_label == \"$A_USER\")"
        expect "stato sconosciuto: 400" 400 "$(call GET 'api/admin/reports.php?status=boh' "$ADM")"
        check "fra le chiuse non c'è ancora" "$(call GET 'api/admin/reports.php?status=resolved' "$ADM")" ".reports | all(.id != $GROUP_RID)"

        # A segnala due volte: una segnalazione si respinge, l'altra si accoglie
        DIS_RID="$(report "$A" "$GID" "$(jq -nc --arg r "$REASON" --arg u "$B_USER" '{target:"member", username:$u, reason:$r, good_faith:true}')" | cut -d' ' -f2- | jq -r '.report_id')"
        RES_RID="$(report "$A" "$GID" "$GOOD" | cut -d' ' -f2- | jq -r '.report_id')"
        expect "chiudere senza nota: 400" 400 "$(call POST api/admin/reports.php "$ADM" "{\"action\":\"dismiss\",\"id\":$DIS_RID,\"note\":\"  \"}")"
        expect "segnalazione inesistente: 404" 404 "$(call POST api/admin/reports.php "$ADM" '{"action":"dismiss","id":999999999,"note":"Non viola i termini."}')"
        expect "azione sconosciuta: 400" 400 "$(call POST api/admin/reports.php "$ADM" "{\"action\":\"boh\",\"id\":$DIS_RID}")"
        expect "respinge" 200 "$(call POST api/admin/reports.php "$ADM" "{\"action\":\"dismiss\",\"id\":$DIS_RID,\"note\":\"Il nome non viola i termini.\"}")"
        expect "accoglie" 200 "$(call POST api/admin/reports.php "$ADM" "{\"action\":\"resolve\",\"id\":$RES_RID,\"note\":\"Ho chiesto al proprietario di cambiarlo.\"}")"
        expect "non si chiude due volte: 409" 409 "$(call POST api/admin/reports.php "$ADM" "{\"action\":\"resolve\",\"id\":$DIS_RID,\"note\":\"Ripensamento.\"}")"
        check "la respinta sta fra le respinte, con la nota" "$(call GET 'api/admin/reports.php?status=dismissed' "$ADM")" \
            ".reports | any(.id == $DIS_RID and .decision_note == \"Il nome non viola i termini.\" and .decided_at != null)"
        check "l'accolta sta fra le accolte" "$(call GET 'api/admin/reports.php?status=resolved' "$ADM")" ".reports | any(.id == $RES_RID)"
        check "e nessuna delle due è più aperta" "$(call GET api/admin/reports.php "$ADM")" ".reports | all(.id != $DIS_RID and .id != $RES_RID)"

        echo "Admin: rinomina il gruppo"
        NOTE_G='Il nome offendeva una persona.'
        expect "nome con un link: 400" 400 "$(call POST api/admin/reports.php "$ADM" "$(jq -nc --argjson i "$GROUP_RID" --arg n "$NOTE_G" '{action:"rename_group", id:$i, name:"vai su www.spam.com", note:$n}')")"
        expect "su una segnalazione di un membro: 400" 400 "$(call POST api/admin/reports.php "$ADM" "$(jq -nc --argjson i "$MEMBER_RID" --arg n "$NOTE_G" '{action:"rename_group", id:$i, name:"Gruppo", note:$n}')")"
        expect "rinomina senza nota: 400" 400 "$(call POST api/admin/reports.php "$ADM" "$(jq -nc --argjson i "$GROUP_RID" '{action:"rename_group", id:$i, name:"Gruppo"}')")"
        NEW_GROUP_NAME="Gruppo $SUFFIX"
        expect "rinomina il gruppo" 200 "$(call POST api/admin/reports.php "$ADM" "$(jq -nc --argjson i "$GROUP_RID" --arg g "$NEW_GROUP_NAME" --arg n "$NOTE_G" '{action:"rename_group", id:$i, name:$g, note:$n}')")"
        check "B vede il nuovo nome" "$(call GET "api/groups/read.php?group_id=$GID" "$B")" ".group.name == \"$NEW_GROUP_NAME\""
        check "la segnalazione è accolta, con il nome segnalato com'era" "$(call GET 'api/admin/reports.php?status=resolved' "$ADM")" \
            ".reports | any(.id == $GROUP_RID and .decision_note == \"$NOTE_G\" and .target_label == \"$GROUP_NAME\" and .group_name == \"$NEW_GROUP_NAME\")"
        check "A vede il nome bloccato per 14 giorni" "$(call GET "api/groups/read.php?group_id=$GID" "$A")" \
            '.group.name_locked == true and (.group.name_locked_until | type == "string")'
        check "B (membro) non riceve il blocco: non gestisce il gruppo" "$(call GET "api/groups/read.php?group_id=$GID" "$B")" '.group | has("name_locked") | not'
        res="$(rename_by_owner "Di nuovo $SUFFIX")"
        expect "A non può rinominarlo: 403" 403 "$res"
        check "con il codice name_locked e la data nel messaggio" "$res" '.code == "name_locked" and (.message | test("[0-9]{2}/[0-9]{2}/[0-9]{4}"))'

        echo "Admin: rinomina l'utente"
        NOTE_U='Lo username era un insulto.'
        rename_user() { # id username → risposta
            call POST api/admin/reports.php "$ADM" "$(jq -nc --argjson i "$1" --arg u "$2" --arg n "$NOTE_U" '{action:"rename_user", id:$i, username:$u, note:$n}')"
        }
        OPEN_GROUP_RID="$(report "$A" "$GID" "$GOOD" | cut -d' ' -f2- | jq -r '.report_id')"
        expect "su una segnalazione del nome del gruppo: 400" 400 "$(rename_user "$OPEN_GROUP_RID" "nuovo$SUFFIX")"
        expect "username non valido: 400" 400 "$(rename_user "$MEMBER_RID" "con spazi")"
        expect "username già preso: 409" 409 "$(rename_user "$MEMBER_RID" "$B_USER")"
        NEW_A_USER="rpN$SUFFIX"
        expect "rinomina A" 200 "$(rename_user "$MEMBER_RID" "$NEW_A_USER")"
        if [[ -n "$(login "$NEW_A_USER" "$PASS")" ]]; then ok "A accede col nuovo nome"; else ko "A accede col nuovo nome"; fi
        if [[ -z "$(login "$A_USER" "$PASS")" ]]; then ok "col vecchio nome no"; else ko "col vecchio nome no"; fi
        check "B vede A col nuovo nome fra i membri" "$(call GET "api/groups/read.php?group_id=$GID" "$B")" ".members | any(.username == \"$NEW_A_USER\")"
        check "la segnalazione è accolta" "$(call GET 'api/admin/reports.php?status=resolved' "$ADM")" \
            ".reports | any(.id == $MEMBER_RID and .decision_note == \"$NOTE_U\" and .target_label == \"$A_USER\")"

        echo "Admin: seconda rinomina del gruppo"
        check "l'elenco dice che il gruppo è già stato rinominato una volta" "$(call GET api/admin/reports.php "$ADM")" \
            ".reports | any(.id == $OPEN_GROUP_RID and .group_admin_renames == 1)"
        expect "rinomina di nuovo" 200 "$(call POST api/admin/reports.php "$ADM" "$(jq -nc --argjson i "$OPEN_GROUP_RID" --arg g "Gruppo2 $SUFFIX" --arg n "$NOTE_G" '{action:"rename_group", id:$i, name:$g, note:$n}')")"
        check "ora il nome è bloccato per sempre" "$(call GET "api/groups/read.php?group_id=$GID" "$A")" '.group.name_locked == true and .group.name_locked_until == null'
        res="$(rename_by_owner "Di nuovo $SUFFIX")"
        expect "A non può rinominarlo: 403" 403 "$res"
        check "con il messaggio senza data" "$res" '.code == "name_locked" and (.message | test("info@liftindex.app"))'
    fi
else
    echo "  (parte admin saltata: imposta ADMIN_USER e ADMIN_PASS)"
fi

echo "Export"
check "l'export di B contiene le sue segnalazioni" "$(call GET api/user/export.php "$B")" \
    ".reports | length == 2 and any(.target == \"group_name\" and .reason == \"$REASON\" and has(\"status\") and has(\"decision_note\"))"

# In fondo: dopo B non può più segnalare per un'ora
echo "Limite di segnalazioni"
limited=0
for _ in $(seq 1 6); do
    [[ "$(report "$B" "$GID" "$GOOD" | cut -d' ' -f1)" == 429 ]] && { limited=1; break; }
done
if [[ $limited -eq 1 ]]; then ok "dopo troppe segnalazioni risponde 429"; else ko "dopo troppe segnalazioni risponde 429"; fi

echo
if [[ $fails -eq 0 ]]; then echo "TUTTO OK ($checks controlli)"; else echo "FALLITI $fails su $checks"; exit 1; fi
