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
-- 1. Tabella gym_users: Profilo fisico, recupero muscolare e preferenze
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
-- 2. Tabella gym_workout_exercises: Note e Tecniche di Intensità
-- ------------------------------------------------------------------------------

-- Campo note personalizzate per esercizio nella scheda
ALTER TABLE `gym_workout_exercises`
  ADD COLUMN `notes` TEXT DEFAULT NULL AFTER `rest`;

-- Tecnica di intensità (es. Drop set, Rest-pause, Super set)
ALTER TABLE `gym_workout_exercises`
  ADD COLUMN `intensity_technique` VARCHAR(100) DEFAULT NULL AFTER `notes`;


-- ------------------------------------------------------------------------------
-- 3. Tabella gym_workout_sets: Tecniche di Intensità per serie registrata
-- ------------------------------------------------------------------------------

ALTER TABLE `gym_workout_sets`
  ADD COLUMN `intensity_technique` VARCHAR(100) DEFAULT NULL AFTER `reps`;


-- ------------------------------------------------------------------------------
-- 4. Tabella gym_user_gamification: Estensione XP, Livelli e Tonnellaggio
-- ------------------------------------------------------------------------------

ALTER TABLE `gym_user_gamification`
  ADD COLUMN `total_xp` INT NOT NULL DEFAULT 0 AFTER `last_completed_week`,
  ADD COLUMN `level` INT NOT NULL DEFAULT 1 AFTER `total_xp`,
  ADD COLUMN `lifetime_volume_kg` DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER `level`;
