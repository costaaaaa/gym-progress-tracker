-- ==============================================================================
-- Gym Progress Tracker - Cumulative Schema Alterations (Migrations)
-- ==============================================================================
-- Questo file raccoglie in ordine logico tutti gli statement di ALTER TABLE
-- necessari per aggiornare un database preesistente creato con le versioni iniziali.
--
-- NOTA PER INSTALLAZIONI PULITE:
-- Se stai configurando il database da zero, NON eseguire questo file!
-- Importa direttamente `gym_progress_tracker.sql`, che contiene già la struttura
-- completa e aggiornata con tutte le colonne e le tabelle.
-- ==============================================================================

USE `gym_progress_tracker`;

-- ------------------------------------------------------------------------------
-- 1. Tabelle introdotte dopo la creazione iniziale del DB (idempotenti)
-- ------------------------------------------------------------------------------
-- Su un'installazione creata con le primissime versioni dello schema queste
-- tabelle potrebbero non esistere ancora: le sezioni successive le alterano
-- (ALTER TABLE) assumendo che siano già presenti. IF NOT EXISTS le rende
-- innocue su un DB già aggiornato.

CREATE TABLE IF NOT EXISTS `gym_workout_history` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `exercises` text NOT NULL,
  `date` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `notes` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `gym_workout_history_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `gym_users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `gym_workout_sets` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `workout_history_id` int(11) NOT NULL,
  `exercise_id` int(11) NOT NULL,
  `set_number` int(11) NOT NULL,
  `weight` decimal(5,2) NOT NULL,
  `reps` varchar(50) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `workout_history_id` (`workout_history_id`),
  KEY `exercise_id` (`exercise_id`),
  CONSTRAINT `gym_workout_sets_ibfk_1` FOREIGN KEY (`workout_history_id`) REFERENCES `gym_workout_history` (`id`) ON DELETE CASCADE,
  CONSTRAINT `gym_workout_sets_ibfk_2` FOREIGN KEY (`exercise_id`) REFERENCES `gym_exercises` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
-- Nota: `intensity_technique` viene aggiunta più sotto (sezione 4), non qui,
-- per restare allineati con l'ordine cronologico delle vecchie migrazioni.

CREATE TABLE IF NOT EXISTS `gym_user_gamification` (
  `user_id`               INT          NOT NULL,
  `current_streak_weeks`  INT          NOT NULL DEFAULT 0,
  `longest_streak_weeks`  INT          NOT NULL DEFAULT 0,
  `last_completed_week`   INT          NULL     DEFAULT NULL,
  `updated_at`            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`),
  CONSTRAINT `fk_gamification_user`
    FOREIGN KEY (`user_id`) REFERENCES `gym_users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- Nota: `total_xp`/`level`/`lifetime_volume_kg` vengono aggiunte più sotto
-- (sezione 5), non qui, per lo stesso motivo.

CREATE TABLE IF NOT EXISTS `gym_exercise_gamification` (
  `user_id`     INT NOT NULL,
  `exercise_id` INT NOT NULL,
  `xp`          INT NOT NULL DEFAULT 0,
  `level`       INT NOT NULL DEFAULT 1,
  `updated_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`, `exercise_id`),
  CONSTRAINT `fk_exgam_user`     FOREIGN KEY (`user_id`)     REFERENCES `gym_users`(`id`)      ON DELETE CASCADE,
  CONSTRAINT `fk_exgam_exercise` FOREIGN KEY (`exercise_id`) REFERENCES `gym_exercises`(`id`)  ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `gym_achievements` (
  `id`              INT          NOT NULL AUTO_INCREMENT,
  `user_id`         INT          NOT NULL,
  `achievement_key` VARCHAR(50)  NOT NULL,
  `unlocked_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_achievement` (`user_id`, `achievement_key`),
  CONSTRAINT `fk_ach_user` FOREIGN KEY (`user_id`) REFERENCES `gym_users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `gym_rate_limits` (
  `rate_key` varchar(191) NOT NULL,
  `attempts` int(10) unsigned NOT NULL DEFAULT 0,
  `expires_at` datetime NOT NULL,
  PRIMARY KEY (`rate_key`),
  KEY `idx_expires_at` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ------------------------------------------------------------------------------
-- 2. Tabella gym_users: Profilo fisico, recupero muscolare e preferenze
-- ------------------------------------------------------------------------------

-- Campi per il calcolo del recupero muscolare e caratteristiche fisiche
ALTER TABLE `gym_users`
  ADD COLUMN `age` INT DEFAULT NULL AFTER `password`,
  ADD COLUMN `gender` ENUM('M', 'F') DEFAULT 'M' AFTER `age`,
  ADD COLUMN `experience_years` FLOAT DEFAULT 0 AFTER `gender`;

-- Campi data di nascita e data di inizio allenamenti
ALTER TABLE `gym_users`
  ADD COLUMN `birth_date` DATE NULL AFTER `email`,
  ADD COLUMN `training_start_date` DATE NULL AFTER `gender`;

-- Preferenza timer di recupero per la Modalità Focus (default abilitato: 1)
ALTER TABLE `gym_users`
  ADD COLUMN `rest_timer_enabled` TINYINT(1) NOT NULL DEFAULT 1 AFTER `experience_years`;

-- Tracciamento timestamp ultimo cambio password
ALTER TABLE `gym_users`
  ADD COLUMN `password_changed_at` DATETIME DEFAULT NULL AFTER `rest_timer_enabled`;


-- ------------------------------------------------------------------------------
-- 3. Tabella gym_workout_exercises: Note e Tecniche di Intensità
-- ------------------------------------------------------------------------------

-- Campo note personalizzate per esercizio nella scheda
ALTER TABLE `gym_workout_exercises`
  ADD COLUMN `notes` TEXT DEFAULT NULL AFTER `rest`;

-- Tecnica di intensità (es. Drop set, Rest-pause, Super set)
ALTER TABLE `gym_workout_exercises`
  ADD COLUMN `intensity_technique` VARCHAR(100) DEFAULT NULL AFTER `notes`;


-- ------------------------------------------------------------------------------
-- 4. Tabella gym_workout_sets: Tecniche di Intensità per serie registrata
-- ------------------------------------------------------------------------------

ALTER TABLE `gym_workout_sets`
  ADD COLUMN `intensity_technique` VARCHAR(100) DEFAULT NULL AFTER `reps`;


-- ------------------------------------------------------------------------------
-- 5. Tabella gym_user_gamification: Estensione XP, Livelli e Tonnellaggio
-- ------------------------------------------------------------------------------

ALTER TABLE `gym_user_gamification`
  ADD COLUMN `total_xp` INT NOT NULL DEFAULT 0 AFTER `last_completed_week`,
  ADD COLUMN `level` INT NOT NULL DEFAULT 1 AFTER `total_xp`,
  ADD COLUMN `lifetime_volume_kg` DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER `level`;


-- ------------------------------------------------------------------------------
-- 6. Tabella gym_api_tokens: autenticazione Bearer per client mobile (React Native)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `gym_api_tokens` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `token_hash` char(64) NOT NULL,
  `device_info` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` datetime NOT NULL,
  `revoked_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_token_hash` (`token_hash`),
  KEY `idx_user_id` (`user_id`),
  CONSTRAINT `gym_api_tokens_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `gym_users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ------------------------------------------------------------------------------
-- 7. Tabella gym_workout_history: indice per le letture per intervallo di date
--    (classifiche e riepiloghi settimanali filtrano per user_id e date)
-- ------------------------------------------------------------------------------

ALTER TABLE `gym_workout_history`
  ADD KEY `idx_user_date` (`user_id`, `date`);


-- ------------------------------------------------------------------------------
-- 8. Tabella gym_password_resets: recupero password via email
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `gym_password_resets` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `token_hash` char(64) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` datetime NOT NULL,
  `used_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_reset_token_hash` (`token_hash`),
  KEY `idx_reset_user_id` (`user_id`),
  CONSTRAINT `gym_password_resets_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `gym_users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ------------------------------------------------------------------------------
-- 9. gym_users.gender: aggiunto "O" (altro) e tolto il default "M": il sesso va scelto.
--    I valori gia' presenti non cambiano. Rieseguibile senza errori.
-- ------------------------------------------------------------------------------

ALTER TABLE `gym_users`
  MODIFY COLUMN `gender` ENUM('M', 'F', 'O') NULL DEFAULT NULL;


-- ------------------------------------------------------------------------------
-- 10. gym_users.password_legacy: 1 = la password e' bcrypt(sha256(password)),
--     ottenuto dallo script backend/tools/wrap_legacy_hashes.php per i vecchi hash
--     SHA-256 senza salt. Al primo login torna a 0 con un bcrypt normale.
--     Da eseguire una sola volta (ADD COLUMN non e' idempotente).
-- ------------------------------------------------------------------------------

ALTER TABLE `gym_users`
  ADD COLUMN `password_legacy` TINYINT(1) NOT NULL DEFAULT 0 AFTER `password`;


-- ------------------------------------------------------------------------------
-- 11. Tabella gym_consents: consensi dell'utente (termini, dati sulla salute, ...)
--     con versione del testo accettato e data di concessione/revoca.
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `gym_consents` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `purpose` varchar(30) NOT NULL,
  `version` varchar(20) NOT NULL,
  `granted_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `revoked_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_consent_user_purpose` (`user_id`, `purpose`),
  CONSTRAINT `gym_consents_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `gym_users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ------------------------------------------------------------------------------
-- 12. gym_users.last_login_at: ultimo accesso, per la conservazione dei dati.
--     Da eseguire una sola volta (ADD COLUMN non e' idempotente).
-- ------------------------------------------------------------------------------

ALTER TABLE `gym_users`
  ADD COLUMN `last_login_at` DATETIME NULL AFTER `password_changed_at`;


-- ------------------------------------------------------------------------------
-- 13. Gruppi (Livello 1): gruppi di amici o della palestra con codice invito e
--     classifica settimanale. Ruoli e livelli di condivisione sono gia' tutti
--     nello schema anche se il livello 1 usa solo owner, admin, member e summary.
--     Idempotente (CREATE TABLE IF NOT EXISTS).
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `gym_groups` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(60) NOT NULL,
  `type` enum('friends','gym','coaching') NOT NULL DEFAULT 'friends',
  `owner_user_id` int(11) NOT NULL,
  `invite_code` char(10) NOT NULL,
  `invite_enabled` tinyint(1) NOT NULL DEFAULT 1,
  `max_members` smallint(6) NOT NULL DEFAULT 50,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_invite_code` (`invite_code`),
  KEY `idx_owner` (`owner_user_id`),
  CONSTRAINT `fk_groups_owner` FOREIGN KEY (`owner_user_id`) REFERENCES `gym_users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `gym_group_members` (
  `group_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `role` enum('owner','admin','coach','member') NOT NULL DEFAULT 'member',
  `share_level` enum('summary','activity','full') NOT NULL DEFAULT 'summary',
  `share_consent_at` datetime NOT NULL,
  `joined_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`group_id`, `user_id`),
  KEY `idx_user` (`user_id`),
  CONSTRAINT `fk_gm_group` FOREIGN KEY (`group_id`) REFERENCES `gym_groups` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_gm_user` FOREIGN KEY (`user_id`) REFERENCES `gym_users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ------------------------------------------------------------------------------
-- 14. gym_user_stats.health_fields: i campi della riga arrivati da Apple Salute o
--     Health Connect. Un valore inserito a mano non ci sta mai e vince sempre; una
--     cancellazione in Salute svuota solo i campi segnati qui.
--     Da eseguire una sola volta (ADD COLUMN non e' idempotente).
-- ------------------------------------------------------------------------------

ALTER TABLE `gym_user_stats`
  ADD COLUMN `health_fields` SET('weight', 'body_fat_percentage', 'waist_size') NOT NULL DEFAULT '' AFTER `leg_size`;


-- ------------------------------------------------------------------------------
-- 15. gym_workout_history.duration_seconds: durata dell'allenamento, salvata da
--     record_workout.php (Focus Mode). NULL per gli allenamenti precedenti e per
--     quelli inseriti a mano.
--     Da eseguire una sola volta (ADD COLUMN non e' idempotente).
-- ------------------------------------------------------------------------------

ALTER TABLE `gym_workout_history`
  ADD COLUMN `duration_seconds` INT UNSIGNED DEFAULT NULL AFTER `date`;


-- ------------------------------------------------------------------------------
-- 16. Esercizi personali e admin. gym_exercises.created_by e status: un esercizio
--     creato da un utente nasce 'pending' e lo vede solo lui; diventa di tutti
--     quando un admin lo approva ('rejected' = resta solo suo). Il default
--     'approved' lascia com'e' il catalogo esistente e cio' che inserisce la
--     versione precedente, cosi' il rollback resta possibile.
--     gym_users.is_admin: si imposta solo da riga di comando (backend/tools/admin.php).
--     Da eseguire una sola volta (ADD COLUMN non e' idempotente).
-- ------------------------------------------------------------------------------

ALTER TABLE `gym_exercises`
  ADD COLUMN `created_by` int(11) DEFAULT NULL AFTER `muscle_group`,
  ADD COLUMN `status` enum('pending','approved','rejected') NOT NULL DEFAULT 'approved' AFTER `created_by`,
  ADD COLUMN `reviewed_at` datetime DEFAULT NULL AFTER `status`,
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_created_by` (`created_by`),
  ADD CONSTRAINT `fk_exercises_creator` FOREIGN KEY (`created_by`) REFERENCES `gym_users` (`id`) ON DELETE SET NULL;

ALTER TABLE `gym_users`
  ADD COLUMN `is_admin` tinyint(1) NOT NULL DEFAULT 0 AFTER `rest_timer_enabled`;


-- ------------------------------------------------------------------------------
-- 17. Catalogo esercizi multilingua. gym_exercises.name_en: nome inglese (la lingua
--     inglese ricade su name se e' NULL); equipment: attrezzo (bilanciere, manubri,
--     cavi, macchina, multipower, corpo_libero, kettlebell); merged_into: l'esercizio
--     che ha preso il posto di un doppione (il doppione resta nascosto, status
--     'rejected', cosi' gli id vecchi non diventano orfani). Solo colonne nuove: il
--     rollback del codice resta possibile. Da eseguire una sola volta.
-- ------------------------------------------------------------------------------

ALTER TABLE `gym_exercises`
  ADD COLUMN `name_en` varchar(100) DEFAULT NULL AFTER `name`,
  ADD COLUMN `equipment` varchar(30) DEFAULT NULL AFTER `muscle_group`,
  ADD COLUMN `merged_into` int(11) DEFAULT NULL AFTER `reviewed_at`,
  ADD KEY `idx_merged_into` (`merged_into`),
  ADD CONSTRAINT `fk_exercises_merged` FOREIGN KEY (`merged_into`) REFERENCES `gym_exercises` (`id`) ON DELETE SET NULL;


-- ------------------------------------------------------------------------------
-- 18. Lingua dell'utente. gym_users.locale: 'it' o 'en', scelta dal selettore in Account
--     (o dalla lingua del dispositivo alla registrazione). Il server la usa per i nomi
--     degli esercizi; in seguito per email e AI Coach. Colonna nuova con default: il
--     rollback del codice resta possibile. Da eseguire una sola volta.
-- ------------------------------------------------------------------------------

ALTER TABLE `gym_users`
  ADD COLUMN `locale` varchar(5) NOT NULL DEFAULT 'it' AFTER `is_admin`;


-- ------------------------------------------------------------------------------
-- 19. XP di sessione con regole (60% della scheda, 20 minuti, 10 ore tra una sessione
--     con XP e la successiva). gym_user_gamification.last_xp_session_at: quando e'
--     stata data l'ultima sessione con XP. Il livello per esercizio passa alla curva
--     25x(L-1)^2: i livelli gia' salvati si ricalcolano dagli XP (ricalcolo ripetibile).
--     Colonna nuova con default: il rollback del codice resta possibile.
-- ------------------------------------------------------------------------------

ALTER TABLE `gym_user_gamification`
  ADD COLUMN `last_xp_session_at` DATETIME NULL DEFAULT NULL AFTER `lifetime_volume_kg`;

UPDATE `gym_exercise_gamification` SET `level` = FLOOR(SQRT(`xp` / 25)) + 1;


-- ------------------------------------------------------------------------------
-- 20. Salvataggio idempotente. gym_workout_history.idempotency_key: chiave che il
--     client genera all'inizio della sessione e rimanda a ogni tentativo di salvataggio;
--     unica per utente, cosi' un secondo invio dello stesso allenamento non lo duplica.
--     NULL per le app che non la mandano (piu' NULL non si scontrano nell'indice unico).
--     Colonna nuova nullable: il rollback del codice resta possibile.
-- ------------------------------------------------------------------------------

ALTER TABLE `gym_workout_history`
  ADD COLUMN `idempotency_key` varchar(64) DEFAULT NULL AFTER `notes`,
  ADD UNIQUE KEY `uniq_user_idempotency` (`user_id`, `idempotency_key`);


-- ------------------------------------------------------------------------------
-- 21. XP annullabili. gym_workout_rewards (una riga per allenamento: XP generali dati,
--     senza il bonus streak, e se ha dato XP di sessione) e gym_workout_exercise_rewards
--     (una riga per esercizio: XP, se e' un PR, giorno dell'allenamento al salvataggio)
--     permettono di togliere quegli XP quando l'allenamento si cancella, e di dare i
--     record al massimo una volta per esercizio al giorno. Solo tabelle nuove con
--     CASCADE: il rollback del codice resta possibile. Gli allenamenti salvati prima non
--     hanno righe: cancellarli non cambia gli XP.
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `gym_workout_rewards` (
  `workout_id`  INT        NOT NULL,
  `user_id`     INT        NOT NULL,
  `xp_general`  INT        NOT NULL DEFAULT 0,
  `xp_session`  TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`workout_id`),
  KEY `idx_rewards_user` (`user_id`, `xp_session`),
  CONSTRAINT `fk_wrewards_workout` FOREIGN KEY (`workout_id`) REFERENCES `gym_workout_history`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `gym_workout_exercise_rewards` (
  `workout_id`  INT        NOT NULL,
  `exercise_id` INT        NOT NULL,
  `user_id`     INT        NOT NULL,
  `xp`          INT        NOT NULL DEFAULT 0,
  `is_pr`       TINYINT(1) NOT NULL DEFAULT 0,
  `day`         DATE       NOT NULL,
  PRIMARY KEY (`workout_id`, `exercise_id`),
  KEY `idx_exrewards_pr` (`user_id`, `exercise_id`, `day`, `is_pr`),
  CONSTRAINT `fk_exrewards_workout`  FOREIGN KEY (`workout_id`)  REFERENCES `gym_workout_history`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_exrewards_exercise` FOREIGN KEY (`exercise_id`) REFERENCES `gym_exercises`(`id`)       ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------------------------
-- 22. Streak reversibile. gym_streak_weeks: una riga per settimana chiusa (che ha dato
--     il bonus streak), con l'obiettivo di quel momento. Streak corrente e massimo si
--     ricavano da qui; le colonne di gym_user_gamification restano come copia per chi
--     legge. gym_user_gamification.streak_floor_weeks: minimo dello streak massimo (serie
--     vecchia); NULL = registro dell'utente non ancora ricostruito, lo ricostruisce il
--     primo salvataggio, cancellazione o cambio data. Solo aggiunte: il rollback del
--     codice resta possibile (vedi DB_UPGRADE_README.md).
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `gym_streak_weeks` (
  `user_id`  INT NOT NULL,
  `yearweek` INT NOT NULL,
  `goal`     INT NOT NULL,
  PRIMARY KEY (`user_id`, `yearweek`),
  CONSTRAINT `fk_streak_weeks_user` FOREIGN KEY (`user_id`) REFERENCES `gym_users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE `gym_user_gamification`
  ADD COLUMN `streak_floor_weeks` INT NULL DEFAULT NULL AFTER `last_xp_session_at`;

-- ------------------------------------------------------------------------------
-- 23. Obiettivo settimanale scelto dall'utente. gym_weekly_goal_changes: una riga per
--     cambio, valido dalla settimana ISO from_yearweek (formato 'oW', come gym_streak_weeks);
--     per una settimana vale la riga con from_yearweek più alto fra quelle ≤ alla settimana.
--     goal NULL = torna al default (giorni della scheda attiva, 3 senza scheda). Un cambio
--     fatto lunedì o martedì vale dalla settimana in corso, uno fatto dopo dal lunedì
--     successivo. Solo aggiunte: il rollback del codice resta possibile (vedi
--     DB_UPGRADE_README.md).
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `gym_weekly_goal_changes` (
  `user_id`       INT NOT NULL,
  `from_yearweek` INT NOT NULL,
  `goal`          TINYINT NULL DEFAULT NULL,
  PRIMARY KEY (`user_id`, `from_yearweek`),
  CONSTRAINT `fk_weekly_goal_user` FOREIGN KEY (`user_id`) REFERENCES `gym_users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------------------------
-- 24. Segnalazioni dei contenuti nei gruppi (DSA art. 16): nome del gruppo o nome
--     utente di un membro. target_label è il nome al momento della segnalazione.
--     Le FK sono ON DELETE SET NULL: la segnalazione e la decisione restano anche
--     se gruppo o account spariscono. Solo aggiunte: il rollback del codice resta
--     possibile (vedi DB_UPGRADE_README.md).
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `gym_reports` (
  `id`               INT NOT NULL AUTO_INCREMENT,
  `reporter_user_id` INT NULL DEFAULT NULL,
  `group_id`         INT NULL DEFAULT NULL,
  `target`           ENUM('group_name','member') NOT NULL,
  `target_user_id`   INT NULL DEFAULT NULL,
  `target_label`     VARCHAR(60) NOT NULL,
  `reason`           VARCHAR(1000) NOT NULL,
  `status`           ENUM('open','resolved','dismissed') NOT NULL DEFAULT 'open',
  `decision_note`    VARCHAR(500) NULL DEFAULT NULL,
  `decided_at`       DATETIME NULL DEFAULT NULL,
  `created_at`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_status_created` (`status`, `created_at`),
  CONSTRAINT `fk_reports_reporter` FOREIGN KEY (`reporter_user_id`) REFERENCES `gym_users`(`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_reports_group` FOREIGN KEY (`group_id`) REFERENCES `gym_groups`(`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_reports_target_user` FOREIGN KEY (`target_user_id`) REFERENCES `gym_users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------------------------
-- 25. Blocco del nome del gruppo dopo le rinomine d'ufficio (segnalazioni accolte con
--     «Rinomina gruppo»). gym_groups.admin_renames: quante sono state; admin_renamed_at:
--     quando l'ultima. Dopo la prima il proprietario non può cambiare il nome per 14 giorni,
--     dalla seconda mai più (vedi Group::nameLock). Sul gruppo e non contate in gym_reports,
--     perché le segnalazioni chiuse si cancellano dopo 5 anni. Solo aggiunte: il rollback del
--     codice resta possibile (vedi DB_UPGRADE_README.md).
-- ------------------------------------------------------------------------------

ALTER TABLE `gym_groups`
  ADD COLUMN `admin_renames` TINYINT UNSIGNED NOT NULL DEFAULT 0 AFTER `max_members`,
  ADD COLUMN `admin_renamed_at` DATETIME NULL DEFAULT NULL AFTER `admin_renames`;

-- ------------------------------------------------------------------------------
-- 26. Testo libero salvato con le entità HTML. I model applicavano htmlspecialchars al
--     nome dei giorni, alle note e alle ripetizioni: con PHP 8.1+ "dell'atleta" finiva nel
--     DB come "dell&#039;atleta" e la UI (React, mobile) lo mostrava così. Ora i model
--     salvano il testo in chiaro; qui si riportano in chiaro le righe già salvate.
--     &amp; va per ultimo. Da eseguire una volta sola: una seconda esecuzione
--     decodificherebbe anche un "&lt;" scritto alla lettera dall'utente.
-- ------------------------------------------------------------------------------

UPDATE `gym_workout_days`
  SET `name` = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(`name`, '&#039;', ''''), '&quot;', '"'), '&lt;', '<'), '&gt;', '>'), '&amp;', '&')
  WHERE `name` LIKE '%&%;%';

UPDATE `gym_workout_history`
  SET `notes` = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(`notes`, '&#039;', ''''), '&quot;', '"'), '&lt;', '<'), '&gt;', '>'), '&amp;', '&')
  WHERE `notes` LIKE '%&%;%';

UPDATE `gym_workout_exercises`
  SET `reps` = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(`reps`, '&#039;', ''''), '&quot;', '"'), '&lt;', '<'), '&gt;', '>'), '&amp;', '&'),
      `notes` = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(`notes`, '&#039;', ''''), '&quot;', '"'), '&lt;', '<'), '&gt;', '>'), '&amp;', '&'),
      `intensity_technique` = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(`intensity_technique`, '&#039;', ''''), '&quot;', '"'), '&lt;', '<'), '&gt;', '>'), '&amp;', '&')
  WHERE `reps` LIKE '%&%;%' OR `notes` LIKE '%&%;%' OR `intensity_technique` LIKE '%&%;%';

UPDATE `gym_workout_sets`
  SET `reps` = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(`reps`, '&#039;', ''''), '&quot;', '"'), '&lt;', '<'), '&gt;', '>'), '&amp;', '&'),
      `intensity_technique` = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(`intensity_technique`, '&#039;', ''''), '&quot;', '"'), '&lt;', '<'), '&gt;', '>'), '&amp;', '&')
  WHERE `reps` LIKE '%&%;%' OR `intensity_technique` LIKE '%&%;%';

-- ------------------------------------------------------------------------------
-- 27. gym_workout_history.health_written_at: quando il telefono ha scritto l'allenamento
--     nell'app Salute (Apple Salute o Health Connect). NULL = non è in Salute. Lo imposta
--     workout_history/health_mark.php su segnalazione del telefono; read.php lo espone come
--     health_written, così il web sa se avvisare, eliminando o spostando un allenamento, che
--     in Salute resta. Colonna nuova nullable: il rollback del codice resta possibile.
-- ------------------------------------------------------------------------------

ALTER TABLE `gym_workout_history`
  ADD COLUMN `health_written_at` DATETIME NULL DEFAULT NULL AFTER `idempotency_key`;

-- ------------------------------------------------------------------------------
-- 28. Orario degli allenamenti salvato in UTC. record_workout.php formattava start_time
--     (UTC, "...Z") senza portarlo nel fuso del server (Europe/Rome): un allenamento
--     iniziato alle 17:00 finiva nel DB come 16:00. Ora il codice converte; qui si portano
--     in ora italiana le righe con duration_seconds valorizzato (+2 ore se il valore UTC
--     cade nell'ora legale, +1 altrimenti; finestre scritte a mano perché le tabelle dei
--     fusi di MySQL possono non essere caricate). Da eseguire una volta sola.
--     Non corregge: i salvataggi senza duration_seconds (da giugno a inizio ottobre 2026),
--     le sessioni recuperate senza ended_at valido e le durate sotto i 60 s restano in UTC.
--     Può spostare per errore le righe con duration_seconds già in ora del server: data
--     cambiata con update_date.php, sessione recuperata con start_time nel futuro salvata
--     con l'ora attuale. Non toccano gym_user_gamification.last_xp_session_at (il cooldown
--     degli XP è sfalsato una volta sola) né gym_streak_weeks.
-- ------------------------------------------------------------------------------

UPDATE `gym_workout_history`
  SET `date` = `date` + INTERVAL (
    CASE
      WHEN `date` >= '2025-03-30 01:00:00' AND `date` < '2025-10-26 01:00:00' THEN 2
      WHEN `date` >= '2026-03-29 01:00:00' AND `date` < '2026-10-25 01:00:00' THEN 2
      ELSE 1
    END
  ) HOUR
  WHERE `duration_seconds` IS NOT NULL;

-- ------------------------------------------------------------------------------
-- 29. Fuso orario degli allenamenti (#55). `date` resta l'ora locale del luogo dove ci si
--     è allenati (DATETIME senza fuso, come prima); gym_workout_history.time_zone dice quale
--     luogo (nome IANA), così si ricava l'istante e l'ora legale si ricalcola. Le righe
--     esistenti valgono Europe/Rome, il fuso con cui sono state salvate. gym_users.time_zone
--     è l'ultimo fuso visto dal dispositivo (header X-Timezone): NULL = mai visto, vale Roma.
--     Solo colonne nuove: il rollback del codice resta possibile.
-- ------------------------------------------------------------------------------

ALTER TABLE `gym_workout_history`
  ADD COLUMN `time_zone` VARCHAR(64) NOT NULL DEFAULT 'Europe/Rome' AFTER `health_written_at`;

ALTER TABLE `gym_users`
  ADD COLUMN `time_zone` VARCHAR(64) NULL DEFAULT NULL AFTER `locale`;

-- ------------------------------------------------------------------------------
-- 30. gym_exercises.primary_muscle: il muscolo contato nelle serie settimanali e nel
--     recupero, separato da muscle_group (che resta per cercare e raggruppare: filtri, schede,
--     Progress, share card, AI Coach). Oggi "gambe" vale sempre quadricipiti nel recupero: stacco
--     e adductor machine finiscono lì. Le regole (gruppi ammessi, default, normalizzazione) sono
--     in backend/lib/muscle_rules.php. Un esercizio con primary_muscle NULL non conta (è il caso
--     di una "gambe" personale creata prima di questa migrazione: la scelta è ambigua e solo chi
--     l'ha creata può specificarla, da ora in poi, con l'admin o ricreando l'esercizio).
--     Colonna nuova nullable: il rollback del codice resta possibile (vedi DB_UPGRADE_README.md).
-- ------------------------------------------------------------------------------

ALTER TABLE `gym_exercises`
  ADD COLUMN `primary_muscle` VARCHAR(20) NULL DEFAULT NULL AFTER `muscle_group`;

-- Ogni gruppo diverso da "gambe" si normalizza da solo (stessa mappa di muscleNormalizeGroup):
-- vale per il catalogo e per gli esercizi personali, perché per questi gruppi la derivazione è
-- automatica e senza ambiguità.
UPDATE `gym_exercises`
  SET `primary_muscle` = CASE LOWER(`muscle_group`)
    WHEN 'dorsali' THEN 'schiena'
    WHEN 'lat' THEN 'schiena'
    WHEN 'tricipite' THEN 'tricipiti'
    WHEN 'bicipite' THEN 'bicipiti'
    WHEN 'quadricipite' THEN 'quadricipiti'
    WHEN 'femorale' THEN 'femorali'
    WHEN 'gluteo' THEN 'glutei'
    WHEN 'polpaccio' THEN 'polpacci'
    WHEN 'addominali' THEN 'addome'
    ELSE LOWER(`muscle_group`)
  END
  WHERE LOWER(`muscle_group`) <> 'gambe';

-- Abductor Machine è nel catalogo come gruppo "glutei" (per cercarla insieme a Hip Thrust e
-- affini) ma conta per abduttori: corregge il valore di default che l'UPDATE sopra le ha dato.
UPDATE `gym_exercises` SET `primary_muscle` = 'abduttori'
  WHERE `created_by` IS NULL AND `name` = 'Abductor Machine';

-- I 12 esercizi "gambe" del catalogo (created_by NULL), per nome: gli id cambiano da ambiente ad
-- ambiente, il nome no. Le "gambe" personali restano NULL (non contano, vedi sopra).
UPDATE `gym_exercises` SET `primary_muscle` = 'quadricipiti'
  WHERE `created_by` IS NULL AND LOWER(`muscle_group`) = 'gambe' AND `name` IN (
    'Squat (Bilanciere)', 'Box Squat', 'Goblet Squat', 'Hack Squat 45', 'Leg Press 45',
    'Pendulum Squat', 'Bulgarian Split Squat', 'Affondi'
  );

UPDATE `gym_exercises` SET `primary_muscle` = 'glutei'
  WHERE `created_by` IS NULL AND LOWER(`muscle_group`) = 'gambe' AND `name` IN (
    'Sumo Squat', 'Stacco da Terra (Bilanciere)', 'Stacco da Terra (Manubri)'
  );

UPDATE `gym_exercises` SET `primary_muscle` = 'adduttori'
  WHERE `created_by` IS NULL AND LOWER(`muscle_group`) = 'gambe' AND `name` = 'Adductor Machine';

-- ------------------------------------------------------------------------------
-- 31. Serie di riscaldamento (#66): non sono serie allenanti, si aggiungono a `sets` (una
--     scheda con sets=3, warmup_sets=2 vale 2 serie di riscaldamento + 3 allenanti).
--     gym_workout_exercises.warmup_sets è quante ne prevede la scheda per quell'esercizio;
--     gym_workout_sets.is_warmup segna le singole serie dello storico. Restano visibili nello
--     storico ma sono escluse da conteggio serie, recupero, tonnellaggio/volume (ovunque: volume
--     settimanale, workout_stats/volume.php, classifica dei gruppi, volume e achievement a vita,
--     XP) e record personali: vedi backend/lib/weekly_stats.php, workout_gamification.php,
--     workout_stats/dashboard.php e volume.php. In questo passo nessuno le scrive dall'interfaccia
--     (Focus e inserimento manuale sono il passo successivo, #67): is_warmup resta sempre 0 nei
--     dati reali finché non arriva quell'interfaccia. Colonne nuove NOT NULL DEFAULT 0: il
--     rollback del codice resta possibile.
-- ------------------------------------------------------------------------------

ALTER TABLE `gym_workout_exercises`
  ADD COLUMN `warmup_sets` TINYINT(3) UNSIGNED NOT NULL DEFAULT 0 AFTER `sets`;

ALTER TABLE `gym_workout_sets`
  ADD COLUMN `is_warmup` TINYINT(1) NOT NULL DEFAULT 0 AFTER `intensity_technique`;

-- ------------------------------------------------------------------------------
-- 32. Orario delle serie (#26): gym_workout_sets.seconds_from_start sono i secondi netti dall'inizio
--     della sessione (stesso orologio di duration_seconds, pause escluse) in cui la serie è stata
--     confermata nel Focus. Serve a ricavare la posizione dell'esercizio nella seduta (Progressi) e
--     l'ordine reale delle serie. NULL per le sessioni precedenti, l'inserimento manuale, le serie
--     confermate in modalità "già finito" e le bozze di prima. record_workout.php accetta solo un
--     intero 0-86400, altrimenti salva NULL senza errore. Colonna nuova nullable: il rollback del
--     codice resta possibile.
-- ------------------------------------------------------------------------------

ALTER TABLE `gym_workout_sets`
  ADD COLUMN `seconds_from_start` INT UNSIGNED NULL DEFAULT NULL AFTER `is_warmup`;

-- ------------------------------------------------------------------------------
-- 33. Ordine degli esercizi (#77): gym_workout_exercises.position è l'ordine dell'esercizio dentro
--     il giorno (1, 2, 3, ...; a parità si ordina per id). Prima l'ordine era l'id della riga e il
--     riordino scambiava il contenuto di due righe vicine (exercise_id, serie, ripetizioni, ...):
--     chi punta a gym_workout_exercises.id (le serie per esercizio dei passi successivi) si
--     sarebbe trovato attaccato all'esercizio sbagliato. Ora il riordino cambia solo le position
--     (rinumera il giorno 1..n e scrive solo le righe cambiate) e ogni riga resta legata al suo
--     esercizio; eliminando un esercizio non si ricompatta, il buco si chiude al primo riordino
--     del giorno. L'UPDATE numera le righe esistenti nell'ordine attuale (id) dentro ogni
--     giorno. Colonna nuova NOT NULL DEFAULT 0: il rollback del codice resta possibile (il codice
--     vecchio ignora la colonna e ordina ancora per id). Dopo un rollback e un nuovo deploy, le righe
--     aggiunte dal codice vecchio hanno position 0 e salgono in cima al giorno: si sistemano
--     rilanciando l'UPDATE con ROW_NUMBER di questa sezione, oppure da sole al primo riordino di
--     quel giorno.
-- ------------------------------------------------------------------------------

ALTER TABLE `gym_workout_exercises`
  ADD COLUMN `position` SMALLINT UNSIGNED NOT NULL DEFAULT 0 AFTER `exercise_id`;

UPDATE `gym_workout_exercises` we
  JOIN (
    SELECT `id`, ROW_NUMBER() OVER (PARTITION BY `day_id` ORDER BY `id`) AS `n`
    FROM `gym_workout_exercises`
  ) numbered ON numbered.`id` = we.`id`
  SET we.`position` = numbered.`n`;

-- ------------------------------------------------------------------------------
-- 34. Serie pianificate (#77): una riga per ogni serie pianificata di un esercizio di scheda
--     (riscaldamento compreso), al posto dei campi `sets`, `warmup_sets`, `reps` e
--     `intensity_technique` di gym_workout_exercises. Ogni serie ha il suo target di ripetizioni
--     (numero, intervallo o "a cedimento") e la sua tecnica; il riscaldamento non ha né target né
--     tecnica. Le colonne vecchie restano nella tabella, congelate: il codice non le legge né le
--     scrive più e si tolgono in un rilascio successivo. Per questo `sets` e `reps` (NOT NULL senza
--     default) ricevono un default, altrimenti l'INSERT del codice nuovo fallirebbe.
--
--     Conversione dei dati (tutte le schede, anche inattive): per ogni esercizio senza ancora serie
--     prima `warmup_sets` righe di riscaldamento, poi `sets` righe allenanti con il target ricavato
--     da `reps`:
--       12            tutte 12-12                      8-10          tutte 8-10
--       12/10/8       un valore per serie: più serie dei valori ripetono l'ultimo, meno serie li
--                     scartano
--       Max           tutte a cedimento, senza minimo (maiuscole e minuscole indifferenti)
--       12/10/8+8+8   il numero (o intervallo) prima del primo "+" è il target e quella serie
--                     riceve la tecnica "Drop Set (Stripping)" (le serie ripetute oltre i valori no)
--       altro testo   tutte col numero più grande del testo, portato dentro 1..250; nessun numero:
--                     a cedimento
--     La tecnica dell'esercizio (non vuota e diversa da "Nessuna (Normale)") va sull'ultima serie
--     allenante e prevale sul drop set di `+`.
--
--     Oltre a quanto sopra, la sezione fa quattro cose in più:
--       1. limita `sets` a 1..20 (0 diventa 1, 25 diventa 20) e `warmup_sets` a 10;
--       2. tratta come testo libero una parte di `reps` con un numero fuori da 1..250 (0, 300) o con
--          un intervallo rovesciato (10-5);
--       3. toglie gli spazi attorno a "/", "-" e "+" prima di leggere `reps` ("12 / 10 - 12");
--       4. salta gli esercizi che hanno già serie (NOT EXISTS), quindi rilanciata non fa niente.
--
--     Le righe "interpretate" (lista con `+` o testo libero) hanno in `notes` il testo di `reps`
--     com'era (tolti solo gli spazi ai bordi), con il prefisso `Ripetizioni nella scheda precedente: `
--     e in coda se le note c'erano già, per rivederle:
--       SELECT id, notes FROM gym_workout_exercises WHERE notes LIKE '%Ripetizioni nella scheda precedente: %';
--
--     La sezione usa START TRANSACTION e tabelle temporanee: `db-upgrade.sh` la esegue in una sola
--     sessione mysql (apply_sql -> mysql_app), come serve. Rollback del solo codice possibile: la
--     tabella è nuova e cambiano solo i default di `sets` e `reps`; le schede esistenti restano
--     leggibili dal codice vecchio, quelle create dopo si vedrebbero come "0 × " (default congelati).
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `gym_workout_plan_sets` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `workout_exercise_id` INT NOT NULL,
  `set_number` TINYINT UNSIGNED NOT NULL,
  `kind` ENUM('warmup','working') NOT NULL,
  `reps_min` TINYINT UNSIGNED NULL,
  `reps_max` TINYINT UNSIGNED NULL,
  `to_failure` TINYINT(1) NOT NULL DEFAULT 0,
  `intensity_technique` VARCHAR(100) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `exercise_set` (`workout_exercise_id`, `set_number`),
  CONSTRAINT `gym_workout_plan_sets_ibfk_1` FOREIGN KEY (`workout_exercise_id`) REFERENCES `gym_workout_exercises` (`id`) ON DELETE CASCADE,
  CONSTRAINT `gym_workout_plan_sets_reps_range` CHECK ((`reps_min` IS NULL OR `reps_min` BETWEEN 1 AND 250) AND (`reps_max` IS NULL OR `reps_max` BETWEEN 1 AND 250) AND (`reps_min` IS NULL OR `reps_max` IS NULL OR `reps_min` <= `reps_max`)),
  CONSTRAINT `gym_workout_plan_sets_warmup_empty` CHECK (`kind` = 'working' OR (`reps_min` IS NULL AND `reps_max` IS NULL AND `to_failure` = 0 AND `intensity_technique` IS NULL)),
  CONSTRAINT `gym_workout_plan_sets_working_target` CHECK (`kind` = 'warmup' OR (`to_failure` = 1 AND `reps_max` IS NULL) OR (`to_failure` = 0 AND `reps_min` IS NOT NULL AND `reps_max` IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE `gym_workout_exercises`
  ALTER COLUMN `sets` SET DEFAULT 0,
  ALTER COLUMN `reps` SET DEFAULT '';

DROP TEMPORARY TABLE IF EXISTS `tmp_reps_numbers`;
DROP TEMPORARY TABLE IF EXISTS `tmp_reps_parts`;
DROP TEMPORARY TABLE IF EXISTS `tmp_exercises_to_convert`;
DROP TEMPORARY TABLE IF EXISTS `tmp_set_numbers`;

CREATE TEMPORARY TABLE `tmp_set_numbers` (`set_number` INT NOT NULL PRIMARY KEY);
INSERT INTO `tmp_set_numbers` (`set_number`)
WITH RECURSIVE `numbers` (`n`) AS (SELECT 1 UNION ALL SELECT `n` + 1 FROM `numbers` WHERE `n` < 20)
SELECT `n` FROM `numbers`;

CREATE TEMPORARY TABLE `tmp_exercises_to_convert` (
  `workout_exercise_id` INT NOT NULL PRIMARY KEY,
  `working_sets` INT NOT NULL,
  `warmup_sets` INT NOT NULL,
  `reps_original` VARCHAR(255) NOT NULL,
  `reps_text` VARCHAR(255) NOT NULL,
  `technique` VARCHAR(100) NULL,
  `part_count` INT NOT NULL DEFAULT 0,
  `has_plus` TINYINT NOT NULL DEFAULT 0,
  `reps_format` ENUM('max','list','free') NULL,
  `free_text_reps` INT NULL
);

CREATE TEMPORARY TABLE `tmp_reps_parts` (
  `workout_exercise_id` INT NOT NULL,
  `part_number` INT NOT NULL,
  `part_text` VARCHAR(255) NOT NULL,
  `is_valid` TINYINT NOT NULL DEFAULT 0,
  `has_plus` TINYINT NOT NULL DEFAULT 0,
  `reps_min` DECIMAL(20,0) NULL,
  `reps_max` DECIMAL(20,0) NULL,
  PRIMARY KEY (`workout_exercise_id`, `part_number`)
);

CREATE TEMPORARY TABLE `tmp_reps_numbers` (
  `workout_exercise_id` INT NOT NULL,
  `found_number` DOUBLE NOT NULL
);

START TRANSACTION;

-- `reps_original` è il testo com'era (per `notes`), `reps_text` quello con i caratteri di controllo
-- trasformati in spazi (per ricavare i target)
INSERT INTO `tmp_exercises_to_convert`
  (`workout_exercise_id`, `working_sets`, `warmup_sets`, `reps_original`, `reps_text`, `technique`)
SELECT we.`id`, GREATEST(LEAST(we.`sets`, 20), 1), LEAST(we.`warmup_sets`, 10),
       TRIM(we.`reps`),
       TRIM(REGEXP_REPLACE(we.`reps`, '[[:cntrl:]]', ' ')),
       CASE WHEN NULLIF(TRIM(we.`intensity_technique`), '') = 'Nessuna (Normale)' THEN NULL
            ELSE NULLIF(TRIM(we.`intensity_technique`), '') END
FROM `gym_workout_exercises` we
WHERE NOT EXISTS (SELECT 1 FROM `gym_workout_plan_sets` ps WHERE ps.`workout_exercise_id` = we.`id`);

-- Le parti di `reps` separate da "/", una per riga, con spazi attorno a "-" e "+" tolti
INSERT INTO `tmp_reps_parts` (`workout_exercise_id`, `part_number`, `part_text`)
SELECT t.`workout_exercise_id`, jp.`part_number`, REGEXP_REPLACE(TRIM(jp.`part_text`), '[[:space:]]*([-+])[[:space:]]*', '$1')
FROM `tmp_exercises_to_convert` t,
     JSON_TABLE(
       CONCAT('["', REPLACE(REPLACE(REPLACE(t.`reps_text`, '\\', '\\\\'), '"', '\\"'), '/', '","'), '"]'),
       '$[*]' COLUMNS (`part_number` FOR ORDINALITY, `part_text` VARCHAR(255) PATH '$')
     ) AS jp;

-- Una parte è usabile se è un numero o un intervallo, seguito da zero o più "+numero": il target è
-- quello davanti al primo "+"
UPDATE `tmp_reps_parts`
SET `is_valid` = `part_text` REGEXP '^[0-9]+(-[0-9]+)?(\\+[0-9]+(-[0-9]+)?)*$',
    `has_plus` = `part_text` LIKE '%+%';

UPDATE `tmp_reps_parts`
SET `reps_min` = CAST(REGEXP_SUBSTR(`part_text`, '^[0-9]+') AS DECIMAL(20,0)),
    `reps_max` = CAST(REGEXP_SUBSTR(REGEXP_SUBSTR(`part_text`, '^[0-9]+(-[0-9]+)?'), '[0-9]+$') AS DECIMAL(20,0))
WHERE `is_valid` = 1;

UPDATE `tmp_reps_parts` SET `is_valid` = 0
WHERE `is_valid` = 1 AND NOT (`reps_min` BETWEEN 1 AND 250 AND `reps_max` BETWEEN `reps_min` AND 250);

UPDATE `tmp_exercises_to_convert` t
LEFT JOIN (SELECT `workout_exercise_id`, COUNT(*) AS `parts`, SUM(`is_valid` = 0) AS `invalid_parts`, SUM(`has_plus`) AS `plus_parts`
           FROM `tmp_reps_parts` GROUP BY `workout_exercise_id`) a ON a.`workout_exercise_id` = t.`workout_exercise_id`
SET t.`part_count` = COALESCE(a.`parts`, 0),
    t.`reps_format` = CASE WHEN LOWER(t.`reps_text`) = 'max' THEN 'max'
                           WHEN a.`parts` IS NOT NULL AND a.`invalid_parts` = 0 THEN 'list'
                           ELSE 'free' END,
    t.`has_plus` = IF(a.`parts` IS NOT NULL AND a.`invalid_parts` = 0 AND a.`plus_parts` > 0, 1, 0);

-- Regola per il testo libero (l'unico punto): il numero più grande del testo, portato dentro 1..250;
-- nessun numero: a cedimento (free_text_reps resta NULL). I non-cifre diventano virgole e gli zeri
-- iniziali si tolgono ("08" non è JSON valido), poi JSON_TABLE elenca i numeri (DOUBLE: con DECIMAL i
-- valori oltre 2^64 vanno in overflow e diventano negativi).
INSERT INTO `tmp_reps_numbers` (`workout_exercise_id`, `found_number`)
SELECT t.`workout_exercise_id`, j.`found_number`
FROM `tmp_exercises_to_convert` t,
     JSON_TABLE(
         CONCAT('[', TRIM(BOTH ',' FROM REGEXP_REPLACE(REGEXP_REPLACE(t.`reps_text`, '[^0-9]+', ','), '(^|,)0+([0-9])', '$1$2')), ']'),
         '$[*]' COLUMNS (`found_number` DOUBLE PATH '$')
     ) AS j
WHERE t.`reps_format` = 'free';

UPDATE `tmp_exercises_to_convert` t
JOIN (SELECT `workout_exercise_id`, MAX(`found_number`) AS `largest` FROM `tmp_reps_numbers` GROUP BY `workout_exercise_id`) x
  ON x.`workout_exercise_id` = t.`workout_exercise_id`
SET t.`free_text_reps` = LEAST(GREATEST(x.`largest`, 1), 250);

INSERT INTO `gym_workout_plan_sets` (`workout_exercise_id`, `set_number`, `kind`)
SELECT t.`workout_exercise_id`, s.`set_number`, 'warmup'
FROM `tmp_exercises_to_convert` t JOIN `tmp_set_numbers` s ON s.`set_number` <= t.`warmup_sets`;

INSERT INTO `gym_workout_plan_sets`
  (`workout_exercise_id`, `set_number`, `kind`, `reps_min`, `reps_max`, `to_failure`, `intensity_technique`)
SELECT t.`workout_exercise_id`, t.`warmup_sets` + s.`set_number`, 'working',
       CASE t.`reps_format` WHEN 'list' THEN p.`reps_min` WHEN 'free' THEN t.`free_text_reps` END,
       CASE t.`reps_format` WHEN 'list' THEN p.`reps_max` WHEN 'free' THEN t.`free_text_reps` END,
       IF(t.`reps_format` = 'max' OR (t.`reps_format` = 'free' AND t.`free_text_reps` IS NULL), 1, 0),
       CASE WHEN s.`set_number` = t.`working_sets` AND t.`technique` IS NOT NULL THEN t.`technique`
            WHEN t.`reps_format` = 'list' AND s.`set_number` <= t.`part_count` AND p.`has_plus` = 1 THEN 'Drop Set (Stripping)'
            END
FROM `tmp_exercises_to_convert` t
JOIN `tmp_set_numbers` s ON s.`set_number` <= t.`working_sets`
LEFT JOIN `tmp_reps_parts` p ON p.`workout_exercise_id` = t.`workout_exercise_id` AND p.`part_number` = LEAST(s.`set_number`, t.`part_count`);

UPDATE `gym_workout_exercises` we
JOIN `tmp_exercises_to_convert` t ON t.`workout_exercise_id` = we.`id`
SET we.`updated_at` = we.`updated_at`,
    we.`notes` = CONCAT(IF(we.`notes` IS NULL OR we.`notes` = '', '', CONCAT(we.`notes`, CHAR(10))),
                        'Ripetizioni nella scheda precedente: ', t.`reps_original`)
WHERE t.`reps_format` = 'free' OR t.`has_plus` = 1;

COMMIT;

DROP TEMPORARY TABLE IF EXISTS `tmp_reps_numbers`;
DROP TEMPORARY TABLE IF EXISTS `tmp_reps_parts`;
DROP TEMPORARY TABLE IF EXISTS `tmp_exercises_to_convert`;
DROP TEMPORARY TABLE IF EXISTS `tmp_set_numbers`;
