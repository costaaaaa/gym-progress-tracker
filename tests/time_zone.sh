#!/usr/bin/env bash
#
# time_zone.sh — fusi orari degli allenamenti (#55): `date` è l'ora locale del luogo, time_zone dice
# quale, "oggi" e la settimana seguono il fuso del dispositivo (header X-Timezone), senza fuso tutto
# resta in Europe/Rome come prima.
#
#   tests/time_zone.sh http://localhost:8080/backend/
#
# Registra account usa e getta (token Bearer) e li cancella alla fine.
# Non va lanciato in produzione: crea account veri.
#
# Richiede curl, jq e date GNU. Esce con 1 se un controllo fallisce.

set -uo pipefail

BASE="${1:?uso: $(basename "$0") <url del backend, es. http://localhost:8080/backend/>}"
[[ "$BASE" == */ ]] || BASE="$BASE/"

PASS='Prova!Fuso2026'
SUFFIX="$(date +%s | tail -c 7)$RANDOM"
fails=0
checks=0
XTZ=""   # valore dell'header X-Timezone per la prossima call (vuoto = nessun header)

ok() { checks=$((checks + 1)); printf '  \033[32m✓\033[0m %s\n' "$1"; }
ko() { checks=$((checks + 1)); fails=$((fails + 1)); printf '  \033[31m✗\033[0m %s\n' "$1"; [[ -n "${2:-}" ]] && printf '      %s\n' "$2"; }

call() { # metodo path token [json] → "status corpo"
    local method="$1" path="$2" token="$3" body="${4:-}"
    local args=(-s -o /tmp/time_zone.$$ -w '%{http_code}' -X "$method" -H 'Content-Type: application/json')
    [[ -n "$token" ]] && args+=(-H "Authorization: Bearer $token")
    [[ -n "$XTZ" ]] && args+=(-H "X-Timezone: $XTZ")
    [[ -n "$body" ]] && args+=(--data "$body")
    local status
    status="$(curl "${args[@]}" "$BASE$path")"
    printf '%s %s' "$status" "$(cat /tmp/time_zone.$$)"
    rm -f /tmp/time_zone.$$
}

check() { # descrizione "risposta di call" filtro_jq
    if echo "${2#* }" | jq -e "$3" >/dev/null 2>&1; then ok "$1"; else ko "$1" "ricevuto: ${2:0:300}"; fi
}

same() { # descrizione ottenuto atteso
    if [[ "$2" == "$3" ]]; then ok "$1"; else ko "$1" "ottenuto: '$2' — atteso: '$3'"; fi
}

TOKENS=()
make_user() { # nome → imposta T e DAY (account nuovo, con una scheda), lo ricorda per la pulizia
    local name="tz$1$SUFFIX" plan
    XTZ=""   # ogni richiesta autenticata con un fuso valido lo salva sull'account: l'account nuovo parte senza
    call POST api/user/register.php "" "$(jq -nc --arg u "$name" --arg e "$name@example.com" --arg p "$PASS" --arg b "$(date -d '-30 years' +%Y-%m-%d)" \
        '{username:$u, email:$e, password:$p, birth_date:$b, gender:"O", accept_terms:true}')" >/dev/null
    T="$(call POST api/user/mobile_login.php "" "$(jq -nc --arg u "$name" --arg p "$PASS" '{username:$u, password:$p, device_info:"time_zone.sh"}')" \
        | cut -d' ' -f2- | jq -r '.token // empty')"
    [[ -n "$T" ]] || { echo "registrazione o login falliti (limite di registrazioni per IP?)" >&2; exit 1; }
    TOKENS+=("$T")
    E1="$(call GET api/exercise/read_all.php "$T" | cut -d' ' -f2- | jq -r '.records[0].id')"
    plan="$(call POST api/workout/create_plan.php "$T" '{"name":"Scheda fuso"}' | cut -d' ' -f2- | jq -r '.plan.id')"
    DAY="$(call POST api/workout/create_days.php "$T" "{\"plan_id\":$plan,\"days\":[{\"name\":\"Giorno 1\"}]}" | cut -d' ' -f2- | jq -r '.days[0].id')"
    call POST api/workout/add_exercise.php "$T" "{\"day_id\":$DAY,\"exercise_id\":$E1,\"sets\":3,\"reps\":\"10\",\"rest\":60}" >/dev/null
}

cleanup() {
    XTZ=""
    local t
    for t in "${TOKENS[@]}"; do
        call POST api/user/delete.php "$t" "$(jq -nc --arg p "$PASS" '{password:$p}')" >/dev/null
    done
    echo "Account di prova cancellati."
}
trap cleanup EXIT

iso() { date -u -d "@$1" +%Y-%m-%dT%H:%M:%S.000Z; }
local_in() { TZ="$1" date -d "@$2" '+%Y-%m-%d %H:%M:%S'; }   # fuso istante → data locale

# body peso start_time [ended_at] [backdated] [time_zone]
body() {
    local recs='[]' i
    for i in 1 2 3; do recs="$(jq -c --argjson e "$E1" --argjson d "$DAY" --argjson i "$i" --argjson w "$1" '. + [{exercise_id:$e, day_id:$d, set_number:$i, weight:$w, reps:10}]' <<<"$recs")"; done
    jq -nc --argjson r "$recs" --arg s "$2" --arg e "${3:-}" --argjson b "${4:-false}" --arg z "${5:-}" \
        '{workout_records:$r, start_time:$s} + (if $e != "" then {ended_at:$e} else {} end) + (if $b then {backdated:true} else {} end) + (if $z != "" then {time_zone:$z} else {} end)'
}

history_field() { # id campo → valore nello storico
    call GET api/workout_history/read.php "$T" | cut -d' ' -f2- | jq -r --argjson id "$1" --arg f "$2" '[.records[] | select(.id == $id)][0][$f] // empty'
}

save() { # body → id
    local r
    r="$(call POST api/workout/record_workout.php "$T" "$1")"
    echo "${r#* }" | jq -r '.id // empty'
}

echo "Salvataggio: la data è l'ora locale del fuso"
S="$(date -d '10 minutes ago' +%s)"

make_user a
XTZ="America/New_York"
ID="$(save "$(body 20 "$(iso "$S")")")"
same "header New York: date = ora locale di New York" "$(history_field "$ID" date)" "$(local_in America/New_York "$S")"

XTZ=""
ID="$(save "$(body 21 "$(iso "$S")")")"
same "senza header: l'ultimo fuso visto sull'account" "$(history_field "$ID" date)" "$(local_in America/New_York "$S")"

XTZ="America/New_York"
ID="$(save "$(body 22 "$(iso "$S")" "" false Asia/Tokyo)")"
same "time_zone nel payload batte l'header" "$(history_field "$ID" date)" "$(local_in Asia/Tokyo "$S")"

ID="$(save "$(body 23 "$(iso "$S")" "" false Mars/Olympus)")"
same "time_zone non valido nel payload: si passa all'header" "$(history_field "$ID" date)" "$(local_in America/New_York "$S")"

same "storico: time_zone del luogo" "$(history_field "$ID" time_zone)" "America/New_York"
same "storico: started_at con l'offset di New York" "$(history_field "$ID" started_at)" "$(TZ=America/New_York date -d "@$S" '+%Y-%m-%dT%H:%M:%S%:z')"

EXP="$(call GET api/user/export.php "$T")"
check "export: allenamento con time_zone e started_at" "$EXP" '.workouts | map(select(.time_zone == "America/New_York" and (.started_at | test("-0[45]:00$")))) | length >= 1'

make_user b
XTZ=""
ID="$(save "$(body 24 "$(iso "$S")")")"
same "account nuovo, senza header né time_zone: ora di Roma, come prima" "$(history_field "$ID" date)" "$(local_in Europe/Rome "$S")"
same "storico: time_zone Europe/Rome" "$(history_field "$ID" time_zone)" "Europe/Rome"

XTZ="+02:00"
ID="$(save "$(body 25 "$(iso "$S")")")"
same "header con un offset (non IANA): ignorato, Roma" "$(history_field "$ID" date)" "$(local_in Europe/Rome "$S")"

echo
echo "Cambio data: conserva fuso e orario, il futuro è quello del luogo"
make_user c
XTZ="Asia/Tokyo"
S="$(date -d '10 minutes ago' +%s)"
ID="$(save "$(body 30 "$(iso "$S")")")"
TOKYO_TIME="$(local_in Asia/Tokyo "$S")"
TOKYO_TODAY="$(TZ=Asia/Tokyo date +%F)"
move() { call POST api/workout_history/update_date.php "$T" "$(jq -nc --argjson id "$ID" --arg d "$1" '{id:$id, new_date:$d}')"; }

R="$(move "$TOKYO_TODAY")"
check "solo data = oggi a Tokyo: accettata (non è futuro)" "$R" '.success == true'
same "il cambio data conserva l'orario" "$(history_field "$ID" date)" "$TOKYO_TODAY ${TOKYO_TIME#* }"
same "il cambio data conserva il fuso" "$(history_field "$ID" time_zone)" "Asia/Tokyo"
check "new_date con l'offset di Tokyo e started_at/time_zone" "$R" '.new_date | endswith("+09:00")'
check "risposta con started_at e time_zone" "$R" '.started_at == .new_date and .time_zone == "Asia/Tokyo"'

BEFORE_TOKYO="$(TZ=Asia/Tokyo date -d '1 hour ago' '+%F %T')"
check "data completa un'ora fa a Tokyo: accettata" "$(move "$BEFORE_TOKYO")" '.success == true'
same "data completa salvata come scritta" "$(history_field "$ID" date)" "$BEFORE_TOKYO"
check "un'ora avanti a Tokyo: future_date" "$(move "$(TZ=Asia/Tokyo date -d '1 hour' '+%F %T')")" '.code == "future_date"'
check "due giorni avanti: future_date" "$(move "$(TZ=Asia/Tokyo date -d '+2 days' +%F)")" '.code == "future_date"'
check "oltre 30 giorni fa: target_too_old" "$(move "$(TZ=Asia/Tokyo date -d '-40 days' +%F)")" '.code == "target_too_old"'

echo
echo "Gamification: la pausa XP di 10 ore conta sugli istanti, non sulle ore locali"
make_user d
XTZ="Asia/Tokyo"
S="$(date -d '25 minutes ago' +%s)"
R="$(call POST api/workout/record_workout.php "$T" "$(body 40 "$(iso "$S")")")"
check "prima sessione a Tokyo: XP di sessione" "$R" '.xp_session_awarded == true'
XTZ="America/New_York"
R="$(call POST api/workout/record_workout.php "$T" "$(body 41 "$(iso "$S")")")"
check "stesso istante da New York (13 ore di scarto sull'orologio): pausa" "$R" '.xp_session_awarded == false and .xp_session_reason == "cooldown"'

make_user e
XTZ="Asia/Tokyo"
SA="$(date -d '25 minutes ago' +%s)"
IDA="$(save "$(body 50 "$(iso "$SA")")")"
XTZ="America/New_York"
SB="$(date -d '745 minutes ago' +%s)"
R="$(call POST api/workout/record_workout.php "$T" "$(body 51 "$(iso "$SB")" "$(iso $((SB + 1500)))" true)")"
check "sessione di 12 ore prima da New York: XP di sessione" "$R" '.xp_session_awarded == true'
call POST api/workout_history/delete.php "$T" "{\"id\":$IDA}" >/dev/null
XTZ="Asia/Tokyo"
SC="$(date -d '265 minutes ago' +%s)"
R="$(call POST api/workout/record_workout.php "$T" "$(body 52 "$(iso "$SC")" "$(iso $((SC + 1500)))" true)")"
check "tolta la più recente, la pausa riparte dall'istante di quella rimasta (8 ore dopo)" "$R" '.xp_session_awarded == false and .xp_session_reason == "cooldown"'

echo
echo "Classifica del gruppo: la settimana è quella di chi guarda"
make_user g
TG="$T"
XTZ="Pacific/Kiritimati"
res="$(call POST api/groups/create.php "$TG" '{"name":"Fusi di prova","type":"friends"}')"
GID="$(echo "${res#* }" | jq -r '.group.id')"
CODE="$(echo "${res#* }" | jq -r '.group.invite_code')"
make_user h
XTZ="Pacific/Kiritimati"
call POST api/groups/join.php "$T" "{\"code\":\"$CODE\",\"consent\":true}" >/dev/null
KI_DOW="$(TZ=Pacific/Kiritimati date +%u)"
KI_MONDAY="$(TZ=Pacific/Kiritimati date -d "$((KI_DOW - 1)) days ago" +%F)"
MON_START="$(TZ=Pacific/Kiritimati date -d "$KI_MONDAY 00:30" +%s)"
save "$(body 60 "$(iso "$MON_START")" "$(iso $((MON_START + 1500)))" true)" >/dev/null
R="$(call GET "api/groups/read.php?group_id=$GID&board=week" "$TG")"
check "settimana del gruppo = quella di Kiritimati ($KI_MONDAY)" "$R" ".week.from == \"$KI_MONDAY\""
check "l'allenamento del lunedì 00:30 a Kiritimati conta nella sua settimana" "$R" '[.board[] | select(.is_me | not)][0].workouts == 1'

echo
echo "Statistiche: ready_at con l'offset del fuso del dispositivo"
save "$(body 61 "$(iso "$(date -d '30 minutes ago' +%s)")")" >/dev/null
R="$(call GET api/workout_stats/dashboard.php "$T")"
check "dashboard: ready_at ISO con offset +14:00" "$R" '[.recovery[] | select(.ready_at != null) | .ready_at] | length >= 1 and all(test("T[0-9:]+\\+14:00$"))'
XTZ="America/New_York"
R="$(call GET api/workout_stats/dashboard.php "$T")"
check "dashboard con un altro fuso: stesso istante, offset di New York" "$R" '[.recovery[] | select(.ready_at != null) | .ready_at] | all(test("-0[45]:00$"))'

echo
echo "Date in uscita: ISO con offset (D12)"
XTZ="Europe/Rome"
OFF='T[0-9:]+(\\.[0-9]+)?[+-][0-9]{2}:[0-9]{2}$'
R="$(call GET api/user/read.php "$T")"
check "user/read: created_at ISO con offset" "$R" ".created_at | test(\"$OFF\")"
check "user/read: password_changed_at null o ISO con offset" "$R" ".password_changed_at == null or (.password_changed_at | test(\"$OFF\"))"
R="$(call GET api/gamification/profile.php "$T")"
check "gamification/profile: unlocked_at ISO con offset" "$R" "[.achievements[] | select(.locked | not) | .unlocked_at] | length >= 1 and all(test(\"$OFF\"))"
R="$(call GET "api/groups/read.php?group_id=$GID" "$TG")"
check "groups/read: created_at ISO con offset" "$R" ".group.created_at | test(\"$OFF\")"
R="$(call GET api/groups/list.php "$TG")"
check "groups/list: joined_at ISO con offset" "$R" "[.groups[].joined_at] | length >= 1 and all(test(\"$OFF\"))"
R="$(call GET "api/groups/read.php?group_id=$GID" "$TG")"
check "groups/read: joined_at dei membri ISO con offset" "$R" "[.members[].joined_at] | length >= 1 and all(test(\"$OFF\"))"
R="$(call GET api/user/export.php "$T")"
check "export: i campi *_at sono ISO con offset" "$R" "[.profile.created_at, .profile.last_login_at, .plans[0].created_at, .gamification.achievements[0].unlocked_at, .devices[0].created_at, .consents[0].granted_at, .groups[0].joined_at] | all(. == null or test(\"$OFF\"))"

echo
echo "Fuso salvato su ogni richiesta autenticata, anche negli endpoint che non lo usano"
make_user i
XTZ="Asia/Tokyo"
call GET api/gamification/profile.php "$T" >/dev/null   # un endpoint che il fuso non lo usa
XTZ=""
S="$(date -d '10 minutes ago' +%s)"
ID="$(save "$(body 70 "$(iso "$S")")")"
same "gamification/profile con X-Timezone: il fuso va sul profilo" "$(history_field "$ID" time_zone)" "Asia/Tokyo"
XTZ="Mars/Olympus"
call GET api/user/read.php "$T" >/dev/null
XTZ=""
ID="$(save "$(body 71 "$(iso "$S")")")"
same "header non valido: il fuso salvato non cambia" "$(history_field "$ID" time_zone)" "Asia/Tokyo"
XTZ="America/New_York"
call GET api/user/read.php "$T" >/dev/null
XTZ=""
ID="$(save "$(body 72 "$(iso "$S")")")"
same "un nuovo fuso valido sostituisce quello salvato" "$(history_field "$ID" time_zone)" "America/New_York"

echo
echo "Recupero: il limite degli 8 giorni è quello del fuso del dispositivo, non del payload"
make_user j
cut() { TZ="$1" date -d "$(TZ="$1" date -d '8 days ago' +%F) 00:00" +%s; }   # mezzanotte di 8 giorni fa nel fuso
# Le due coppie scambiate danno sempre un accettato e un rifiutato, qualunque sia l'ora del giorno
for pair in "Pacific/Pago_Pago Pacific/Kiritimati" "Pacific/Kiritimati Pacific/Pago_Pago"; do
    DEVICE="${pair% *}"
    PAYLOAD="${pair#* }"
    DEV_CUT="$(cut "$DEVICE")"
    PAY_CUT="$(cut "$PAYLOAD")"
    MID=$(((DEV_CUT + PAY_CUT) / 2))   # fra i due limiti: il vecchio calcolo (fuso del payload) dà l'esito opposto
    XTZ="$DEVICE"
    R="$(call POST api/workout/record_workout.php "$T" "$(body 80 "$(iso "$MID")" "$(iso $((MID + 1500)))" true "$PAYLOAD")")"
    if (( DEV_CUT <= MID )); then
        check "dispositivo $DEVICE, payload $PAYLOAD: dentro il limite del dispositivo, accettato" "$R" '.success == true'
    else
        check "dispositivo $DEVICE, payload $PAYLOAD: oltre il limite del dispositivo, rifiutato" "$R" '.success == false'
    fi
done

echo
if (( fails )); then
    echo "✗ $fails controlli su $checks falliti"
    exit 1
fi
echo "✓ $checks controlli ok"
