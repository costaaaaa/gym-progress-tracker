-- Aggiunta della colonna 'notes' alla tabella gym_workout_exercises
ALTER TABLE `gym_workout_exercises` ADD COLUMN `notes` TEXT DEFAULT NULL AFTER `rest`;