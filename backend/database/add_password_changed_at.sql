-- Traccia la data dell'ultimo cambio password, per mostrare "Ultima modifica N mesi fa" in Account.
-- NULL per gli utenti che non hanno mai cambiato password dalla registrazione.
ALTER TABLE `gym_users` ADD COLUMN `password_changed_at` DATETIME DEFAULT NULL;
