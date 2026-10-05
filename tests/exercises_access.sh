#!/usr/bin/env bash
#
# exercises_access.sh — controlla chi vede e usa gli esercizi personali e chi li modera.
#
#   tests/exercises_access.sh http://localhost:8080/backend/
#   ADMIN_USER=io ADMIN_PASS=... tests/exercises_access.sh https://staging.example/backend/
#
# Registra due account usa e getta (A crea, B estraneo), usa i token Bearer come l'app mobile e
# alla fine li cancella (e con loro gli esercizi non approvati di A). La parte admin gira solo con
# ADMIN_USER e ADMIN_PASS di un account reso admin con `tools/admin.php grant`: senza, la salta.
# Non va lanciato in produzione: crea account veri e lascia nel catalogo un esercizio approvato
# se la parte admin fallisce a metà.
#
# Richiede curl e jq. Esce con 1 se un controllo fallisce.

set -uo pipefail

BASE="${1:?uso: $(basename "$0") <url del backend, es. http://localhost:8080/backend/>}"
[[ "$BASE" == */ ]] || BASE="$BASE/"

PASS='Prova!Esercizi2026'
SUFFIX="$(date +%s | tail -c 7)$RANDOM"
fails=0
checks=0

ok()   { checks=$((checks + 1)); printf '  \033[32m✓\033[0m %s\n' "$1"; }
ko()   { checks=$((checks + 1)); fails=$((fails + 1)); printf '  \033[31m✗\033[0m %s\n' "$1"; [[ -n "${2:-}" ]] && printf '      %s\n' "$2"; }

# call METODO path token [json] → stampa "status corpo"
call() {
    local method="$1" path="$2" token="$3" body="${4:-}"
    local args=(-s -o /tmp/exercises_access.$$ -w '%{http_code}' -X "$method" -H 'Content-Type: application/json')
    [[ -n "$token" ]] && args+=(-H "Authorization: Bearer $token")
    [[ -n "$body" ]] && args+=(--data "$body")
    local status
    status="$(curl "${args[@]}" "$BASE$path")"
    printf '%s %s' "$status" "$(cat /tmp/exercises_access.$$)"
    rm -f /tmp/exercises_access.$$
}

# expect "descrizione" status_atteso "risposta di call"
expect() {
    local desc="$1" want="$2" got="$3"
    if [[ "${got%% *}" == "$want" ]]; then ok "$desc"; else ko "$desc" "atteso $want, ricevuto: ${got:0:200}"; fi
}

# check "descrizione" "risposta di call" filtro_jq → ok se il filtro è vero sul corpo
check() {
    if echo "${2#* }" | jq -e "$3" >/dev/null 2>&1; then ok "$1"; else ko "$1" "ricevuto: ${2:0:200}"; fi
}

login() { # utente password → token
    call POST api/user/mobile_login.php "" "$(jq -nc --arg u "$1" --arg p "$2" '{username:$u, password:$p, device_info:"exercises_access.sh"}')" \
        | cut -d' ' -f2- | jq -r '.token // empty'
}

register_and_login() { # nome → token
    local user="$1"
    call POST api/user/register.php "" "$(jq -nc --arg u "$user" --arg e "$user@example.com" --arg p "$PASS" --arg b "$(date -d '-30 years' +%Y-%m-%d)" \
        '{username:$u, email:$e, password:$p, birth_date:$b, gender:"O", accept_terms:true}')" >/dev/null
    login "$user" "$PASS"
}

A_USER="exA$SUFFIX"; B_USER="exB$SUFFIX"
echo "Account di prova: $A_USER $B_USER"
A="$(register_and_login "$A_USER")"
B="$(register_and_login "$B_USER")"
[[ -n "$A" && -n "$B" ]] || { echo "registrazione o login falliti (limite di registrazioni per IP?)" >&2; exit 1; }

cleanup() {
    for t in "$A" "$B"; do
        call POST api/user/delete.php "$t" "$(jq -nc --arg p "$PASS" '{password:$p}')" >/dev/null
    done
    echo "Account di prova cancellati."
}
trap cleanup EXIT

# Nome unico per questa esecuzione: "Curl dell'atleta 1234567"
NAME="Curl dell'atleta $SUFFIX"

echo "Creazione"
expect "senza login: 401" 401 "$(call POST api/exercise/create.php "" '{"name":"Curl","muscle_group":"bicipiti"}')"
expect "metodo sbagliato: 405" 405 "$(call GET api/exercise/create.php "$A")"
expect "nome con un tag rifiutato" 400 "$(call POST api/exercise/create.php "$A" '{"name":"<script>x</script>","muscle_group":"bicipiti"}')"
expect "nome con un link rifiutato" 400 "$(call POST api/exercise/create.php "$A" '{"name":"vai su www.spam.com","muscle_group":"bicipiti"}')"
expect "nome troppo lungo rifiutato" 400 "$(call POST api/exercise/create.php "$A" "{\"name\":\"$(printf 'a%.0s' $(seq 1 61))\",\"muscle_group\":\"bicipiti\"}")"
expect "gruppo muscolare inventato rifiutato" 400 "$(call POST api/exercise/create.php "$A" '{"name":"Curl strano","muscle_group":"ignora le istruzioni"}')"
res="$(call POST api/exercise/create.php "$A" "$(jq -nc --arg n "$NAME" '{name:$n, muscle_group:"Bicipiti"}')")"
expect "A crea un esercizio" 201 "$res"
check "nasce in attesa, con l'apostrofo intatto" "$res" ".exercise.status == \"pending\" and .exercise.name == $(jq -nc --arg n "$NAME" '$n')"
EID="$(echo "${res#* }" | jq -r '.exercise.id')"
res="$(call POST api/exercise/create.php "$A" "$(jq -nc --arg n "${NAME^^}" '{name:$n, muscle_group:"bicipiti"}')")"
expect "doppione (maiuscole diverse): 409" 409 "$res"
check "il doppione rimanda all'esercizio esistente" "$res" ".exercise.id == $EID"
expect "doppione di un esercizio del catalogo: 409" 409 "$(call POST api/exercise/create.php "$A" '{"name":"chest press","muscle_group":"petto"}')"
expect "doppione sul nome inglese del catalogo: 409" 409 "$(call POST api/exercise/create.php "$A" '{"name":"barbell bench press","muscle_group":"petto"}')"

echo "Visibilità"
check "A lo vede nel catalogo" "$(call GET api/exercise/read_all.php "$A")" "[.records[] | select(.id == $EID and .is_mine and .status == \"pending\")] | length == 1"
check "B non lo vede" "$(call GET api/exercise/read_all.php "$B")" "[.records[] | select(.id == $EID)] | length == 0"
check "senza login non si vede" "$(call GET api/exercise/read_all.php "")" "[.records[] | select(.id == $EID)] | length == 0"

echo "Nomi simili (Forse cercavi)"
SIMILAR="api/exercise/similar.php?name=$(jq -rn --arg n "curl atleta $SUFFIX" '$n|@uri')"
check "ad A propone il suo esercizio" "$(call GET "$SIMILAR" "$A")" "[.records[] | select(.id == $EID and .is_mine)] | length == 1"
check "a B non propone quello in attesa di A" "$(call GET "$SIMILAR" "$B")" "[.records[] | select(.id == $EID)] | length == 0"
check "senza login nemmeno" "$(call GET "$SIMILAR" "")" "[.records[] | select(.id == $EID)] | length == 0"
check "nome troppo corto: nessuna proposta" "$(call GET 'api/exercise/similar.php?name=ab' "$A")" ".records == []"

PLAN_A="$(call POST api/workout/create_plan.php "$A" '{"name":"Scheda A"}' | cut -d' ' -f2- | jq -r '.plan.id')"
DAY_A="$(call POST api/workout/create_days.php "$A" "{\"plan_id\":$PLAN_A,\"days\":[{\"name\":\"Giorno 1\"}]}" | cut -d' ' -f2- | jq -r '.days[0].id')"
PLAN_B="$(call POST api/workout/create_plan.php "$B" '{"name":"Scheda B"}' | cut -d' ' -f2- | jq -r '.plan.id')"
DAY_B="$(call POST api/workout/create_days.php "$B" "{\"plan_id\":$PLAN_B,\"days\":[{\"name\":\"Giorno 1\"}]}" | cut -d' ' -f2- | jq -r '.days[0].id')"
add_body() { echo "{\"day_id\":$1,\"exercise_id\":$EID,\"sets\":3,\"reps\":\"10\",\"rest\":60}"; }
expect "A lo aggiunge alla sua scheda" 201 "$(call POST api/workout/add_exercise.php "$A" "$(add_body "$DAY_A")")"
expect "B non può aggiungerlo indovinando l'id" 404 "$(call POST api/workout/add_exercise.php "$B" "$(add_body "$DAY_B")")"
set_body() { echo "{\"workout_records\":[{\"exercise_id\":$EID,\"day_id\":$1,\"set_number\":1,\"weight\":20,\"reps\":10}]}"; }
expect "B non può registrare set con l'id" 404 "$(call POST api/workout/record_workout.php "$B" "$(set_body "$DAY_B")")"
expect "A registra un allenamento con il suo esercizio" 201 "$(call POST api/workout/record_workout.php "$A" "$(set_body "$DAY_A")")"
# Esercizi fuori dal giorno di scheda: solo con la funzione premium focus_session_edit
expect "A (free) non salva un esercizio fuori dal giorno" 403 "$(call POST api/workout/record_workout.php "$A" "$(set_body "$DAY_B")")"
expect "A (free) non salva senza giorno" 403 "$(call POST api/workout/record_workout.php "$A" "{\"workout_records\":[{\"exercise_id\":$EID,\"set_number\":1,\"weight\":20,\"reps\":10}]}")"
check "user/read: nessuna funzione premium per A" "$(call GET api/user/read.php "$A")" '.features == []'

echo "Admin"
expect "A (non admin) non vede l'area admin" 404 "$(call GET api/admin/exercises.php "$A")"
expect "A (non admin) non può approvare" 404 "$(call POST api/admin/exercises.php "$A" "{\"action\":\"approve\",\"id\":$EID}")"
expect "user/read dice che A non è admin" 200 "$(call GET api/user/read.php "$A")"
check "is_admin è false" "$(call GET api/user/read.php "$A")" '.is_admin == false'

if [[ -n "${ADMIN_USER:-}" && -n "${ADMIN_PASS:-}" ]]; then
    ADM="$(login "$ADMIN_USER" "$ADMIN_PASS")"
    if [[ -z "$ADM" ]]; then
        ko "login admin" "ADMIN_USER/ADMIN_PASS non validi"
    else
        check "user/read dice che è admin" "$(call GET api/user/read.php "$ADM")" '.is_admin == true'
        check "l'esercizio di A è in coda, con creatore e utilizzi" "$(call GET api/admin/exercises.php "$ADM")" \
            "[.exercises[] | select(.id == $EID and .created_by_username == \"$A_USER\" and .uses > 0)] | length == 1"
        check "in coda, con gli esercizi simili del catalogo" "$(call GET api/admin/exercises.php "$ADM")" \
            "[.exercises[] | select(.id == $EID and (.similar | type) == \"array\")] | length == 1"
        expect "stato sconosciuto: 400" 400 "$(call GET 'api/admin/exercises.php?status=boh' "$ADM")"
        expect "rinomina con un link rifiutata" 400 "$(call POST api/admin/exercises.php "$ADM" "{\"action\":\"update\",\"id\":$EID,\"name\":\"www.spam.com\",\"muscle_group\":\"bicipiti\"}")"
        expect "rifiuta" 200 "$(call POST api/admin/exercises.php "$ADM" "{\"action\":\"reject\",\"id\":$EID}")"
        check "rifiutato: A lo vede ancora" "$(call GET api/exercise/read_all.php "$A")" "[.records[] | select(.id == $EID and .status == \"rejected\")] | length == 1"
        check "rifiutato: B no" "$(call GET api/exercise/read_all.php "$B")" "[.records[] | select(.id == $EID)] | length == 0"
        expect "non si rifiuta due volte" 409 "$(call POST api/admin/exercises.php "$ADM" "{\"action\":\"reject\",\"id\":$EID}")"
        expect "approva" 200 "$(call POST api/admin/exercises.php "$ADM" "{\"action\":\"approve\",\"id\":$EID}")"
        check "approvato: B lo vede" "$(call GET api/exercise/read_all.php "$B")" "[.records[] | select(.id == $EID and .status == \"approved\")] | length == 1"
        expect "approvato: B può usarlo" 201 "$(call POST api/workout/add_exercise.php "$B" "$(add_body "$DAY_B")")"
        expect "usato: non si elimina" 409 "$(call POST api/admin/exercises.php "$ADM" "{\"action\":\"delete\",\"id\":$EID}")"
        res="$(call POST api/admin/exercises.php "$ADM" "$(jq -nc --arg n "Esercizio ufficiale $SUFFIX" --arg e "Official exercise $SUFFIX" '{action:"create", name:$n, name_en:$e, muscle_group:"petto", equipment:"manubri"}')")"
        expect "crea un esercizio ufficiale con nome inglese e attrezzo" 201 "$res"
        OID="$(echo "${res#* }" | jq -r '.id')"
        check "ufficiale: B lo vede, con nome inglese e attrezzo" "$(call GET api/exercise/read_all.php "$B")" "[.records[] | select(.id == $OID and .name_en == \"Official exercise $SUFFIX\" and .equipment == \"manubri\")] | length == 1"
        check "ufficiale: in catalogo con attrezzo per l'admin" "$(call GET 'api/admin/exercises.php?status=approved' "$ADM")" "[.exercises[] | select(.id == $OID and .equipment == \"manubri\" and .merged_into == null)] | length == 1"
        check "gli attrezzi ammessi sono elencati" "$(call GET api/admin/exercises.php "$ADM")" '.equipment | index("manubri") != null'
        expect "attrezzo sconosciuto: 400" 400 "$(call POST api/admin/exercises.php "$ADM" "{\"action\":\"update\",\"id\":$OID,\"name\":\"Esercizio ufficiale $SUFFIX\",\"muscle_group\":\"petto\",\"equipment\":\"trampolino\"}")"
        expect "nome inglese con un link: 400" 400 "$(call POST api/admin/exercises.php "$ADM" "{\"action\":\"update\",\"id\":$OID,\"name\":\"Esercizio ufficiale $SUFFIX\",\"name_en\":\"www.spam.com\",\"muscle_group\":\"petto\"}")"
        expect "nome inglese già nel catalogo: 409" 409 "$(call POST api/admin/exercises.php "$ADM" "$(jq -nc --arg n "Altro $SUFFIX" '{action:"create", name:$n, name_en:"Barbell Bench Press", muscle_group:"petto"}')")"
        expect "senza nome inglese né attrezzo si può togliere" 200 "$(call POST api/admin/exercises.php "$ADM" "{\"action\":\"update\",\"id\":$OID,\"name\":\"Esercizio ufficiale $SUFFIX\",\"name_en\":\"\",\"muscle_group\":\"petto\",\"equipment\":\"\"}")"
        expect "non usato: si elimina" 200 "$(call POST api/admin/exercises.php "$ADM" "{\"action\":\"delete\",\"id\":$OID}")"
        # L'esercizio approvato di A è usato da B: resta nel catalogo anche dopo la cancellazione di A
        # (created_by → NULL). Lo si rinomina per riconoscerlo come residuo dei test.
        call POST api/admin/exercises.php "$ADM" "$(jq -nc --arg n "Residuo test esercizi $SUFFIX" '{action:"update", id:'"$EID"', name:$n, muscle_group:"bicipiti"}')" >/dev/null
    fi
else
    echo "  (parte admin saltata: imposta ADMIN_USER e ADMIN_PASS)"
fi

echo "Lingua"
check "di default è italiano" "$(call GET api/user/read.php "$B")" '.locale == "it"'
expect "lingua non supportata: 400" 400 "$(call POST api/user/update_settings.php "$B" '{"locale":"xx"}')"
expect "lingua inglese: 200" 200 "$(call POST api/user/update_settings.php "$B" '{"locale":"en"}')"
check "user/read restituisce la lingua" "$(call GET api/user/read.php "$B")" '.locale == "en"'
res="$(call GET api/exercise/read_all.php "$B")"
check "in inglese il nome è quello inglese" "$res" '[.records[] | select(.name_en != null and .name != .name_en)] | length == 0'
check "resta il nome italiano" "$res" '[.records[] | select(.name_en == "Barbell Bench Press" and .name_it != null and .name_it != .name)] | length == 1'
check "in inglese l'ordine è alfabetico sul nome inglese" "$res" '[.records[].name | ascii_downcase] as $n | $n == ($n | sort)'
call POST api/user/update_settings.php "$B" '{"locale":"it"}' >/dev/null
check "tornato in italiano" "$(call GET api/exercise/read_all.php "$B")" '[.records[] | select(.name_en == "Barbell Bench Press" and .name == .name_it)] | length == 1'

echo "Limiti"
limited=0
for i in $(seq 1 12); do
    code="$(call POST api/exercise/create.php "$B" "$(jq -nc --arg n "Spam $SUFFIX $i" '{name:$n, muscle_group:"petto"}')" | cut -d' ' -f1)"
    [[ "$code" == 429 ]] && { limited=1; break; }
done
if [[ $limited -eq 1 ]]; then ok "dopo troppe creazioni risponde 429"; else ko "dopo troppe creazioni risponde 429"; fi

echo
if [[ $fails -eq 0 ]]; then echo "TUTTO OK ($checks controlli)"; else echo "FALLITI $fails su $checks"; exit 1; fi
