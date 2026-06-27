-- Tabella per il rate limiting degli endpoint di autenticazione (login/register).
-- Contatore fixed-window per chiave: un record per chiave, con scadenza.
-- I record scaduti vengono rimossi opportunisticamente lato applicazione
-- (limitazione della conservazione: l'IP non resta oltre la finestra del rate limit).
CREATE TABLE IF NOT EXISTS `gym_rate_limits` (
  `rate_key` varchar(191) NOT NULL,
  `attempts` int(10) unsigned NOT NULL DEFAULT 0,
  `expires_at` datetime NOT NULL,
  PRIMARY KEY (`rate_key`),
  KEY `idx_expires_at` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
