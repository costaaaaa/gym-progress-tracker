-- Gym Progress Tracker - Unified Database Schema
-- Generated: 2026-04-25

-- Database creation
CREATE DATABASE IF NOT EXISTS `gym_progress_tracker`;
USE `gym_progress_tracker`;

-- Users table
CREATE TABLE IF NOT EXISTS `gym_users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `email` varchar(100) NOT NULL,
  `birth_date` DATE DEFAULT NULL,
  `password` varchar(255) NOT NULL,
  `age` int(11) DEFAULT NULL,
  `gender` enum('M','F') DEFAULT 'M',
  `training_start_date` DATE DEFAULT NULL,
  `experience_years` float DEFAULT '0',
  `rest_timer_enabled` tinyint(1) NOT NULL DEFAULT 1,
  `password_changed_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Workout plans table
CREATE TABLE IF NOT EXISTS `gym_workout_plans` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `gym_workout_plans_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `gym_users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Workout days table
CREATE TABLE IF NOT EXISTS `gym_workout_days` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `plan_id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `day_order` int(11) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `plan_id` (`plan_id`),
  CONSTRAINT `gym_workout_days_ibfk_1` FOREIGN KEY (`plan_id`) REFERENCES `gym_workout_plans` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Exercises table
CREATE TABLE IF NOT EXISTS `gym_exercises` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `muscle_group` varchar(50) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Workout exercises table (junction table between workout_days and exercises)
CREATE TABLE IF NOT EXISTS `gym_workout_exercises` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `day_id` int(11) NOT NULL,
  `exercise_id` int(11) NOT NULL,
  `sets` int(11) NOT NULL,
  `reps` varchar(20) NOT NULL,
  `rest` int(11) NOT NULL,
  `intensity_technique` varchar(100) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `day_id` (`day_id`),
  KEY `exercise_id` (`exercise_id`),
  CONSTRAINT `gym_workout_exercises_ibfk_1` FOREIGN KEY (`day_id`) REFERENCES `gym_workout_days` (`id`) ON DELETE CASCADE,
  CONSTRAINT `gym_workout_exercises_ibfk_2` FOREIGN KEY (`exercise_id`) REFERENCES `gym_exercises` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Progress tracking table
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

-- User body stats table
CREATE TABLE IF NOT EXISTS `gym_user_stats` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `date` date NOT NULL,
  `weight` decimal(5,2) DEFAULT NULL,
  `body_fat_percentage` decimal(5,2) DEFAULT NULL,
  `muscle_mass_percentage` decimal(5,2) DEFAULT NULL,
  `chest_size` decimal(5,2) DEFAULT NULL,
  `arm_size` decimal(5,2) DEFAULT NULL,
  `waist_size` decimal(5,2) DEFAULT NULL,
  `leg_size` decimal(5,2) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_date` (`user_id`, `date`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `gym_user_stats_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `gym_users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Workout history table
CREATE TABLE IF NOT EXISTS `gym_workout_history` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `exercises` text NOT NULL, -- Keep for compatibility with legacy code
  `date` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `notes` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `gym_workout_history_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `gym_users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Workout sets table
CREATE TABLE IF NOT EXISTS `gym_workout_sets` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `workout_history_id` int(11) NOT NULL,
  `exercise_id` int(11) NOT NULL,
  `set_number` int(11) NOT NULL,
  `weight` decimal(5,2) NOT NULL,
  `reps` varchar(50) NOT NULL,
  `intensity_technique` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `workout_history_id` (`workout_history_id`),
  KEY `exercise_id` (`exercise_id`),
  CONSTRAINT `gym_workout_sets_ibfk_1` FOREIGN KEY (`workout_history_id`) REFERENCES `gym_workout_history` (`id`) ON DELETE CASCADE,
  CONSTRAINT `gym_workout_sets_ibfk_2` FOREIGN KEY (`exercise_id`) REFERENCES `gym_exercises` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Gamification: streak, XP, livelli e tonnellaggio (one row per user)
CREATE TABLE IF NOT EXISTS `gym_user_gamification` (
  `user_id`               INT           NOT NULL,
  `current_streak_weeks`  INT           NOT NULL DEFAULT 0,
  `longest_streak_weeks`  INT           NOT NULL DEFAULT 0,
  `last_completed_week`   INT           NULL     DEFAULT NULL,
  `total_xp`              INT           NOT NULL DEFAULT 0,
  `level`                 INT           NOT NULL DEFAULT 1,
  `lifetime_volume_kg`    DECIMAL(12,2) NOT NULL DEFAULT 0,
  `updated_at`            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`),
  CONSTRAINT `fk_gamification_user`
    FOREIGN KEY (`user_id`) REFERENCES `gym_users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Gamification: progressione XP per esercizio (one row per user+exercise)
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

-- Gamification: achievement sbloccati (UNIQUE garantisce no-doppio)
CREATE TABLE IF NOT EXISTS `gym_achievements` (
  `id`              INT          NOT NULL AUTO_INCREMENT,
  `user_id`         INT          NOT NULL,
  `achievement_key` VARCHAR(50)  NOT NULL,
  `unlocked_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_achievement` (`user_id`, `achievement_key`),
  CONSTRAINT `fk_ach_user` FOREIGN KEY (`user_id`) REFERENCES `gym_users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Rate limiting per gli endpoint di autenticazione (login/register)
CREATE TABLE IF NOT EXISTS `gym_rate_limits` (
  `rate_key` varchar(191) NOT NULL,
  `attempts` int(10) unsigned NOT NULL DEFAULT 0,
  `expires_at` datetime NOT NULL,
  PRIMARY KEY (`rate_key`),
  KEY `idx_expires_at` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Insert default exercises
INSERT INTO `gym_exercises` (`name`, `muscle_group`) VALUES
('Panca Piana', 'petto'),
('Panca Piana Manubri', 'petto'),
('Panca Inclinata', 'petto'),
('Panca Inclinata Manubri', 'petto'),
('Panca Inclinata Al MultiPower', 'petto'),
('Panca Declinata', 'petto'),
('Panca Declinata Manubri', 'petto'),
('Chest Press', 'petto'),
('Croci ai Cavi', 'petto'),
('Croci Panca Piana Manubri', 'petto'),
('Croci Panca Piana Cavi', 'petto'),
('Croci Panca Inclinata Manubri', 'petto'),
('Croci Panca Inclinata Cavi', 'petto'),
('Croci ai cavi alti a 90', 'petto'),
('Cable Crossover', 'petto'),
('Chest Fly Macchina', 'petto'),
('Pullover con Manubrio', 'petto'),
('Flessioni', 'petto'),
('Trazioni', 'schiena'),
('Rowing', 'schiena'),
('Rowing braccio singolo', 'schiena'),
('Pulley', 'schiena'),
('Pulley braccio singolo', 'schiena'),
('Pulley Alto', 'schiena'),
('Rematore Manubrio', 'schiena'),
('Pull Down', 'schiena'),
('Lat Machine', 'schiena'),
('Lat Machine Divergente', 'schiena'),
('Trazy Bar', 'schiena'),
('T. Bar', 'schiena'),
('Rematore Bilanciere', 'schiena'),
('Rematore Multipower', 'schiena'),
('Rematore Bilanciere Presa Inversa', 'schiena'),
('Rematore Multipower Presa Inversa', 'schiena'),
('Seated Row', 'schiena'),
('Face Pull', 'schiena'),
('Shrug con Bilanciere', 'schiena'),
('Shrug con Manubri', 'schiena'),
('Military Press', 'spalle'),
('Lento Avanti', 'spalle'),
('Lento Dietro', 'spalle'),
('Shoulder Press', 'spalle'),
('Arnold Press', 'spalle'),
('Alzate Laterali', 'spalle'),
('Alzate Frontali Bilanciere', 'spalle'),
('Alzate Frontali Manubri', 'spalle'),
('Alzate A 90', 'spalle'),
('Alzate Posteriori', 'spalle'),
('Alzate Posteriori ai Cavi', 'spalle'),
('Rowing Gomiti Alti', 'spalle'),
('Scrollate', 'spalle'),
('Curl con Bilanciere', 'bicipiti'),
('Curl con Bilanciere EZ', 'bicipiti'),
('Curl con Manubri', 'bicipiti'),
('Curl con Manubri Alternato', 'bicipiti'),
('Curl Concentrato', 'bicipiti'),
('Curl Cavo Basso', 'bicipiti'),
('Curl Cavo Alto', 'bicipiti'),
('Curl a Martello', 'bicipiti'),
('Curl Inclinato Manubri', 'bicipiti'),
('Drag Curl', 'bicipiti'),
('Zottman Curl', 'bicipiti'),
('Panca Scott', 'bicipiti'),
('Curl Panca 45 Manubri', 'bicipiti'),
('Push Down Corda', 'tricipiti'),
('Push Down Sbarra', 'tricipiti'),
('Push Down Presa Inversa', 'tricipiti'),
('French Press Manubrio', 'tricipiti'),
('French Press Manubri', 'tricipiti'),
('French Press Bilanciere Panca Inclinata', 'tricipiti'),
('French Press Bilanciere Panca Piana', 'tricipiti'),
('French Press Panca Inclinata', 'tricipiti'),
('Skull Crusher', 'tricipiti'),
('Overhead Tricep Extension Cavo', 'tricipiti'),
('Overhead Extension Manubrio', 'tricipiti'),
('Kick Back', 'tricipiti'),
('Dips', 'tricipiti'),
('Tricep Dip alla Panca', 'tricipiti'),
('Panca Piana Presa Stretta', 'tricipiti'),
('Squat', 'gambe'),
('Box Squat', 'gambe'),
('Sumo Squat', 'gambe'),
('Goblet Squat', 'gambe'),
('Leg Press 45', 'gambe'),
('Hack Squat 45', 'gambe'),
('Pendulum Squat', 'gambe'),
('Affondi', 'gambe'),
('Bulgarian Split Squat', 'gambe'),
('Stacco da Terra', 'gambe'),
('Stacco da Terra Manubri', 'gambe'),
('Adductor Machine', 'gambe'),
('Leg Extension', 'quadricipiti'),
('Leg Extension gamba singola', 'quadricipiti'),
('Sissy Squat', 'quadricipiti'),
('Leg Curl', 'femorali'),
('Leg Curl In Piedi', 'femorali'),
('Leg Curl Sdraiato', 'femorali'),
('Leg Curl Seduto', 'femorali'),
('Nordic Curl', 'femorali'),
('Iperextension', 'femorali'),
('Stacco Rumeno', 'femorali'),
('Good Morning', 'femorali'),
('Hip Thrust', 'glutei'),
('Hip Thrust con Bilanciere', 'glutei'),
('Glute Bridge', 'glutei'),
('Glute Kickback', 'glutei'),
('Glute Kickback ai Cavi', 'glutei'),
('Abductor Machine', 'glutei'),
('Cable Pull Through', 'glutei'),
('Calf In Piedi', 'polpacci'),
('Calf Seduto', 'polpacci'),
('Calf Con Manubrio', 'polpacci'),
('Calf alla Leg Press', 'polpacci'),
('Calf su Gradino', 'polpacci'),
('Donkey Calf Raise', 'polpacci'),
('Crunch', 'addominali'),
('Crunch Inverso Parallele', 'addominali'),
('Crunch Inverso Sdraiato', 'addominali'),
('Bicycle Crunch', 'addominali'),
('Crunch Cavo Alto', 'addominali'),
('Plank', 'addominali'),
('Side Plank', 'addominali'),
('Sit-up', 'addominali'),
('Russian Twist', 'addominali'),
('Leg Raise', 'addominali'),
('Hanging Leg Raise', 'addominali'),
('Ab Wheel', 'addominali'),
('Mountain Climber', 'addominali'),
('Dragon Flag', 'addominali');
