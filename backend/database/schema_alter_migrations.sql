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
