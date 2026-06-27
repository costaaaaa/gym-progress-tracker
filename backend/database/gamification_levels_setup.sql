-- Gamification Fase 2: XP, livelli, achievement
-- Eseguire una sola volta, dopo gamification_setup.sql.

-- 1. Estendi gym_user_gamification con XP e tonnellaggio
                                                                                                                     
ALTER TABLE gym_user_gamification                                                                                    
  ADD COLUMN total_xp INT NOT NULL DEFAULT 0,                                                                        
  ADD COLUMN level INT NOT NULL DEFAULT 1,                                                                           
  ADD COLUMN lifetime_volume_kg DECIMAL(12,2) NOT NULL DEFAULT 0;   
-- 2. Progressione XP per esercizio
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

-- 3. Achievement sbloccati (una riga per sblocco, UNIQUE garantisce no-doppio)
CREATE TABLE IF NOT EXISTS `gym_achievements` (
  `id`              INT          NOT NULL AUTO_INCREMENT,
  `user_id`         INT          NOT NULL,
  `achievement_key` VARCHAR(50)  NOT NULL,
  `unlocked_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_achievement` (`user_id`, `achievement_key`),
  CONSTRAINT `fk_ach_user` FOREIGN KEY (`user_id`) REFERENCES `gym_users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
