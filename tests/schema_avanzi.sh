#!/usr/bin/env bash
#
# schema_avanzi.sh — controlla che il backend non legga né scriva più le colonne e la tabella tolte
# dalla sezione 38 di schema_alter_migrations.sql (gym_workout_exercises.sets/warmup_sets/reps/
# intensity_technique, gym_workout_history.exercises e il suo indice user_id, gym_progress,
# gym_users.ai_tier/age/experience_years), che la sezione 37 renda facoltativa la colonna exercises e
# che la 38 sia idempotente e lasci intatti gli altri dati.
#
#   tests/schema_avanzi.sh
#
# Avvia in Docker un MySQL usa e getta (tests/lib/throwaway_mysql.sh) e il backend con il server
# integrato di PHP (immagine web), e chiama gli endpoint veri con un token Bearer:
# record_workout, workout_history/read, update_date, delete, user/export. Due fasi sullo stesso
# database:
#   1. database come uno già in produzione (colonne e tabella ancora presenti, `exercises` ancora
#      obbligatoria) più la sezione 37, eseguita due volte: l'allenamento si salva con `exercises`
#      NULL e tutti i percorsi funzionano;
#   2. sezione 38 eseguita due volte su quel database (con qualche riga di prova): colonne, indice e
#      tabella spariti, gli stessi percorsi passano lo stesso e le righe di prova sono intatte.
# Le prove sono in tests/schema_avanzi_test.php.
#
# Richiede docker. Esce con 1 se un controllo fallisce, con 2 se la preparazione fallisce.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS="$ROOT/backend/database/schema_alter_migrations.sql"
SECTION=38

source "$ROOT/tests/lib/throwaway_mysql.sh"
tm_setup av

# Database come uno di produzione prima della sezione 38: le colonne e la tabella da eliminare ci sono
# ancora. Lo schema completo del repo non le ha più, quindi si rimettono (se mancano) con le
# definizioni di prima.
legacy_add() { # tabella colonna definizione
    local n
    n="$(tm_sql -N -B -e "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = '$1' AND column_name = '$2'")"
    if [[ "$n" == 0 ]]; then tm_sql -e "ALTER TABLE \`$1\` ADD COLUMN \`$2\` $3" || tm_die "colonna $1.$2 non preparata"; fi
}
legacy_add gym_workout_exercises sets "int(11) NOT NULL DEFAULT 0"
legacy_add gym_workout_exercises warmup_sets "tinyint(3) unsigned NOT NULL DEFAULT 0"
legacy_add gym_workout_exercises reps "varchar(20) NOT NULL DEFAULT ''"
legacy_add gym_workout_exercises intensity_technique "varchar(100) DEFAULT NULL"
legacy_add gym_workout_history exercises "text NOT NULL"
legacy_add gym_users ai_tier "enum('free','premium') NOT NULL DEFAULT 'free'"
legacy_add gym_users age "int(11) DEFAULT NULL"
legacy_add gym_users experience_years "float DEFAULT '0'"
tm_sql -e 'ALTER TABLE gym_workout_history MODIFY `exercises` text NOT NULL' || tm_die "colonna non preparata"
if [[ "$(tm_sql -N -B -e "SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'gym_workout_history' AND index_name = 'user_id'")" == 0 ]]; then
    tm_sql -e 'ALTER TABLE gym_workout_history ADD KEY `user_id` (`user_id`)' || tm_die "indice non preparato"
fi
tm_sql <<'SQL' || tm_die "gym_progress non preparata"
CREATE TABLE IF NOT EXISTS `gym_progress` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `exercise_id` int(11) NOT NULL,
  `weight` decimal(5,2) NOT NULL,
  `date` date NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `exercise_id` (`exercise_id`),
  CONSTRAINT `gym_progress_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `gym_users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `gym_progress_ibfk_2` FOREIGN KEY (`exercise_id`) REFERENCES `gym_exercises` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
SQL

echo
echo "Sezione 37 (due esecuzioni) e percorsi con la colonna facoltativa, il resto ancora presente"
tm_run_section 37
tm_php_phase schema_avanzi_test.php with-column

# Dati che la sezione 38 non deve toccare, accanto a quelli delle colonne che elimina
tm_sql <<'SQL' || tm_die "dati di prova non inseriti"
INSERT INTO gym_users (id, username, email, password, birth_date, training_start_date, age, experience_years, ai_tier)
  VALUES (9001, 'seme', 'seme@example.test', 'x', '1990-04-02', '2018-01-15', 36, 8.5, 'premium');
INSERT INTO gym_workout_plans (id, user_id, name) VALUES (9001, 9001, 'Scheda seme');
INSERT INTO gym_workout_days (id, plan_id, name, day_order) VALUES (9001, 9001, 'Giorno seme', 1);
INSERT INTO gym_workout_exercises (id, day_id, exercise_id, position, rest, notes, sets, warmup_sets, reps, intensity_technique)
  VALUES (9001, 9001, 1, 0, 75, 'nota seme', 4, 1, '8-10', 'Rest Pause');
INSERT INTO gym_workout_plan_sets (workout_exercise_id, set_number, kind, reps_min, reps_max, intensity_technique)
  VALUES (9001, 1, 'working', 8, 10, 'Rest Pause');
INSERT INTO gym_workout_history (id, user_id, exercises, date, notes) VALUES (9001, 9001, '[{"exercise_id":1}]', '2026-11-01 10:00:00', 'allenamento seme');
INSERT INTO gym_workout_sets (workout_history_id, exercise_id, set_number, weight, reps, intensity_technique)
  VALUES (9001, 1, 1, 60, '8', 'Rest Pause');
INSERT INTO gym_progress (user_id, exercise_id, weight, date) VALUES (9001, 1, 60, '2026-11-01');
SQL

echo
echo "Sezione 38 (due esecuzioni): colonne e tabella eliminate, percorsi e dati invariati"
tm_run_section "$SECTION"
tm_php_phase schema_avanzi_test.php dropped

echo
echo "$total controlli, $failed falliti"
[[ "$failed" -eq 0 ]]
