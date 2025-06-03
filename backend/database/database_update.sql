-- Creazione della nuova tabella per i set di allenamento
CREATE TABLE IF NOT EXISTS `gym_workout_sets` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `workout_history_id` int(11) NOT NULL,
  `exercise_id` int(11) NOT NULL,
  `set_number` int(11) NOT NULL,
  `weight` decimal(5,2) NOT NULL,
  `reps` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `workout_history_id` (`workout_history_id`),
  KEY `exercise_id` (`exercise_id`),
  CONSTRAINT `gym_workout_sets_ibfk_1` FOREIGN KEY (`workout_history_id`) REFERENCES `gym_workout_history` (`id`) ON DELETE CASCADE,
  CONSTRAINT `gym_workout_sets_ibfk_2` FOREIGN KEY (`exercise_id`) REFERENCES `gym_exercises` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Nota: Non elimineremo il campo 'exercises' dalla tabella gym_workout_history
-- per mantenere compatibilità con il codice esistente durante la transizione 