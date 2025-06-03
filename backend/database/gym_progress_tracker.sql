-- Database creation
CREATE DATABASE IF NOT EXISTS `gym_progress_tracker`;
USE `gym_progress_tracker`;

-- Users table
CREATE TABLE IF NOT EXISTS `gym_users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `email` varchar(100) NOT NULL,
  `password` varchar(255) NOT NULL,
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

-- Insert default exercises
INSERT INTO `gym_exercises` (`name`, `muscle_group`) VALUES
('Panca Piana', 'petto'),
('Panca Piana Manubri', 'petto'),
('Panca Inclinata', 'petto'),
('Panca Inclinata Al MultiPower', 'petto'),
('Chest Press', 'petto'),
('Croci ai Cavi', 'petto'),
('Croci panca piana', 'petto'),
('Flessioni', 'petto'),
('Trazioni', 'schiena'),
('Rowing', 'schiena'),
('Pulley', 'schiena'),
('Pulley Alto', 'schiena'),
('Rematore Manubrio', 'schiena'),
('Pull Down', 'schiena'),
('Lat Machine', 'schiena'),
('Trazy Bar', 'schiena'),
('T. Bar', 'schiena'),
('Rematore Bilanciere', 'schiena'),
('Rematore Bilanciere Presa Inversa', 'schiena'),
('Lat Machine Divergente', 'schiena'),
('Military Press', 'spalle'),
('Lento Avanti', 'spalle'),
('Shoulder Press', 'spalle'),
('Alzate Laterali', 'spalle'),
('Alzate Frontali Bilanciere', 'spalle'),
('Alzate Frontali Manubri', 'spalle'),
('Alzate A 90', 'spalle'),
('Rowing Gomiti Alti', 'spalle'),
('Curl con Bilanciere', 'bicipiti'),
('Curl con Manubri', 'bicipiti'),
('Curl con Manubri Alternato', 'bicipiti'),
('Curl Concentrato', 'bicipiti'),
('Curl Cavo Basso', 'bicipiti'),
('Curl a Martello', 'bicipiti'),
('Panca Scott', 'bicipiti'),
('Curl Panca 45 Manubri', 'bicipiti'),
('Push Down Corda', 'tricipiti'),
('Push Down Sbarra', 'tricipiti'),
('French Press Manubrio', 'tricipiti'),
('Kick Back', 'tricipiti'),
('French Press Manubri', 'tricipiti'),
('French Press Bilanciere Panca Inclinata', 'tricipiti'),
('French Press Bilanciere Panca Piana', 'tricipiti'),
('French Press Panca Inclinata', 'tricipiti'),
('Dips', 'tricipiti'),
('Squat', 'gambe'),
('Leg Press 45', 'gambe'),
('Leg Extension', 'gambe'),
('Hack Squat 45', 'gambe'),
('Pendulum Squat', 'gambe'),
('Affondi', 'gambe'),
('Leg Curl', 'gambe'),
('Leg Curl In Piedi', 'gambe'),
('Iperextension', 'gambe'),
('Sissy Squat', 'gambe'),
('Calf In Piedi', 'polpacci'),
('Calf Seduto', 'polpacci'),
('Calf Con Manubrio', 'polpacci'),
('Crunch', 'addominali'),
('Crunch Inverso', 'addominali'),
('Plank', 'addominali'),
('Sit-up', 'addominali');