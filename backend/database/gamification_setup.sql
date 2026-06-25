-- Gamification MVP: streak tracking
-- Run once. Uses gym_ prefix and FK ON DELETE CASCADE matching existing tables.

CREATE TABLE IF NOT EXISTS `gym_user_gamification` (
  `user_id`               INT          NOT NULL,
  `current_streak_weeks`  INT          NOT NULL DEFAULT 0,
  `longest_streak_weeks`  INT          NOT NULL DEFAULT 0,
  `last_completed_week`   INT          NULL     DEFAULT NULL,  -- YEARWEEK(date, 3) ISO format e.g. 202426
  `updated_at`            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`),
  CONSTRAINT `fk_gamification_user`
    FOREIGN KEY (`user_id`) REFERENCES `gym_users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
