# Aggiornamento della struttura del database per Gym Progress Tracker

Questo aggiornamento risolve il problema degli ID inconsistenti degli esercizi tra le tabelle `gym_exercises` e `gym_workout_history` implementando una struttura relazionale più robusta.

## Panoramica dei cambiamenti

1. **Nuova tabella `gym_workout_sets`**
   - Memorizza ogni set di esercizi in modo relazionale
   - Si collega direttamente agli ID corretti in `gym_exercises`

2. **Modifica alle API**
   - L'API di registrazione degli allenamenti ora utilizza la nuova struttura
   - L'API di lettura supporta sia il vecchio che il nuovo formato (retrocompatibilità)

3. **Nuovo modello per i set di allenamento**
   - Aggiunto `WorkoutSet.php` per gestire i set di allenamento

## Istruzioni per l'aggiornamento

### 1. Backup del database

**IMPORTANTE**: Prima di procedere, esegui un backup completo del database.

```sql
mysqldump -u username -p database_name > backup_before_upgrade.sql
```

### 2. Creazione della nuova tabella

Esegui il seguente script SQL:

```sql
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
```

Puoi utilizzare PHPMyAdmin o un altro client SQL, oppure copiare lo script `database_update.sql` nel tuo server.

### 3. Migrazione dei dati esistenti

1. Carica il file `migrate_workout_data.php` sul tuo server
2. Visita l'URL di questo script nel browser (es. `https://tuo-sito.com/migrate_workout_data.php`)
3. Controlla i log per verificare che la migrazione sia avvenuta con successo

Questo script:
- Legge tutti i record dalla tabella `gym_workout_history`
- Estrae gli esercizi dal campo JSON
- Cerca l'ID corretto di ogni esercizio nella tabella `gym_exercises`
- Inserisce i dati nella nuova tabella `gym_workout_sets`

### 4. Aggiornamento dei file del codice sorgente

Sostituisci i seguenti file:

1. `backend/models/WorkoutSet.php` (nuovo file)
2. `backend/api/workout/record_workout.php` (file modificato)
3. `backend/api/workout_history/read.php` (file modificato)
4. `src/components/RecordWorkoutDialog.js` (file modificato)

### 5. Test della nuova struttura

Dopo l'aggiornamento:

1. Prova a registrare un nuovo allenamento
2. Verifica che i dati appaiano correttamente nella pagina dei progressi
3. Controlla i log della console per verificare che gli ID degli esercizi siano corretti

## Risoluzione dei problemi

### Se gli allenamenti esistenti non appaiono correttamente:

1. Controlla se ci sono stati errori durante la migrazione
2. Verifica che la tabella `gym_workout_sets` contenga dati
3. Usa lo script `migrate_workout_data.php` per visualizzare dettagli sul processo di migrazione

### Se i nuovi allenamenti non vengono salvati:

1. Verifica i log della console del browser
2. Controlla i log di errore del server PHP
3. Assicurati che gli ID degli esercizi che stai salvando esistano nella tabella `gym_exercises`

## Supporto

Se riscontri problemi durante l'aggiornamento, verifica i log del server e la console del browser per identificare il punto esatto dell'errore. 