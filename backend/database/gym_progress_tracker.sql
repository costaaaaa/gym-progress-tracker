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
  `password_legacy` tinyint(1) NOT NULL DEFAULT 0,
  `age` int(11) DEFAULT NULL,
  `gender` enum('M','F','O') DEFAULT NULL,
  `training_start_date` DATE DEFAULT NULL,
  `experience_years` float DEFAULT '0',
  `rest_timer_enabled` tinyint(1) NOT NULL DEFAULT 1,
  `is_admin` tinyint(1) NOT NULL DEFAULT 0,
  `password_changed_at` datetime DEFAULT NULL,
  `last_login_at` datetime DEFAULT NULL,
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
  `name_en` varchar(100) DEFAULT NULL,
  `muscle_group` varchar(50) NOT NULL,
  `equipment` varchar(30) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `status` enum('pending','approved','rejected') NOT NULL DEFAULT 'approved',
  `reviewed_at` datetime DEFAULT NULL,
  `merged_into` int(11) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_status` (`status`),
  KEY `idx_created_by` (`created_by`),
  KEY `idx_merged_into` (`merged_into`),
  CONSTRAINT `fk_exercises_creator` FOREIGN KEY (`created_by`) REFERENCES `gym_users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_exercises_merged` FOREIGN KEY (`merged_into`) REFERENCES `gym_exercises` (`id`) ON DELETE SET NULL
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
  -- Campi arrivati da Apple Salute / Health Connect (migrazione 14)
  `health_fields` set('weight','body_fat_percentage','waist_size') NOT NULL DEFAULT '',
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
  `duration_seconds` int unsigned DEFAULT NULL,
  `notes` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `idx_user_date` (`user_id`, `date`),
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

-- Token Bearer per client mobile (React Native), autenticazione additiva rispetto alla sessione web
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

-- Token per il recupero password (salvato solo l'hash SHA-256, monouso, scadenza breve)
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

-- Insert default exercises
INSERT INTO `gym_exercises` (`name`, `name_en`, `muscle_group`, `equipment`) VALUES
('Panca Piana (Bilanciere)', 'Barbell Bench Press', 'petto', 'bilanciere'),
('Panca Piana (Manubri)', 'Dumbbell Bench Press', 'petto', 'manubri'),
('Panca Inclinata (Bilanciere)', 'Incline Barbell Bench Press', 'petto', 'bilanciere'),
('Panca Inclinata (Manubri)', 'Incline Dumbbell Bench Press', 'petto', 'manubri'),
('Panca Inclinata (Multipower)', 'Incline Smith Machine Bench Press', 'petto', 'multipower'),
('Panca Declinata (Bilanciere)', 'Decline Barbell Bench Press', 'petto', 'bilanciere'),
('Panca Declinata (Manubri)', 'Decline Dumbbell Bench Press', 'petto', 'manubri'),
('Chest Press', 'Machine Chest Press', 'petto', 'macchina'),
('Chest Fly (Macchina)', 'Pec Deck Fly', 'petto', 'macchina'),
('Croci Panca Piana (Manubri)', 'Dumbbell Fly', 'petto', 'manubri'),
('Croci Panca Inclinata (Manubri)', 'Incline Dumbbell Fly', 'petto', 'manubri'),
('Croci ai Cavi', 'Cable Crossover', 'petto', 'cavi'),
('Croci Panca Piana (Cavi)', 'Flat Bench Cable Fly', 'petto', 'cavi'),
('Croci Panca Inclinata (Cavi)', 'Incline Cable Fly', 'petto', 'cavi'),
('Croci ai Cavi Alti a 90', 'High Cable Fly', 'petto', 'cavi'),
('Flessioni', 'Push-up', 'petto', 'corpo_libero'),
('Pullover (Manubrio)', 'Dumbbell Pullover', 'petto', 'manubri'),
('Trazioni', 'Pull-up', 'schiena', 'corpo_libero'),
('Lat Machine', 'Lat Pulldown', 'schiena', 'macchina'),
('Lat Machine Divergente', 'Diverging Lat Pulldown', 'schiena', 'macchina'),
('Trazy Bar', 'Neutral-Grip Lat Pulldown', 'schiena', 'macchina'),
('Pull Down', 'Straight-Arm Pulldown', 'schiena', 'cavi'),
('Pulley', 'Seated Cable Row', 'schiena', 'cavi'),
('Pulley Alto', 'High Cable Row', 'schiena', 'cavi'),
('Pulley Braccio Singolo', 'Single-Arm Cable Row', 'schiena', 'cavi'),
('Rowing', 'Machine Row', 'schiena', 'macchina'),
('Rowing Braccio Singolo', 'Single-Arm Machine Row', 'schiena', 'macchina'),
('Rematore (Bilanciere)', 'Barbell Bent-Over Row', 'schiena', 'bilanciere'),
('Rematore Presa Inversa (Bilanciere)', 'Reverse-Grip Barbell Row', 'schiena', 'bilanciere'),
('Rematore (Manubrio)', 'One-Arm Dumbbell Row', 'schiena', 'manubri'),
('Rematore (Multipower)', 'Smith Machine Row', 'schiena', 'multipower'),
('Rematore Presa Inversa (Multipower)', 'Reverse-Grip Smith Machine Row', 'schiena', 'multipower'),
('T. Bar (Bilanciere)', 'T-Bar Row', 'schiena', 'bilanciere'),
('T. Bar (Macchina)', 'Machine T-Bar Row', 'schiena', 'macchina'),
('Face Pull', 'Face Pull', 'schiena', 'cavi'),
('Scrollate (Bilanciere)', 'Barbell Shrug', 'schiena', 'bilanciere'),
('Scrollate (Manubri)', 'Dumbbell Shrug', 'schiena', 'manubri'),
('Lento Avanti (Bilanciere)', 'Barbell Overhead Press', 'spalle', 'bilanciere'),
('Lento Avanti (Manubri)', 'Dumbbell Shoulder Press', 'spalle', 'manubri'),
('Shoulder Press (Macchina)', 'Machine Shoulder Press', 'spalle', 'macchina'),
('Lento Dietro', 'Behind-the-Neck Press', 'spalle', 'bilanciere'),
('Arnold Press', 'Arnold Press', 'spalle', 'manubri'),
('Alzate Laterali', 'Dumbbell Lateral Raise', 'spalle', 'manubri'),
('Alzate Frontali (Bilanciere)', 'Barbell Front Raise', 'spalle', 'bilanciere'),
('Alzate Frontali (Manubri)', 'Dumbbell Front Raise', 'spalle', 'manubri'),
('Alzate Posteriori (Manubri)', 'Bent-Over Dumbbell Rear Delt Raise', 'spalle', 'manubri'),
('Alzate Posteriori (Cavi)', 'Cable Rear Delt Fly', 'spalle', 'cavi'),
('Rowing Gomiti Alti (Macchina)', 'Machine Upright Row', 'spalle', 'macchina'),
('Rowing Gomiti Alti (Manubri)', 'Dumbbell Upright Row', 'spalle', 'manubri'),
('Rowing Gomiti Alti (Cavi)', 'Cable Upright Row', 'spalle', 'cavi'),
('Curl (Bilanciere)', 'Barbell Curl', 'bicipiti', 'bilanciere'),
('Curl (Bilanciere EZ)', 'EZ-Bar Curl', 'bicipiti', 'bilanciere'),
('Curl (Manubri)', 'Dumbbell Curl', 'bicipiti', 'manubri'),
('Curl Alternato (Manubri)', 'Alternating Dumbbell Curl', 'bicipiti', 'manubri'),
('Curl a Martello', 'Hammer Curl', 'bicipiti', 'manubri'),
('Curl Concentrato', 'Concentration Curl', 'bicipiti', 'manubri'),
('Curl Panca 45 (Manubri)', 'Incline Dumbbell Curl', 'bicipiti', 'manubri'),
('Curl Cavo Basso', 'Low Cable Curl', 'bicipiti', 'cavi'),
('Curl Cavo Alto', 'High Cable Curl', 'bicipiti', 'cavi'),
('Panca Scott (Bilanciere EZ)', 'EZ-Bar Preacher Curl', 'bicipiti', 'bilanciere'),
('Panca Scott (Manubri)', 'Dumbbell Preacher Curl', 'bicipiti', 'manubri'),
('Panca Scott (Macchina)', 'Machine Preacher Curl', 'bicipiti', 'macchina'),
('Drag Curl', 'Drag Curl', 'bicipiti', 'bilanciere'),
('Zottman Curl', 'Zottman Curl', 'bicipiti', 'manubri'),
('French Press (Manubrio)', 'Overhead Dumbbell Triceps Extension', 'tricipiti', 'manubri'),
('French Press (Manubri)', 'Lying Dumbbell Triceps Extension', 'tricipiti', 'manubri'),
('French Press Panca Piana (Bilanciere)', 'Lying Barbell Triceps Extension', 'tricipiti', 'bilanciere'),
('French Press Panca Inclinata (Bilanciere)', 'Incline Barbell Triceps Extension', 'tricipiti', 'bilanciere'),
('Overhead Extension (Cavi)', 'Cable Overhead Triceps Extension', 'tricipiti', 'cavi'),
('Push Down Corda', 'Rope Pushdown', 'tricipiti', 'cavi'),
('Push Down Sbarra', 'Bar Pushdown', 'tricipiti', 'cavi'),
('Push Down Presa Inversa', 'Reverse-Grip Pushdown', 'tricipiti', 'cavi'),
('Kick Back', 'Triceps Kickback', 'tricipiti', 'manubri'),
('Panca Piana Presa Stretta (Bilanciere)', 'Close-Grip Bench Press', 'tricipiti', 'bilanciere'),
('Dips', 'Dips', 'tricipiti', 'corpo_libero'),
('Dip alla Panca', 'Bench Dip', 'tricipiti', 'corpo_libero'),
('Squat (Bilanciere)', 'Barbell Back Squat', 'gambe', 'bilanciere'),
('Box Squat', 'Box Squat', 'gambe', 'bilanciere'),
('Goblet Squat', 'Goblet Squat', 'gambe', 'manubri'),
('Sumo Squat', 'Dumbbell Sumo Squat', 'gambe', 'manubri'),
('Bulgarian Split Squat', 'Bulgarian Split Squat', 'gambe', 'manubri'),
('Affondi', 'Dumbbell Lunge', 'gambe', 'manubri'),
('Hack Squat 45', 'Hack Squat', 'gambe', 'macchina'),
('Leg Press 45', '45-Degree Leg Press', 'gambe', 'macchina'),
('Pendulum Squat', 'Pendulum Squat', 'gambe', 'macchina'),
('Adductor Machine', 'Hip Adduction Machine', 'gambe', 'macchina'),
('Stacco da Terra (Bilanciere)', 'Barbell Deadlift', 'gambe', 'bilanciere'),
('Stacco da Terra (Manubri)', 'Dumbbell Deadlift', 'gambe', 'manubri'),
('Leg Extension', 'Leg Extension', 'quadricipiti', 'macchina'),
('Leg Extension Gamba Singola', 'Single-Leg Extension', 'quadricipiti', 'macchina'),
('Sissy Squat', 'Sissy Squat', 'quadricipiti', 'corpo_libero'),
('Leg Curl Sdraiato', 'Lying Leg Curl', 'femorali', 'macchina'),
('Leg Curl Seduto', 'Seated Leg Curl', 'femorali', 'macchina'),
('Leg Curl In Piedi', 'Standing Leg Curl', 'femorali', 'macchina'),
('Nordic Curl', 'Nordic Hamstring Curl', 'femorali', 'corpo_libero'),
('Stacco Rumeno', 'Romanian Deadlift', 'femorali', 'bilanciere'),
('Good Morning', 'Good Morning', 'femorali', 'bilanciere'),
('Iperextension', 'Hyperextension', 'femorali', 'macchina'),
('Hip Thrust (Bilanciere)', 'Barbell Hip Thrust', 'glutei', 'bilanciere'),
('Hip Thrust (Macchina)', 'Machine Hip Thrust', 'glutei', 'macchina'),
('Glute Bridge', 'Glute Bridge', 'glutei', 'corpo_libero'),
('Glute Kickback (Macchina)', 'Machine Glute Kickback', 'glutei', 'macchina'),
('Glute Kickback (Cavi)', 'Cable Glute Kickback', 'glutei', 'cavi'),
('Cable Pull Through', 'Cable Pull-Through', 'glutei', 'cavi'),
('Abductor Machine', 'Hip Abduction Machine', 'glutei', 'macchina'),
('Calf in Piedi', 'Standing Calf Raise', 'polpacci', 'macchina'),
('Calf Seduto', 'Seated Calf Raise', 'polpacci', 'macchina'),
('Calf alla Leg Press', 'Leg Press Calf Raise', 'polpacci', 'macchina'),
('Calf (Manubrio)', 'Dumbbell Calf Raise', 'polpacci', 'manubri'),
('Calf su Gradino', 'Step Calf Raise', 'polpacci', 'corpo_libero'),
('Donkey Calf Raise', 'Donkey Calf Raise', 'polpacci', 'macchina'),
('Crunch', 'Crunch', 'addominali', 'corpo_libero'),
('Crunch Cavo Alto', 'Cable Crunch', 'addominali', 'cavi'),
('Crunch Inverso Sdraiato', 'Lying Reverse Crunch', 'addominali', 'corpo_libero'),
('Crunch Inverso Parallele', 'Vertical Knee Raise', 'addominali', 'corpo_libero'),
('Bicycle Crunch', 'Bicycle Crunch', 'addominali', 'corpo_libero'),
('Sit-up', 'Sit-up', 'addominali', 'corpo_libero'),
('Leg Raise', 'Lying Leg Raise', 'addominali', 'corpo_libero'),
('Hanging Leg Raise', 'Hanging Leg Raise', 'addominali', 'corpo_libero'),
('Dragon Flag', 'Dragon Flag', 'addominali', 'corpo_libero'),
('Ab Wheel', 'Ab Wheel Rollout', 'addominali', 'corpo_libero'),
('Russian Twist', 'Russian Twist', 'addominali', 'corpo_libero'),
('Mountain Climber', 'Mountain Climber', 'addominali', 'corpo_libero'),
('Plank', 'Plank', 'addominali', 'corpo_libero'),
('Side Plank', 'Side Plank', 'addominali', 'corpo_libero');

-- Consents table (termini, dati sulla salute, ...)
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

-- Gruppi (amici, palestra) con codice invito e classifica settimanale
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
