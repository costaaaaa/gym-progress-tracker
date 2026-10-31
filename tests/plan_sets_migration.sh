#!/usr/bin/env bash
#
# plan_sets_migration.sh — prova la sezione 34 di schema_alter_migrations.sql (serie pianificate, #77)
# su un MySQL usa e getta.
#
#   tests/plan_sets_migration.sh
#
# Avvia mysql:9.7 senza rete (docker run, nome univoco, rimosso a fine test anche se fallisce), ci crea
# gym_workout_exercises com'era prima della 34 (senza chiavi esterne verso giorni ed esercizi), inserisce
# righe fixture generiche, esegue la sezione 34 estratta come fa gym-infra/bin/db-upgrade.sh e confronta
# il risultato con i valori scritti qui a mano. MYSQL_IMAGE sceglie l'immagine (default mysql:9.7).
#
# Nei valori attesi ogni serie è una parola: "w" riscaldamento, "12-12" numero, "8-10" intervallo,
# "F" a cedimento senza minimo, "F5" a cedimento con minimo 5; tra [] la tecnica di intensità.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS="$ROOT/backend/database/schema_alter_migrations.sql"
MYSQL_IMAGE="${MYSQL_IMAGE:-mysql:9.7}"
NAME="lx-plan-sets-mig-$$-$RANDOM"
DROP='Drop Set (Stripping)'
PREFIX='Ripetizioni nella scheda precedente: '

cleanup() { docker rm -f "$NAME" >/dev/null 2>&1; }
trap cleanup EXIT

checks=0
fails=0
check() { # descrizione atteso ottenuto
    checks=$((checks + 1))
    if [[ "$2" == "$3" ]]; then
        echo "  $(printf '\033[32m✓\033[0m') $1"
    else
        fails=$((fails + 1))
        echo "  $(printf '\033[31m✗\033[0m') $1"
        echo "      atteso:  $2"
        echo "      ottenuto: $3"
    fi
}

sql() { docker exec -i "$NAME" mysql -uroot --default-character-set=utf8mb4 -N -B t 2>&1 | grep -v "Using a password"; }
# Come sql, ma senza -B: stampa solo l'esito (0 = ok, 1 = errore SQL)
sql_fails() { if docker exec -i "$NAME" mysql -uroot t >/dev/null 2>&1; then echo "no"; else echo "sì"; fi; }

section() { awk -v n="$1" '/^-- [0-9]+\. /{ split($2, a, "."); cur = a[1] } cur == n' "$MIGRATIONS"; }

echo "Avvio MySQL usa e getta ($MYSQL_IMAGE)"
docker run -d --rm --name "$NAME" --network none -e MYSQL_ALLOW_EMPTY_PASSWORD=1 -e MYSQL_DATABASE=t "$MYSQL_IMAGE" >/dev/null || exit 2
for _ in $(seq 1 90); do
    docker logs "$NAME" 2>&1 | grep -q "MySQL init process done" && docker exec "$NAME" mysqladmin -uroot ping >/dev/null 2>&1 && break
    sleep 1
done
docker exec "$NAME" mysqladmin -uroot ping >/dev/null 2>&1 || { echo "MySQL non parte" >&2; exit 2; }

# gym_workout_exercises com'era prima della 34 (dopo la 33)
sql <<'SQL'
CREATE TABLE gym_workout_exercises (
  id int NOT NULL AUTO_INCREMENT,
  day_id int NOT NULL,
  exercise_id int NOT NULL,
  position smallint unsigned NOT NULL DEFAULT 0,
  sets int NOT NULL,
  warmup_sets tinyint unsigned NOT NULL DEFAULT 0,
  reps varchar(20) NOT NULL,
  rest int NOT NULL,
  intensity_technique varchar(100) DEFAULT NULL,
  notes text DEFAULT NULL,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
SQL

# Fixture: id, serie, riscaldamento, ripetizioni, tecnica, note. Un esercizio per riga.
sql <<'SQL'
INSERT INTO gym_workout_exercises (id, day_id, exercise_id, sets, warmup_sets, reps, rest, intensity_technique, notes) VALUES
  (1, 1, 1, 3, 0, '12',   60, NULL, NULL),
  (2, 1, 2, 3, 0, '8-10', 60, NULL, NULL),
  (3, 1, 3, 2, 0, ' 8-10 ', 60, NULL, NULL),
  (4, 1, 4, 3, 0, '12/10/8', 60, NULL, NULL),
  (5, 1, 5, 4, 0, '12/10', 60, NULL, NULL),
  (6, 1, 6, 2, 0, '12/10/8/6', 60, NULL, NULL),
  (7, 1, 7, 2, 0, '8-10/12-15', 60, NULL, NULL),
  (8, 1, 8, 2, 0, 'Max', 60, NULL, NULL),
  (9, 1, 9, 2, 0, 'max', 60, NULL, NULL),
  (10, 1, 10, 1, 0, ' MAX ', 60, NULL, NULL),
  (11, 1, 11, 2, 0, '12 / 10', 60, NULL, NULL),
  (12, 2, 1, 3, 0, '12/10/8+8+8', 60, NULL, NULL),
  (13, 2, 2, 4, 0, '15/12/10+10', 60, NULL, NULL),
  (14, 2, 3, 2, 0, '10+10', 60, NULL, NULL),
  (15, 2, 4, 4, 0, '12/10/8/6+6', 60, NULL, NULL),
  (16, 3, 1, 2, 0, '1 rest pause a 20', 60, NULL, NULL),
  (17, 3, 2, 2, 0, '5D+5S fino a 15', 60, NULL, NULL),
  (18, 3, 3, 1, 0, '8 (pesanti)', 60, NULL, NULL),
  (19, 3, 4, 2, 0, 'a piacere', 60, NULL, NULL),
  (20, 4, 1, 3, 0, '12', 60, 'Rest Pause', NULL),
  (21, 4, 2, 2, 0, '12', 60, 'Nessuna (Normale)', NULL),
  (22, 4, 3, 3, 0, '12/10/8+8', 60, 'Myo-Reps', NULL),
  (23, 4, 4, 3, 0, '12/10+10/8', 60, NULL, NULL),
  (24, 5, 1, 2, 2, '10', 60, NULL, NULL),
  (25, 5, 2, 1, 1, 'Max', 60, NULL, NULL),
  (26, 6, 1, 2, 0, '1 rest pause a 20', 60, NULL, 'Tenere i gomiti stretti'),
  (27, 6, 2, 2, 0, '1 rest pause a 20', 60, NULL, ''),
  (28, 6, 3, 2, 0, '12', 60, NULL, 'abc'),
  (29, 7, 1, 2, 0, '0', 60, NULL, NULL),
  (30, 7, 2, 2, 0, '300', 60, NULL, NULL),
  (31, 7, 3, 2, 0, '10-5', 60, NULL, NULL),
  (32, 7, 4, 0, 0, '12', 60, NULL, NULL),
  (33, 8, 1, 25, 0, '8', 60, NULL, NULL),
  (34, 8, 2, 1, 15, '8', 60, NULL, NULL),
  (35, 8, 3, 2, 0, '12"\\ 10', 60, NULL, NULL),
  (36, 8, 4, 2, 0, CONCAT('12', CHAR(9), '/10'), 60, NULL, NULL),
  (37, 9, 1, 2, 0, '', 60, NULL, NULL),
  (38, 9, 2, 2, 0, ' 12 - 15 ', 60, NULL, NULL),
  (39, 9, 3, 2, 0, '10 + 10', 60, NULL, NULL),
  (40, 9, 4, 3, 0, '12/10/8+8', 60, 'Rest Pause', NULL),
  (41, 10, 1, 3, 0, '12/10+10/8', 60, 'Negative', NULL),
  (42, 10, 2, 2, 0, '2x8 + 1x10+10', 60, NULL, NULL),
  (43, 10, 3, 2, 0, '08 e 012 volte', 60, NULL, NULL),
  (44, 10, 4, 2, 0, 'x9999999999999999999', 60, NULL, NULL),
  (45, 11, 1, 2, 0, CONCAT(' 1 rest  pause', CHAR(9), 'a 20 '), 60, NULL, NULL);
SQL

echo "Sezione 34"
[[ -n "$(section 34)" ]] || { echo "La sezione 34 non esiste in $MIGRATIONS" >&2; exit 2; }
out="$(section 34 | sql)"
[[ "$out" == *ERROR* ]] && { echo "Errore nella sezione 34:" >&2; echo "$out" >&2; exit 2; }

# Serie di un esercizio, una parola per serie, in ordine di set_number
sets_of() {
    echo "SELECT GROUP_CONCAT(
            CASE WHEN kind = 'warmup' THEN 'w'
                 WHEN to_failure = 1 THEN CONCAT('F', COALESCE(reps_min, ''))
                 ELSE CONCAT(reps_min, '-', reps_max) END,
            IF(intensity_technique IS NULL, '', CONCAT('[', intensity_technique, ']'))
            ORDER BY set_number SEPARATOR ' ')
          FROM gym_workout_plan_sets WHERE workout_exercise_id = $1" | sql
}

echo
echo "Numeri e intervalli"
check "12 → tre serie 12-12"    "12-12 12-12 12-12" "$(sets_of 1)"
check "8-10 → tre serie 8-10"   "8-10 8-10 8-10"    "$(sets_of 2)"
check "spazi ai bordi tolti"    "8-10 8-10"         "$(sets_of 3)"

echo
echo "Liste con /"
check "12/10/8: un valore per serie"                     "12-12 10-10 8-8"            "$(sets_of 4)"
check "più serie che valori: si ripete l'ultimo"         "12-12 10-10 10-10 10-10"    "$(sets_of 5)"
check "meno serie che valori: i valori in più cadono"    "12-12 10-10"                "$(sets_of 6)"
check "lista di intervalli"                              "8-10 12-15"                 "$(sets_of 7)"
check "spazi attorno alla barra"                         "12-12 10-10"                "$(sets_of 11)"

echo
echo "Max"
check "Max: tutte a cedimento, senza minimo"             "F F"   "$(sets_of 8)"
check "max minuscolo"                                    "F F"   "$(sets_of 9)"
check "MAX maiuscolo con spazi"                          "F"     "$(sets_of 10)"

notes_of() { echo "SELECT REPLACE(IFNULL(notes, 'NULL'), CHAR(10), '|') FROM gym_workout_exercises WHERE id = $1" | sql; }
count_sets() { echo "SELECT COUNT(*) FROM gym_workout_plan_sets WHERE workout_exercise_id = $1" | sql; }

echo
echo "Drop set con +"
check "12/10/8+8+8: drop set sulla terza"                    "12-12 10-10 8-8[$DROP]"                      "$(sets_of 12)"
check "15/12/10+10: l'ultimo ripetuto non ha tecnica"        "15-15 12-12 10-10[$DROP] 10-10"              "$(sets_of 13)"
check "10+10"                                                 "10-10[$DROP] 10-10"                          "$(sets_of 14)"
check "12/10/8/6+6"                                           "12-12 10-10 8-8 6-6[$DROP]"                  "$(sets_of 15)"
check "+ su una serie non ultima"                             "12-12 10-10[$DROP] 8-8"                      "$(sets_of 23)"
check "spazi attorno al +"                                    "10-10[$DROP] 10-10"                          "$(sets_of 39)"

echo
echo "Testo libero"
check "1 rest pause a 20: il numero più grande"                "20-20 20-20"                                 "$(sets_of 16)"
check "5D+5S fino a 15: il numero più grande"                  "15-15 15-15"                                 "$(sets_of 17)"
check "8 (pesanti)"                                           "8-8"                                         "$(sets_of 18)"
check "nessun numero: a cedimento"                            "F F"                                         "$(sets_of 19)"
check "testo vuoto: a cedimento"                              "F F"                                         "$(sets_of 37)"
check "virgolette e backslash nel testo (12 e 10: vale 12)"    "12-12 12-12"                                 "$(sets_of 35)"
check "2x8 + 1x10+10: vale 10"                                "10-10 10-10"                                 "$(sets_of 42)"
check "zeri iniziali (08 e 012): vale 12"                     "12-12 12-12"                                 "$(sets_of 43)"
check "numero a 19 cifre → portato a 250"                     "250-250 250-250"                             "$(sets_of 44)"
check "spazi doppi e tabulazione nel testo"                   "20-20 20-20"                                 "$(sets_of 45)"

echo
echo "Valori fuori limite: il testo diventa libero"
check "0 → portato a 1"                                "1-1 1-1"                                     "$(sets_of 29)"
check "300 → portato a 250"                                   "250-250 250-250"                             "$(sets_of 30)"
check "10-5 (rovesciato) → il numero più grande"                      "10-10 10-10"                                 "$(sets_of 31)"
check "0 → testo libero: note col prefisso"                "${PREFIX}0"                                  "$(notes_of 29)"
check "300 → testo libero: note col prefisso"                  "${PREFIX}300"                                "$(notes_of 30)"
check "10-5 (rovesciato) → testo libero: note col prefisso"    "${PREFIX}10-5"                               "$(notes_of 31)"
check "tabulazione nel testo"                                 "12-12 10-10"                                 "$(sets_of 36)"
check "intervallo con spazi"                                  "12-15 12-15"                                 "$(sets_of 38)"

echo
echo "Tecnica dell'esercizio"
check "sull'ultima serie allenante"                           "12-12 12-12 12-12[Rest Pause]"               "$(sets_of 20)"
check "Nessuna (Normale) non è una tecnica"                   "12-12 12-12"                                 "$(sets_of 21)"
check "prevale sul drop set dell'ultima serie"                "12-12 10-10 8-8[Myo-Reps]"                   "$(sets_of 22)"
check "prevale anche con + su una serie non ultima"           "12-12 10-10[$DROP] 8-8[Negative]"            "$(sets_of 41)"
check "prevale sul drop set (+ sull'ultima)"                  "12-12 10-10 8-8[Rest Pause]"                 "$(sets_of 40)"

echo
echo "Riscaldamento e numero di serie"
check "due serie di riscaldamento prima delle allenanti"      "w w 10-10 10-10"                             "$(sets_of 24)"
check "riscaldamento con Max"                                 "w F"                                         "$(sets_of 25)"
check "sets = 0 → una serie"                                  "12-12"                                       "$(sets_of 32)"
check "sets = 25 → venti serie"                               "20"                                          "$(count_sets 33)"
check "riscaldamento 15 → dieci + una allenante"              "11"                                          "$(count_sets 34)"

echo
echo "Note"
check "lista con +: riga con il testo originale"              "${PREFIX}12/10/8+8+8"                        "$(notes_of 12)"
check "testo libero: riga con il testo originale"             "${PREFIX}8 (pesanti)"                        "$(notes_of 18)"
check "note già presenti: si aggiunge in coda"                "Tenere i gomiti stretti|${PREFIX}1 rest pause a 20" "$(notes_of 26)"
check "note vuote: solo la riga"                              "${PREFIX}1 rest pause a 20"                  "$(notes_of 27)"
check "numero semplice: note intatte"                         "abc"                                         "$(notes_of 28)"
check "senza note e senza testo strano: restano NULL"         "NULL"                                        "$(notes_of 1)"
check "lista senza +: note intatte"                           "NULL"                                        "$(notes_of 4)"
check "Max: note intatte"                                     "NULL"                                        "$(notes_of 8)"
check "testo originale: solo i bordi tolti, spazi interni e tabulazione intatti" "1" \
    "$(echo "SELECT notes = CONCAT('$PREFIX', '1 rest  pause', CHAR(9), 'a 20') FROM gym_workout_exercises WHERE id = 45" | sql)"

echo
echo "Rilancio della sezione"
before="$(echo "SELECT COUNT(*), SUM(set_number), SUM(IFNULL(reps_min,0)) FROM gym_workout_plan_sets" | sql)|$(echo "SELECT MD5(GROUP_CONCAT(IFNULL(notes,'') ORDER BY id)) FROM gym_workout_exercises" | sql)"
section 34 | sql >/dev/null
after="$(echo "SELECT COUNT(*), SUM(set_number), SUM(IFNULL(reps_min,0)) FROM gym_workout_plan_sets" | sql)|$(echo "SELECT MD5(GROUP_CONCAT(IFNULL(notes,'') ORDER BY id)) FROM gym_workout_exercises" | sql)"
check "righe e note identiche" "$before" "$after"
check "note non duplicate"     "Tenere i gomiti stretti|${PREFIX}1 rest pause a 20" "$(notes_of 26)"

echo
echo "Vincoli della tabella"
ins() { echo "INSERT INTO gym_workout_plan_sets (workout_exercise_id, set_number, kind, reps_min, reps_max, to_failure) VALUES (1, 99, $1);" | sql_fails; }
check "allenante 8-10 valida"                       "no"  "$(ins "'working', 8, 10, 0")"
echo "DELETE FROM gym_workout_plan_sets WHERE set_number = 99" | sql >/dev/null
check "allenante a cedimento valida"                "no"  "$(ins "'working', NULL, NULL, 1")"
echo "DELETE FROM gym_workout_plan_sets WHERE set_number = 99" | sql >/dev/null
check "riscaldamento senza target valido"           "no"  "$(ins "'warmup', NULL, NULL, 0")"
echo "DELETE FROM gym_workout_plan_sets WHERE set_number = 99" | sql >/dev/null
check "allenante senza target rifiutata"            "sì"  "$(ins "'working', NULL, NULL, 0")"
check "allenante con solo il minimo rifiutata"      "sì"  "$(ins "'working', 8, NULL, 0")"
check "riscaldamento con target rifiutato"          "sì"  "$(ins "'warmup', 8, 8, 0")"
check "riscaldamento a cedimento rifiutato"         "sì"  "$(ins "'warmup', NULL, NULL, 1")"
check "riscaldamento con tecnica rifiutato"         "sì"  "$(echo "INSERT INTO gym_workout_plan_sets (workout_exercise_id, set_number, kind, intensity_technique) VALUES (1, 99, 'warmup', 'Rest Pause')" | sql_fails)"
check "ripetizioni 0 rifiutate"                     "sì"  "$(ins "'working', 0, 5, 0")"
check "ripetizioni 251 rifiutate"                   "sì"  "$(ins "'working', 5, 251, 0")"
check "minimo maggiore del massimo rifiutato"       "sì"  "$(ins "'working', 10, 8, 0")"
check "cedimento con massimo rifiutato"             "sì"  "$(ins "'working', 5, 8, 1")"
check "serie duplicata rifiutata"                   "sì"  "$(echo "INSERT INTO gym_workout_plan_sets (workout_exercise_id, set_number, kind, reps_min, reps_max) VALUES (1, 1, 'working', 5, 5)" | sql_fails)"

echo
echo "Colonne vecchie congelate e cascata"
check "INSERT senza sets e reps riesce" "no" "$(echo "INSERT INTO gym_workout_exercises (day_id, exercise_id, rest) VALUES (99, 99, 60)" | sql_fails)"
echo "DELETE FROM gym_workout_exercises WHERE id = 1" | sql >/dev/null
check "eliminando l'esercizio spariscono le sue serie" "0" "$(count_sets 1)"

echo
if [[ $fails -eq 0 ]]; then echo "$checks controlli, 0 falliti"; else echo "$checks controlli, $fails falliti"; exit 1; fi
